#!/usr/bin/env bash
set -Eeuo pipefail

readonly -a RETIRED_AWS_ACCOUNT_IDS=("700951986348")
readonly EXPECTED_REGION="eu-west-2"
readonly DOMAIN_NAME="privacyready.co.uk"
readonly API_HOSTNAME="staging.privacyready.co.uk"
readonly FRONTEND_HOSTNAME="app-staging.privacyready.co.uk"
readonly STACK_NAME="privacyready-staging"

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
BACKEND_DIR="${ROOT_DIR}/terraform/bootstrap/backend"
DNS_DIR="${ROOT_DIR}/terraform/bootstrap/route53"
STAGING_DIR="${ROOT_DIR}/terraform/environments/staging"
API_CONTEXT="${ROOT_DIR}/services/api"
SCANNER_CONTEXT="${ROOT_DIR}/services/scanner/cmd/scanner"
FRONTEND_DIR="${ROOT_DIR}/frontend/portal"
LOG_DIR="${ROOT_DIR}/.rebuild-logs"
AWS_REGION="${AWS_REGION:-${EXPECTED_REGION}}"
export AWS_REGION AWS_DEFAULT_REGION="${AWS_REGION}"

CURRENT_PHASE="startup"
AWS_ACCOUNT_ID=""
AWS_CALLER_ARN=""
GIT_SHA=""
RELEASE_TAG=""
BACKEND_BUCKET=""
HOSTED_ZONE_ID=""
API_IMAGE_URI=""
SCANNER_IMAGE_URI=""
CONTAINER_BUILDER=""
MUTATION_AUTHORIZED=false
COST_CONFIRMED=false
LOG_FILE=""
DEMO_OVERRIDE_FILE=""
BUILD_WORKTREE=""
STATE_BACKUP_DIR=""
APPLY_GUARD_FILE=""

timestamp() { date -u +%Y%m%dT%H%M%SZ; }
phase() { CURRENT_PHASE="$1"; printf '\n[%s] %s\n' "$1" "${2:-}"; }
info() { printf '%s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

on_error() {
  local line="$1" status="$2"
  printf 'ERROR: phase [%s] stopped at line %s (status %s).\n' "$CURRENT_PHASE" "$line" "$status" >&2
  printf 'Safe resume: ./rebuild-aws.sh %s\n' "${COMMAND:-all}" >&2
}

on_interrupt() {
  printf '\nInterrupted during [%s]. No automatic rollback was attempted.\n' "$CURRENT_PHASE" >&2
  printf 'Safe resume: ./rebuild-aws.sh %s\n' "${COMMAND:-all}" >&2
  exit 130
}

cleanup_sensitive_temp() {
  local temp_root="${TMPDIR:-/tmp}"
  if [[ -n "$DEMO_OVERRIDE_FILE" && -f "$DEMO_OVERRIDE_FILE" && "$DEMO_OVERRIDE_FILE" == "${temp_root}/privacyready-demo-override."*.json ]]; then
    rm -f -- "$DEMO_OVERRIDE_FILE"
  fi
  if [[ -n "$BUILD_WORKTREE" && -d "$BUILD_WORKTREE" && "$BUILD_WORKTREE" == "${temp_root}/privacyready-build."* ]]; then
    if git -C "$ROOT_DIR" worktree list --porcelain | grep -Fqx "worktree ${BUILD_WORKTREE}"; then
      git -C "$ROOT_DIR" worktree remove --force "$BUILD_WORKTREE"
    fi
  fi
}

trap 'on_error "$LINENO" "$?"' ERR
trap on_interrupt INT TERM HUP
trap cleanup_sensitive_temp EXIT

start_logging() {
  mkdir -p "$LOG_DIR"
  chmod 700 "$LOG_DIR"
  LOG_FILE="${LOG_DIR}/rebuild-$(timestamp)-${COMMAND:-unknown}.log"
  exec > >(tee -a "$LOG_FILE") 2>&1
  info "Log: ${LOG_FILE}"
}

usage() {
  cat <<'EOF'
Privacy Ready staging rebuild

Usage: ./rebuild-aws.sh COMMAND

Commands:
  check      Validate local tools, Git metadata, AWS identity, account and region.
  bootstrap  Create the fresh, account-specific Terraform S3 backend.
  dns        Create/reuse the Route53 zone and show its authoritative nameservers.
  plan       Validate Terraform and save a staging plan; rejects every delete/replace.
  deploy     Apply only the current saved safe plan, run migrations and optional demo bootstrap.
  images     Create the ECR/secret foundation, populate available secrets, build and push images.
  frontend   Build the Vite portal, sync it to the private S3 origin and invalidate CloudFront.
  verify     Run read-only infrastructure, DNS, HTTP, scanner and security checks.
  recover    Back up and inspect staging state/drift after an interrupted operation; never mutates AWS.
  destroy    Destroy only Terraform-managed staging resources after typed confirmation; preserves backend and hosted zone.
  all        Run the complete safe staging rebuild sequence. Never builds production.
  help       Show this help.

Environment:
  AWS_REGION                       AWS region; expected/default: eu-west-2
  PRIVACYREADY_ALLOW_REGION_OVERRIDE  Set true only after reviewing another region
  AWS_PROFILE                      AWS CLI profile
  PRIVACYREADY_AWS_ACCOUNT_ID      Required account pin for non-interactive use
  PRIVACYREADY_NONINTERACTIVE      Set true to accept cost confirmation only
  STRIPE_SECRET_KEY                Stripe TEST secret key (must start sk_test_)
  STRIPE_WEBHOOK_SECRET            Stripe TEST webhook signing secret (must start whsec_)
  DEMO_ACCOUNT_PASSWORD            Optional guarded staging demo account password

Secret values are never printed or written to logs. Every account in the retired
account deny list is unconditionally rejected. Names.co.uk is never modified.
EOF
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

select_container_builder() {
  CONTAINER_BUILDER=""
  if command_exists docker && docker info >/dev/null 2>&1; then
    CONTAINER_BUILDER="docker"
  elif command_exists podman && podman info >/dev/null 2>&1; then
    CONTAINER_BUILDER="podman"
  fi
}

require_tools() {
  phase CHECK "Checking required local tools"
  local -a required=(aws terraform git jq curl openssl node npm dig)
  local -a missing=()
  local tool
  for tool in "${required[@]}"; do command_exists "$tool" || missing+=("$tool"); done
  if ((${#missing[@]})); then
    printf 'Missing required tools: %s\n' "${missing[*]}" >&2
    return 1
  fi
  local terraform_version
  terraform_version="$(terraform version -json | jq -er '.terraform_version')"
  [[ "$(printf '%s\n' 1.10.0 "$terraform_version" | sort -V | head -n1)" == 1.10.0 ]] || die "Terraform >= 1.10.0 is required for native S3 state locking."
  select_container_builder
  if [[ -z "$CONTAINER_BUILDER" ]]; then
    die "No healthy container builder found. Start Docker or install/configure Podman."
  fi
  info "Container builder: ${CONTAINER_BUILDER}"
}

check_repository_layout() {
  local -a required_paths=(
    "$BACKEND_DIR/main.tf" "$DNS_DIR/main.tf" "$STAGING_DIR/main.tf"
    "$API_CONTEXT/Dockerfile" "$SCANNER_CONTEXT/Dockerfile"
    "$FRONTEND_DIR/package.json" "$API_CONTEXT/prisma/migrations"
    "$API_CONTEXT/scripts/bootstrap-staging-demo.ts"
  )
  local path
  for path in "${required_paths[@]}"; do [[ -e "$path" ]] || die "Required repository path is missing: $path"; done
}

verify_configuration_contracts() {
  phase CHECK "Checking approved staging architecture and security contracts"
  local sg_file="${ROOT_DIR}/terraform/modules/security-groups/main.tf"
  [[ "$(rg -c '^resource "aws_security_group"' "$sg_file")" == 4 ]] || die "Expected four security-group containers."
  [[ "$(rg -c '^resource "aws_vpc_security_group_(ingress|egress)_rule"' "$sg_file")" == 11 ]] || die "Expected eleven standalone security-group rules."
  if rg -n '^[[:space:]]*(ingress|egress)[[:space:]]*(=|\{)' "$sg_file"; then die "Inline security-group rules are forbidden."; fi
  if rg -n 'resource "aws_security_group_rule"' "$sg_file"; then die "Legacy combined security-group rule resources are forbidden."; fi
  rg -q 'Action[[:space:]]*=[[:space:]]*\["ses:SendEmail", "ses:SendRawEmail"\]' "$STAGING_DIR/ecs.tf" || die "SES send permissions do not match the approved minimal actions."
  rg -q 'identity/\$\{var.ses_domain\}' "$STAGING_DIR/ecs.tf" || die "SES IAM is not scoped to the Terraform-created domain identity."
  rg -q '"ses:FromAddress"[[:space:]]*=[[:space:]]*var.ses_from_email' "$STAGING_DIR/ecs.tf" || die "SES IAM lacks the sender-address restriction."
  if rg -n 'ses:\*' "$STAGING_DIR"; then die "Wildcard SES permissions are forbidden."; fi
  for required_secret in DB_PASSWORD JWT_SECRET SCANNER_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
    rg -q "${required_secret}[[:space:]]*=" "$STAGING_DIR/ecs.tf" || die "API ECS is missing ${required_secret}."
  done
  rg -q 'DB_PASSWORD[[:space:]]*=[[:space:]]*"\$\{module.database.master_user_secret_arn\}:password::"' "$STAGING_DIR/ecs.tf" || die "DB_PASSWORD is not sourced from the RDS managed secret JSON password key."
  if rg -n 'prisma (db push|migrate reset|migrate resolve)' "$API_CONTEXT/start.sh"; then die "Unsafe automatic Prisma command found."; fi
  rg -q 'prisma migrate deploy' "$API_CONTEXT/start.sh" || die "API startup does not run committed Prisma migrations."
  if rg -n "queryParams\.get\(['\"]scanClaimToken" "$FRONTEND_DIR/src"; then die "Claim tokens must never be read from URLs."; fi
  rg -q "sessionStorage\.getItem\('freeScanClaimToken'\)" "$FRONTEND_DIR/src/pages/Login.tsx" || die "Login claim flow no longer uses same-tab session storage."
  rg -q 'JSON.stringify\(\{ claimToken \}\)' "$FRONTEND_DIR/src/pages/Login.tsx" || die "Claim token is not sent in the claim request body."
  if rg -n 'SCANNER_API_KEY|privacyready\.local' "$FRONTEND_DIR/src"; then die "Frontend source exposes a scanner credential name or private hostname."; fi
  rg -q "NODE_ENV !== 'staging'" "$API_CONTEXT/scripts/bootstrap-staging-demo.ts" || die "Demo bootstrap staging guard is missing."
  rg -q "STAGING_DEMO_BOOTSTRAP !== 'true'" "$API_CONTEXT/scripts/bootstrap-staging-demo.ts" || die "Demo bootstrap explicit guard is missing."
  rg -q "role: 'ADMIN'" "$API_CONTEXT/scripts/bootstrap-staging-demo.ts" || die "Demo bootstrap ADMIN role is missing."
  if rg -n 'SUPERADMIN' "$API_CONTEXT/scripts/bootstrap-staging-demo.ts"; then die "Demo bootstrap must never grant SUPERADMIN."; fi
  if rg -n '(legacy|management_vpc|gitlab|transit_gateway|elasticache|n8n)' "$STAGING_DIR" -g '*.tf'; then die "Active staging Terraform references retired architecture."; fi
  info "Approved staging architecture and source security contracts passed."
}

check_git() {
  phase CHECK "Checking Git release metadata"
  git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null
  GIT_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"
  [[ "$GIT_SHA" =~ ^[0-9a-f]{40}$ ]] || die "Could not determine a full Git SHA."
  RELEASE_TAG="release-${GIT_SHA}"
  info "Git SHA: ${GIT_SHA}"
}

require_clean_release() {
  local status
  status="$(git -C "$ROOT_DIR" status --porcelain --untracked-files=all)"
  [[ -z "$status" ]] || die "Image builds require a clean committed working tree. Commit or remove local changes first."
}

prepare_clean_build_worktree() {
  require_clean_release
  [[ -n "$GIT_SHA" ]] || die "Git SHA is not initialized."
  BUILD_WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/privacyready-build.XXXXXX")"
  git -C "$ROOT_DIR" worktree add --detach "$BUILD_WORKTREE" "$GIT_SHA" >/dev/null
  [[ "$(git -C "$BUILD_WORKTREE" rev-parse HEAD)" == "$GIT_SHA" ]] || die "Detached build worktree does not match the release SHA."
  [[ -z "$(git -C "$BUILD_WORKTREE" status --porcelain --untracked-files=all)" ]] || die "Detached build worktree is unexpectedly dirty."
  info "Build source: clean detached worktree at ${GIT_SHA}"
}

release_build_worktree() {
  local temp_root="${TMPDIR:-/tmp}"
  if [[ -n "$BUILD_WORKTREE" && -d "$BUILD_WORKTREE" && "$BUILD_WORKTREE" == "${temp_root}/privacyready-build."* ]]; then
    git -C "$ROOT_DIR" worktree remove --force "$BUILD_WORKTREE"
    BUILD_WORKTREE=""
  fi
}

reject_retired_account() {
  local account_id="$1"
  local retired_id
  for retired_id in "${RETIRED_AWS_ACCOUNT_IDS[@]}"; do
    [[ "$account_id" != "$retired_id" ]] || die "Retired AWS account ${retired_id} is forbidden. No AWS access is permitted."
  done
}

check_aws_identity() {
  phase CHECK "Checking AWS identity"
  local identity
  identity="$(aws sts get-caller-identity --output json)" || die "Unable to obtain AWS caller identity. Authenticate to the NEW AWS account."
  AWS_ACCOUNT_ID="$(jq -er '.Account' <<<"$identity")"
  AWS_CALLER_ARN="$(jq -er '.Arn' <<<"$identity")"
  [[ "$AWS_ACCOUNT_ID" =~ ^[0-9]{12}$ ]] || die "AWS returned an invalid account ID."
  reject_retired_account "$AWS_ACCOUNT_ID"
  if [[ -n "${PRIVACYREADY_AWS_ACCOUNT_ID:-}" && "$AWS_ACCOUNT_ID" != "$PRIVACYREADY_AWS_ACCOUNT_ID" ]]; then
    die "Active AWS account ${AWS_ACCOUNT_ID} does not match PRIVACYREADY_AWS_ACCOUNT_ID."
  fi
  info "AWS account: ${AWS_ACCOUNT_ID}"
  info "AWS caller: ${AWS_CALLER_ARN}"
  BACKEND_BUCKET="privacyready-terraform-state-${AWS_ACCOUNT_ID}"
  API_IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${STACK_NAME}-api:${RELEASE_TAG}"
  SCANNER_IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${STACK_NAME}-scanner:${RELEASE_TAG}"
  APPLY_GUARD_FILE="${LOG_DIR}/staging-apply-in-progress-${AWS_ACCOUNT_ID}"
}

require_no_interrupted_apply() {
  if [[ -n "$APPLY_GUARD_FILE" && -f "$APPLY_GUARD_FILE" ]]; then
    die "A previous staging apply may have been interrupted. Run ./rebuild-aws.sh recover before planning, deploying, or destroying."
  fi
}

clear_apply_guard() {
  if [[ -n "$APPLY_GUARD_FILE" && "$APPLY_GUARD_FILE" == "${LOG_DIR}/staging-apply-in-progress-${AWS_ACCOUNT_ID}" && -f "$APPLY_GUARD_FILE" ]]; then
    rm -f -- "$APPLY_GUARD_FILE"
  fi
}

check_region() {
  phase CHECK "Checking AWS region"
  [[ -n "$AWS_REGION" ]] || die "AWS_REGION is empty."
  if [[ "$AWS_REGION" != "$EXPECTED_REGION" ]]; then
    warn "AWS_REGION is ${AWS_REGION}; the reviewed staging region is ${EXPECTED_REGION}."
    [[ "${PRIVACYREADY_ALLOW_REGION_OVERRIDE:-false}" == "true" ]] || die "Set PRIVACYREADY_ALLOW_REGION_OVERRIDE=true after reviewing regional dependencies."
  fi
  aws ec2 describe-regions --region-names "$AWS_REGION" --query 'Regions[0].RegionName' --output text >/dev/null
  info "AWS region: ${AWS_REGION}"
}

authorize_mutation() {
  [[ "$MUTATION_AUTHORIZED" == true ]] && return
  check_aws_identity
  check_region
  if [[ -z "${PRIVACYREADY_AWS_ACCOUNT_ID:-}" ]]; then
    [[ -t 0 ]] || die "Set PRIVACYREADY_AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID} for non-interactive mutation."
    local entered
    read -r -p "Type the NEW AWS account ID ${AWS_ACCOUNT_ID} to authorize mutations: " entered
    [[ "$entered" == "$AWS_ACCOUNT_ID" ]] || die "AWS account confirmation did not match."
  fi
  MUTATION_AUTHORIZED=true
}

confirm_costs() {
  [[ "$COST_CONFIRMED" == true ]] && return
  cat <<'EOF'

COST WARNING
This staging stack creates chargeable infrastructure including a NAT Gateway,
Application Load Balancer, RDS PostgreSQL, ECS Fargate services, WAF and
CloudFront. Charges continue until the resources are destroyed.
EOF
  if [[ "${PRIVACYREADY_NONINTERACTIVE:-false}" != "true" ]]; then
    [[ -t 0 ]] || die "Interactive cost confirmation required, or set PRIVACYREADY_NONINTERACTIVE=true."
    local answer
    read -r -p "Type CREATE CHARGEABLE STAGING to continue: " answer
    [[ "$answer" == "CREATE CHARGEABLE STAGING" ]] || die "Cost confirmation declined."
  fi
  COST_CONFIRMED=true
}

backend_args() {
  printf '%s\n' \
    "bucket=${BACKEND_BUCKET}" \
    "key=$1" \
    "region=${AWS_REGION}" \
    "encrypt=true" \
    "use_lockfile=true"
}

terraform_backend_init() {
  local directory="$1" key="$2"
  local -a args=()
  while IFS= read -r value; do args+=("-backend-config=$value"); done < <(backend_args "$key")
  terraform -chdir="$directory" init -reconfigure -input=false "${args[@]}"
}

terraform_backend_migrate() {
  local directory="$1" key="$2"
  local -a args=()
  while IFS= read -r value; do args+=("-backend-config=$value"); done < <(backend_args "$key")
  terraform -chdir="$directory" init -migrate-state -force-copy -input=false "${args[@]}"
}

inspect_saved_plan() {
  local directory="$1" plan_file="$2" json_file="$3"
  terraform -chdir="$directory" show -json "$plan_file" > "$json_file"
  local deletes replacements
  deletes="$(jq '[.resource_changes[]? | select(.change.actions | index("delete"))] | length' "$json_file")"
  replacements="$(jq '[.resource_changes[]? | select((.change.actions | index("delete")) and (.change.actions | index("create")))] | length' "$json_file")"
  if ((deletes > 0 || replacements > 0)); then
    jq -r '.resource_changes[]? | select(.change.actions | index("delete")) | "  \(.address): \(.change.actions|join(","))"' "$json_file" >&2
    die "Terraform plan contains ${deletes} delete action(s), including ${replacements} replacement(s). Refusing apply."
  fi
  info "Plan safety: 0 destroy, 0 replacement."
}

inspect_destroy_plan() {
  local directory="$1" plan_file="$2" json_file="$3"
  terraform -chdir="$directory" show -json "$plan_file" > "$json_file"
  local deletes unexpected
  deletes="$(jq '[.resource_changes[]? | select(.change.actions | index("delete"))] | length' "$json_file")"
  unexpected="$(jq '[.resource_changes[]? | select((.change.actions | index("create")) or (.change.actions | index("update")))] | length' "$json_file")"
  ((unexpected == 0)) || die "Destroy plan contains ${unexpected} unexpected create/update action(s)."
  ((deletes > 0)) || die "Destroy plan contains no resources; refusing an ambiguous no-op teardown."
  info "Staging destroy plan resource count: ${deletes}"
  jq -r '.resource_changes[]? | select(.change.actions | index("delete")) | "  \(.address)"' "$json_file"
}

backup_staging_state() {
  local purpose="$1" state_file checksum_file
  STATE_BACKUP_DIR="${LOG_DIR}/state-backups/$(timestamp)-${purpose}-${AWS_ACCOUNT_ID}"
  mkdir -p "$STATE_BACKUP_DIR"
  chmod 700 "$STATE_BACKUP_DIR"
  state_file="${STATE_BACKUP_DIR}/staging.tfstate"
  checksum_file="${state_file}.sha256"
  terraform -chdir="$STAGING_DIR" state pull > "$state_file"
  chmod 600 "$state_file"
  jq -e '.version and .lineage and (.resources | type == "array")' "$state_file" >/dev/null
  sha256sum "$state_file" > "$checksum_file"
  sha256sum --check "$checksum_file" >/dev/null
  info "Verified local state backup: ${state_file}"
}

verify_staging_state_scope() {
  local require_resources="${1:-false}" state_file="${STATE_BACKUP_DIR}/staging.tfstate" list_file="${STATE_BACKUP_DIR}/state-list.txt"
  terraform -chdir="$STAGING_DIR" state list | sort > "$list_file"
  local resource_count
  resource_count="$(wc -l < "$list_file")"
  if [[ "$require_resources" == true && "$resource_count" -eq 0 ]]; then die "Staging state is empty; nothing is authorized for destroy."; fi
  if rg -n '(legacy|management|gitlab|transit|elasticache|redis|n8n|production|module\.test)' "$list_file"; then
    die "Staging state contains a retired or out-of-scope resource address."
  fi
  local retired_id
  for retired_id in "${RETIRED_AWS_ACCOUNT_IDS[@]}"; do
    if rg -q "$retired_id" "$state_file"; then die "Staging state references retired AWS account ${retired_id}."; fi
  done
  local foreign_accounts
  foreign_accounts="$(jq -r '.. | strings | select(test("^arn:(aws|aws-us-gov|aws-cn):"))' "$state_file" | awk -F: '$5 ~ /^[0-9]{12}$/ {print $5}' | sort -u | grep -Fvx "$AWS_ACCOUNT_ID" || true)"
  [[ -z "$foreign_accounts" ]] || die "Staging state contains AWS ARNs from another account."
  info "Staging state scope verified: ${resource_count} addresses."
}

bootstrap_backend() {
  phase BOOTSTRAP "Creating or adopting the fresh Terraform backend"
  authorize_mutation
  local bucket_exists=false
  if aws s3api head-bucket --bucket "$BACKEND_BUCKET" >/dev/null 2>&1; then bucket_exists=true; fi
  local local_backend_state="${BACKEND_DIR}/terraform.tfstate"
  if [[ "$bucket_exists" == true && -s "$local_backend_state" ]] &&
    jq -e --arg bucket "$BACKEND_BUCKET" '.resources[]? | select(.type=="aws_s3_bucket" and .name=="terraform_state") | .instances[]?.attributes.bucket == $bucket' "$local_backend_state" >/dev/null; then
    info "Resuming an interrupted backend-state migration."
    terraform -chdir="$BACKEND_DIR" init -backend=false -input=false
    terraform_backend_migrate "$BACKEND_DIR" "bootstrap/backend/terraform.tfstate"
  fi
  if [[ "$bucket_exists" == true ]]; then
    terraform_backend_init "$BACKEND_DIR" "bootstrap/backend/terraform.tfstate"
  else
    terraform -chdir="$BACKEND_DIR" init -backend=false -input=false
  fi
  terraform -chdir="$BACKEND_DIR" fmt -check
  terraform -chdir="$BACKEND_DIR" validate
  if [[ "$bucket_exists" == true ]]; then
    local owner
    owner="$(aws s3api get-bucket-location --bucket "$BACKEND_BUCKET" --query 'LocationConstraint' --output text)"
    [[ "$owner" == "$AWS_REGION" || ("$owner" == "None" && "$AWS_REGION" == "us-east-1") ]] || die "Existing backend bucket is in an unexpected region."
    terraform -chdir="$BACKEND_DIR" state show aws_s3_bucket.terraform_state >/dev/null 2>&1 || die "Existing backend bucket is not represented in its remote bootstrap state. Refusing ambiguous adoption."
  fi
  local plan_file="${LOG_DIR}/backend-${AWS_ACCOUNT_ID}.tfplan" json_file="${LOG_DIR}/backend-${AWS_ACCOUNT_ID}.json"
  terraform -chdir="$BACKEND_DIR" plan -input=false -out="$plan_file" -var="aws_region=${AWS_REGION}" -var="bucket_name=${BACKEND_BUCKET}"
  inspect_saved_plan "$BACKEND_DIR" "$plan_file" "$json_file"
  terraform -chdir="$BACKEND_DIR" apply -input=false "$plan_file"
  if [[ "$bucket_exists" == false ]]; then
    terraform_backend_migrate "$BACKEND_DIR" "bootstrap/backend/terraform.tfstate"
  fi
  aws s3api get-bucket-versioning --bucket "$BACKEND_BUCKET" --query Status --output text | grep -qx Enabled
  info "Backend bucket ready: ${BACKEND_BUCKET}"
}

bootstrap_dns() {
  phase DNS "Creating or reusing the Route53 hosted zone"
  authorize_mutation
  [[ -n "$BACKEND_BUCKET" ]] || die "Backend identity is not initialized."
  aws s3api head-bucket --bucket "$BACKEND_BUCKET" >/dev/null 2>&1 || die "Run ./rebuild-aws.sh bootstrap first."
  terraform_backend_init "$DNS_DIR" "bootstrap/route53/terraform.tfstate"
  terraform -chdir="$DNS_DIR" fmt -check
  terraform -chdir="$DNS_DIR" validate
  local plan_file="${LOG_DIR}/route53-${AWS_ACCOUNT_ID}.tfplan" json_file="${LOG_DIR}/route53-${AWS_ACCOUNT_ID}.json"
  terraform -chdir="$DNS_DIR" plan -input=false -out="$plan_file" -var="aws_region=${AWS_REGION}" -var="domain_name=${DOMAIN_NAME}" -var='tags={Owner="platform",Environment="staging"}'
  inspect_saved_plan "$DNS_DIR" "$plan_file" "$json_file"
  terraform -chdir="$DNS_DIR" apply -input=false "$plan_file"
  HOSTED_ZONE_ID="$(terraform -chdir="$DNS_DIR" output -raw hosted_zone_id)"
  show_nameservers
}

load_dns_outputs() {
  terraform_backend_init "$DNS_DIR" "bootstrap/route53/terraform.tfstate" >/dev/null
  HOSTED_ZONE_ID="$(terraform -chdir="$DNS_DIR" output -raw hosted_zone_id 2>/dev/null || true)"
  [[ -n "$HOSTED_ZONE_ID" ]] || die "Route53 bootstrap state is absent. Run ./rebuild-aws.sh dns."
}

new_nameservers() {
  aws route53 get-hosted-zone --id "$HOSTED_ZONE_ID" --query 'DelegationSet.NameServers[]' --output text | tr '\t' '\n' | sed 's/\.$//' | sort
}

show_nameservers() {
  info "New Route53 hosted zone: ${HOSTED_ZONE_ID}"
  info "Authoritative nameservers:"
  new_nameservers | sed 's/^/  /'
}

check_dns_delegation() {
  phase DNS "Checking public delegation"
  [[ -n "$HOSTED_ZONE_ID" ]] || load_dns_outputs
  local expected current_cloudflare current_google
  expected="$(new_nameservers)"
  current_cloudflare="$(dig +short NS "$DOMAIN_NAME" @1.1.1.1 2>/dev/null | sed 's/\.$//' | sort || true)"
  current_google="$(dig +short NS "$DOMAIN_NAME" @8.8.8.8 2>/dev/null | sed 's/\.$//' | sort || true)"
  if [[ -z "$expected" || "$current_cloudflare" != "$expected" || "$current_google" != "$expected" ]]; then
    cat <<'EOF'

ACTION REQUIRED AT NAMES.CO.UK
Replace the existing four nameservers for privacyready.co.uk with these four
Route53 nameservers:
EOF
    new_nameservers | sed 's/^/  /'
    cat <<'EOF'

Names.co.uk is never modified by this script. Wait for public DNS propagation,
then resume with:
  ./rebuild-aws.sh all
or:
  ./rebuild-aws.sh deploy

This is an expected safe pause; no cleanup is required.
EOF
    exit 0
  fi
  info "Names.co.uk delegation matches the new Route53 zone through 1.1.1.1 and 8.8.8.8."
}

write_staging_tfvars() {
  [[ -n "$HOSTED_ZONE_ID" ]] || load_dns_outputs
  [[ -n "$GIT_SHA" ]] || check_git
  local tfvars="${LOG_DIR}/staging-${AWS_ACCOUNT_ID}.tfvars.json"
  jq -n \
    --arg region "$AWS_REGION" --arg api "$API_IMAGE_URI" --arg scanner "$SCANNER_IMAGE_URI" \
    --arg zone "$HOSTED_ZONE_ID" \
    '{aws_region:$region,api_image:$api,scanner_image:$scanner,domain_name:"privacyready.co.uk",staging_hostname:"staging.privacyready.co.uk",frontend_hostname:"app-staging.privacyready.co.uk",route53_zone_id:$zone,ses_domain:"staging.privacyready.co.uk",database_name:"privacyready",database_username:"privacyready",api_cpu:256,api_memory:512,api_desired_count:1,scanner_cpu:256,scanner_memory:512,scanner_desired_count:1,ses_from_email:"no-reply@staging.privacyready.co.uk",common_tags:{Owner:"platform"}}' > "$tfvars"
  printf '%s\n' "$tfvars"
}

terraform_init() {
  phase TERRAFORM "Initializing fresh staging state"
  aws s3api head-bucket --bucket "$BACKEND_BUCKET" >/dev/null 2>&1 || die "Terraform backend does not exist. Run bootstrap."
  terraform_backend_init "$STAGING_DIR" "environments/staging/terraform.tfstate"
}

terraform_variable() {
  local tfvars="$1" expression="$2"
  terraform -chdir="$STAGING_DIR" console -var-file="$tfvars" <<<"$expression" | sed -n 's/^"\(.*\)"$/\1/p'
}

verify_postgres_compatibility() {
  local tfvars="$1" engine_version instance_class available orderable compatible
  engine_version="$(terraform_variable "$tfvars" 'var.database_engine_version')"
  instance_class="$(terraform_variable "$tfvars" 'var.database_instance_class')"
  [[ -n "$engine_version" && -n "$instance_class" ]] || die "Could not read the Terraform-configured PostgreSQL version and instance class."
  info "PostgreSQL compatibility: engine ${engine_version}, class ${instance_class}, region ${AWS_REGION}"
  available="$(aws rds describe-db-engine-versions --engine postgres --engine-version "$engine_version" --query 'length(DBEngineVersions)' --output text)"
  orderable="$(aws rds describe-orderable-db-instance-options --engine postgres --engine-version "$engine_version" --db-instance-class "$instance_class" --query 'length(OrderableDBInstanceOptions)' --output text)"
  if [[ "$available" != 1 || "$orderable" == 0 ]]; then
    compatible="$(aws rds describe-orderable-db-instance-options --engine postgres --db-instance-class "$instance_class" --query 'OrderableDBInstanceOptions[].EngineVersion' --output json | jq -r 'unique | sort_by(split(".") | map(tonumber)) | .[]')"
    printf 'Configured PostgreSQL %s is unavailable or not orderable for %s in %s.\n' "$engine_version" "$instance_class" "$AWS_REGION" >&2
    printf 'Currently orderable PostgreSQL versions for %s:\n%s\n' "$instance_class" "${compatible:-  (none reported)}" >&2
    die "Update Terraform deliberately, review the version change, and rerun. No version was selected automatically."
  fi
}

terraform_validate() {
  local tfvars="$1"
  terraform fmt -check -recursive "$ROOT_DIR/terraform/bootstrap"
  terraform fmt -check -recursive "$ROOT_DIR/terraform/environments/staging"
  terraform -chdir="$STAGING_DIR" validate
  verify_postgres_compatibility "$tfvars"
}

terraform_plan() {
  phase TERRAFORM "Creating a saved staging plan"
  authorize_mutation
  require_no_interrupted_apply
  check_dns_delegation || return $?
  terraform_init
  local tfvars plan_file json_file
  tfvars="$(write_staging_tfvars)"
  terraform_validate "$tfvars"
  plan_file="${LOG_DIR}/staging-${AWS_ACCOUNT_ID}-${GIT_SHA}.tfplan"
  json_file="${LOG_DIR}/staging-${AWS_ACCOUNT_ID}-${GIT_SHA}.json"
  terraform -chdir="$STAGING_DIR" plan -input=false -out="$plan_file" -var-file="$tfvars"
  inspect_saved_plan "$STAGING_DIR" "$plan_file" "$json_file"
  info "Saved reviewed plan: ${plan_file}"
}

foundation_apply() {
  phase TERRAFORM "Ensuring ECR repositories and secret containers exist"
  authorize_mutation
  require_no_interrupted_apply
  terraform_init
  local tfvars plan_file json_file
  tfvars="$(write_staging_tfvars)"
  plan_file="${LOG_DIR}/foundation-${AWS_ACCOUNT_ID}-${GIT_SHA}.tfplan"
  json_file="${LOG_DIR}/foundation-${AWS_ACCOUNT_ID}-${GIT_SHA}.json"
  terraform -chdir="$STAGING_DIR" plan -input=false -out="$plan_file" -var-file="$tfvars" -target=module.ecr -target=module.secrets
  inspect_saved_plan "$STAGING_DIR" "$plan_file" "$json_file"
  printf 'account=%s\nplan_sha256=%s\nstarted=%s\n' "$AWS_ACCOUNT_ID" "$(sha256sum "$plan_file" | awk '{print $1}')" "$(timestamp)" > "$APPLY_GUARD_FILE"
  terraform -chdir="$STAGING_DIR" apply -input=false "$plan_file"
  clear_apply_guard
}

put_secret_stdin() {
  local secret_id="$1" value="$2"
  [[ -n "$value" ]] || die "Refusing to store an empty secret."
  printf '%s' "$value" | aws secretsmanager put-secret-value --secret-id "$secret_id" --secret-string file:///dev/stdin --query VersionId --output text >/dev/null
}

secret_has_current_version() {
  local secret_id="$1"
  [[ "$(aws secretsmanager list-secret-version-ids --secret-id "$secret_id" --query 'length(Versions[?contains(VersionStages, `AWSCURRENT`)])' --output text)" == 1 ]]
}

populate_generated_secrets() {
  phase SECRETS "Populating new staging secret values"
  authorize_mutation
  local jwt scanner
  if ! secret_has_current_version "${STACK_NAME}/jwt-secret"; then
    jwt="$(openssl rand -base64 48)"
    put_secret_stdin "${STACK_NAME}/jwt-secret" "$jwt"
  fi
  if ! secret_has_current_version "${STACK_NAME}/scanner-api-key"; then
    scanner="$(openssl rand -base64 48)"
    put_secret_stdin "${STACK_NAME}/scanner-api-key" "$scanner"
  fi
  unset jwt scanner
  if [[ -n "${STRIPE_SECRET_KEY:-}" ]] && ! secret_has_current_version "${STACK_NAME}/stripe-secret-key"; then
    [[ "$STRIPE_SECRET_KEY" == sk_test_* ]] || die "STRIPE_SECRET_KEY must be a Stripe TEST key beginning sk_test_."
    put_secret_stdin "${STACK_NAME}/stripe-secret-key" "$STRIPE_SECRET_KEY"
  fi
  if [[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]] && ! secret_has_current_version "${STACK_NAME}/stripe-webhook-secret"; then
    [[ "$STRIPE_WEBHOOK_SECRET" == whsec_* ]] || die "STRIPE_WEBHOOK_SECRET must begin whsec_."
    put_secret_stdin "${STACK_NAME}/stripe-webhook-secret" "$STRIPE_WEBHOOK_SECRET"
  fi
  info "Generated secrets populated without displaying their values."
}

require_stripe_test_credentials() {
  local key_ready=false webhook_ready=false
  secret_has_current_version "${STACK_NAME}/stripe-secret-key" && key_ready=true
  secret_has_current_version "${STACK_NAME}/stripe-webhook-secret" && webhook_ready=true
  if [[ "$key_ready" != true || "$webhook_ready" != true ]]; then
    die "Stripe TEST credentials required. Export STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, then rerun images; values are never logged."
  fi
  if [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then [[ "$STRIPE_SECRET_KEY" == sk_test_* ]] || die "STRIPE_SECRET_KEY is not a Stripe TEST key."; fi
  if [[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]]; then [[ "$STRIPE_WEBHOOK_SECRET" == whsec_* ]] || die "STRIPE_WEBHOOK_SECRET has an invalid prefix."; fi
}

ecr_login() {
  aws ecr get-login-password | "$CONTAINER_BUILDER" login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com" >/dev/null
}

build_images() {
  phase IMAGES "Building immutable API and scanner images"
  require_clean_release
  local api_exists=false scanner_exists=false
  aws ecr describe-images --repository-name "${STACK_NAME}-api" --image-ids imageTag="$RELEASE_TAG" >/dev/null 2>&1 && api_exists=true
  aws ecr describe-images --repository-name "${STACK_NAME}-scanner" --image-ids imageTag="$RELEASE_TAG" >/dev/null 2>&1 && scanner_exists=true
  if [[ "$api_exists" != true || "$scanner_exists" != true ]]; then prepare_clean_build_worktree; fi
  if [[ "$api_exists" == true ]]; then
    info "API image already exists for ${RELEASE_TAG}; immutable rebuild skipped."
  else
    "$CONTAINER_BUILDER" build --pull -t "$API_IMAGE_URI" "${BUILD_WORKTREE}/services/api"
  fi
  if [[ "$scanner_exists" == true ]]; then
    info "Scanner image already exists for ${RELEASE_TAG}; immutable rebuild skipped."
  else
    "$CONTAINER_BUILDER" build --pull -t "$SCANNER_IMAGE_URI" "${BUILD_WORKTREE}/services/scanner/cmd/scanner"
  fi
  release_build_worktree
}

push_images() {
  phase IMAGES "Pushing immutable images"
  local api_exists=false scanner_exists=false
  aws ecr describe-images --repository-name "${STACK_NAME}-api" --image-ids imageTag="$RELEASE_TAG" >/dev/null 2>&1 && api_exists=true
  aws ecr describe-images --repository-name "${STACK_NAME}-scanner" --image-ids imageTag="$RELEASE_TAG" >/dev/null 2>&1 && scanner_exists=true
  if [[ "$api_exists" != true || "$scanner_exists" != true ]]; then ecr_login; fi
  if [[ "$api_exists" != true ]]; then "$CONTAINER_BUILDER" push "$API_IMAGE_URI"; fi
  if [[ "$scanner_exists" != true ]]; then "$CONTAINER_BUILDER" push "$SCANNER_IMAGE_URI"; fi
  local api_digest scanner_digest
  api_digest="$(aws ecr describe-images --repository-name "${STACK_NAME}-api" --image-ids imageTag="$RELEASE_TAG" --query 'imageDetails[0].imageDigest' --output text)"
  scanner_digest="$(aws ecr describe-images --repository-name "${STACK_NAME}-scanner" --image-ids imageTag="$RELEASE_TAG" --query 'imageDetails[0].imageDigest' --output text)"
  info "API image: ${API_IMAGE_URI} ${api_digest}"
  info "Scanner image: ${SCANNER_IMAGE_URI} ${scanner_digest}"
}

images_command() {
  authorize_mutation
  confirm_costs
  check_dns_delegation || return $?
  foundation_apply
  populate_generated_secrets
  build_images
  push_images
}

find_saved_staging_plan() {
  local plan_file="${LOG_DIR}/staging-${AWS_ACCOUNT_ID}-${GIT_SHA}.tfplan"
  [[ -f "$plan_file" ]] || die "No saved plan for account ${AWS_ACCOUNT_ID} and SHA ${GIT_SHA}. Run ./rebuild-aws.sh plan."
  printf '%s\n' "$plan_file"
}

verify_images_exist() {
  aws ecr describe-images --repository-name "${STACK_NAME}-api" --image-ids imageTag="$RELEASE_TAG" >/dev/null
  aws ecr describe-images --repository-name "${STACK_NAME}-scanner" --image-ids imageTag="$RELEASE_TAG" >/dev/null
}

terraform_apply() {
  phase TERRAFORM "Applying only the saved reviewed staging plan"
  authorize_mutation
  require_no_interrupted_apply
  confirm_costs
  require_stripe_test_credentials
  verify_images_exist
  local plan_file json_file
  plan_file="$(find_saved_staging_plan)"
  json_file="${plan_file%.tfplan}.apply-check.json"
  verify_postgres_compatibility "$(write_staging_tfvars)"
  inspect_saved_plan "$STAGING_DIR" "$plan_file" "$json_file"
  printf 'account=%s\nplan_sha256=%s\nstarted=%s\n' "$AWS_ACCOUNT_ID" "$(sha256sum "$plan_file" | awk '{print $1}')" "$(timestamp)" > "$APPLY_GUARD_FILE"
  terraform -chdir="$STAGING_DIR" apply -input=false "$plan_file"
  clear_apply_guard
}

tf_output() { terraform -chdir="$STAGING_DIR" output -raw "$1"; }

run_migrations() {
  phase DATABASE "Waiting for API startup migration deployment"
  local cluster api_service
  cluster="$(tf_output ecs_cluster_name)"
  api_service="$(tf_output api_service_name)"
  aws ecs wait services-stable --cluster "$cluster" --services "$api_service"
  local running desired
  read -r running desired < <(aws ecs describe-services --cluster "$cluster" --services "$api_service" --query 'services[0].[runningCount,desiredCount]' --output text)
  [[ "$running" == "$desired" && "$desired" -gt 0 ]] || die "API did not become healthy after prisma migrate deploy."
  info "Committed Prisma migrations completed through the API container startup path."
}

bootstrap_demo_account() {
  phase DATABASE "Optional guarded staging demo bootstrap"
  if [[ -z "${DEMO_ACCOUNT_PASSWORD:-}" ]]; then
    info "DEMO_ACCOUNT_PASSWORD is absent; demo account bootstrap skipped."
    return
  fi
  local password_hash
  password_hash="$($CONTAINER_BUILDER run --rm --entrypoint node -e DEMO_ACCOUNT_PASSWORD "$API_IMAGE_URI" -e 'import bcrypt from "bcrypt"; process.stdout.write(await bcrypt.hash(process.env.DEMO_ACCOUNT_PASSWORD,12));')"
  [[ "$password_hash" =~ ^\$2[aby]\$12\$[./A-Za-z0-9]{53}$ ]] || die "Local bcrypt hashing failed."
  local cluster service task_definition subnets security_groups override network task_arn exit_code
  cluster="$(tf_output ecs_cluster_name)"
  service="$(tf_output api_service_name)"
  task_definition="$(aws ecs describe-services --cluster "$cluster" --services "$service" --query 'services[0].taskDefinition' --output text)"
  subnets="$(aws ecs describe-services --cluster "$cluster" --services "$service" --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' --output json)"
  security_groups="$(aws ecs describe-services --cluster "$cluster" --services "$service" --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' --output json)"
  override="$(mktemp "${TMPDIR:-/tmp}/privacyready-demo-override.XXXXXX.json")"
  DEMO_OVERRIDE_FILE="$override"
  chmod 600 "$override"
  jq -n --arg name "${STACK_NAME}-api" --arg hash "$password_hash" '{containerOverrides:[{name:$name,command:["node","dist/scripts/bootstrap-staging-demo.js"],environment:[{name:"NODE_ENV",value:"staging"},{name:"STAGING_DEMO_BOOTSTRAP",value:"true"},{name:"DEMO_ACCOUNT_PASSWORD_HASH",value:$hash}]}]}' > "$override"
  unset password_hash
  network="$(jq -cn --argjson subnets "$subnets" --argjson groups "$security_groups" '{awsvpcConfiguration:{subnets:$subnets,securityGroups:$groups,assignPublicIp:"DISABLED"}}')"
  task_arn="$(aws ecs run-task --cluster "$cluster" --task-definition "$task_definition" --launch-type FARGATE --network-configuration "$network" --overrides "file://${override}" --query 'tasks[0].taskArn' --output text)"
  rm -f -- "$override"
  DEMO_OVERRIDE_FILE=""
  [[ "$task_arn" == arn:aws:ecs:* ]] || die "Demo bootstrap task did not start."
  aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task_arn"
  exit_code="$(aws ecs describe-tasks --cluster "$cluster" --tasks "$task_arn" --query 'tasks[0].containers[0].exitCode' --output text)"
  [[ "$exit_code" == 0 ]] || die "Guarded staging demo bootstrap failed."
  info "Demo account created/updated as ADMIN for DQVentures. Password was never displayed."
}

deploy_application() {
  terraform_apply
  run_migrations
  bootstrap_demo_account
}

deploy_frontend() {
  phase FRONTEND "Building and deploying the private CloudFront frontend"
  authorize_mutation
  terraform_backend_init "$STAGING_DIR" "environments/staging/terraform.tfstate" >/dev/null
  local bucket distribution
  bucket="$(tf_output frontend_bucket_name)"
  distribution="$(tf_output cloudfront_distribution_id)"
  [[ "$bucket" == "${STACK_NAME}-frontend-${AWS_ACCOUNT_ID}" ]] || die "Unexpected frontend bucket output."
  npm --prefix "$FRONTEND_DIR" ci
  VITE_API_URL="https://${API_HOSTNAME}" VITE_MARKETING_URL="https://${FRONTEND_HOSTNAME}" npm --prefix "$FRONTEND_DIR" run build
  if rg -n 'SCANNER_API_KEY|privacyready\.local' "${FRONTEND_DIR}/dist"; then die "Built frontend exposes a scanner credential name or private hostname."; fi
  aws s3 sync "${FRONTEND_DIR}/dist/" "s3://${bucket}/" --delete --only-show-errors
  local invalidation
  invalidation="$(aws cloudfront create-invalidation --distribution-id "$distribution" --paths '/*' --query 'Invalidation.Id' --output text)"
  aws cloudfront wait invalidation-completed --distribution-id "$distribution" --id "$invalidation"
  info "Frontend deployed and CloudFront invalidation completed."
}

wait_for_acm_issued() {
  local certificate_arn="$1" region="$2" attempt status
  for attempt in $(seq 1 30); do
    status="$(aws acm describe-certificate --region "$region" --certificate-arn "$certificate_arn" --query 'Certificate.Status' --output text)"
    [[ "$status" == ISSUED ]] && return 0
    [[ "$status" == FAILED ]] && die "ACM certificate validation failed in ${region}."
    info "ACM ${region} status ${status}; bounded wait ${attempt}/30."
    sleep 10
  done
  die "ACM certificate was not ISSUED after five minutes. DNS may still be propagating; rerun verify later."
}

wait_for_ses_verified() {
  local identity="$1" attempt status
  for attempt in $(seq 1 30); do
    status="$(aws sesv2 get-email-identity --email-identity "$identity" --query 'VerifiedForSendingStatus' --output text)"
    [[ "$status" == True ]] && return 0
    info "SES identity verification status ${status}; bounded wait ${attempt}/30."
    sleep 10
  done
  die "SES identity was not verified after five minutes. Rerun verify after DNS propagation."
}

wait_for_cloudfront_deployed() {
  local distribution="$1" attempt status
  for attempt in $(seq 1 30); do
    status="$(aws cloudfront get-distribution --id "$distribution" --query 'Distribution.Status' --output text)"
    [[ "$status" == Deployed ]] && return 0
    info "CloudFront status ${status}; bounded wait ${attempt}/30."
    sleep 10
  done
  die "CloudFront was not deployed after five minutes. Rerun verify later."
}

verify_infrastructure() {
  phase VERIFY "Verifying AWS infrastructure"
  terraform_backend_init "$STAGING_DIR" "environments/staging/terraform.tfstate" >/dev/null
  local cluster api_service scanner_service db target api_cert frontend_cert distribution web_acl ses_identity
  cluster="$(tf_output ecs_cluster_name)"; api_service="$(tf_output api_service_name)"; scanner_service="$(tf_output scanner_service_name)"
  db="$(tf_output rds_instance_id)"; target="$(tf_output api_target_group_arn)"; api_cert="$(tf_output api_certificate_arn)"
  frontend_cert="$(tf_output frontend_certificate_arn)"; distribution="$(tf_output cloudfront_distribution_id)"; web_acl="$(tf_output web_acl_arn)"; ses_identity="$(tf_output ses_domain_identity)"
  local db_metadata expected_engine expected_class
  expected_engine="$(tf_output rds_engine_version)"
  expected_class="$(tf_output rds_instance_class)"
  db_metadata="$(aws rds describe-db-instances --db-instance-identifier "$db" --query 'DBInstances[0].{Status:DBInstanceStatus,Public:PubliclyAccessible,Encrypted:StorageEncrypted,MultiAZ:MultiAZ,Class:DBInstanceClass,Storage:AllocatedStorage,Type:StorageType}' --output json)"
  jq -e --arg engine_class "$expected_class" '.Status=="available" and .Public==false and .Encrypted==true and .MultiAZ==false and .Class==$engine_class and .Storage==20 and .Type=="gp3"' <<<"$db_metadata" >/dev/null
  aws rds describe-db-instances --db-instance-identifier "$db" --query 'DBInstances[0].EngineVersion' --output text | grep -Fqx "$expected_engine"
  local api_counts scanner_counts
  api_counts="$(aws ecs describe-services --cluster "$cluster" --services "$api_service" --query 'services[0].[desiredCount,runningCount]' --output text)"
  scanner_counts="$(aws ecs describe-services --cluster "$cluster" --services "$scanner_service" --query 'services[0].[desiredCount,runningCount]' --output text)"
  [[ "${api_counts%%$'\t'*}" == "${api_counts##*$'\t'}" ]] || die "API ECS desired/running counts differ."
  [[ "${scanner_counts%%$'\t'*}" == "${scanner_counts##*$'\t'}" ]] || die "Scanner ECS desired/running counts differ."
  local target_health
  target_health="$(aws elbv2 describe-target-health --target-group-arn "$target")"
  [[ "$(jq '.TargetHealthDescriptions|length' <<<"$target_health")" -gt 0 ]] || die "API target group has no registered targets."
  [[ "$(jq '[.TargetHealthDescriptions[] | select(.TargetHealth.State != "healthy")]|length' <<<"$target_health")" -eq 0 ]] || die "API target group has unhealthy targets."
  wait_for_acm_issued "$api_cert" "$AWS_REGION"
  wait_for_acm_issued "$frontend_cert" us-east-1
  wait_for_cloudfront_deployed "$distribution"
  aws wafv2 get-web-acl-for-resource --resource-arn "$(aws elbv2 describe-load-balancers --names "${STACK_NAME}-alb" --query 'LoadBalancers[0].LoadBalancerArn' --output text)" --query 'WebACL.ARN' --output text | grep -Fqx "$web_acl"
  wait_for_ses_verified "$ses_identity"
  info "AWS infrastructure checks passed."
}

verify_dns() {
  phase VERIFY "Verifying DNS"
  check_dns_delegation
  local records
  records="$(aws route53 list-resource-record-sets --hosted-zone-id "$HOSTED_ZONE_ID")"
  [[ "$(jq --arg name "${API_HOSTNAME}." '[.ResourceRecordSets[] | select(.Name==$name and .Type=="A")]|length' <<<"$records")" -eq 1 ]] || die "Route53 API alias record is missing."
  [[ "$(jq --arg name "${FRONTEND_HOSTNAME}." '[.ResourceRecordSets[] | select(.Name==$name and .Type=="A")]|length' <<<"$records")" -eq 1 ]] || die "Route53 frontend alias record is missing."
  dig +short A "$API_HOSTNAME" @1.1.1.1 | grep -q .
  dig +short A "$FRONTEND_HOSTNAME" @1.1.1.1 | grep -q .
}

verify_application() {
  phase VERIFY "Verifying HTTPS application endpoints"
  [[ "$(curl -sS -o /dev/null -w '%{http_code}' "https://${API_HOSTNAME}/health")" == 200 ]] || die "API health endpoint is not HTTP 200."
  [[ "$(curl -sS -o /dev/null -w '%{http_code}' "https://${FRONTEND_HOSTNAME}/")" == 200 ]] || die "Frontend is not HTTP 200."
  [[ "$(curl -sS -o /dev/null -w '%{http_code}' "https://${FRONTEND_HOSTNAME}/login")" == 200 ]] || die "SPA login route is not HTTP 200."
  local redirect
  redirect="$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "http://${API_HOSTNAME}/health")"
  [[ "$redirect" == 301\ https://* || "$redirect" == 302\ https://* ]] || die "API HTTP does not redirect to HTTPS."
  local cors_headers blocked_origin_code
  cors_headers="$(curl --max-time 20 -sS -D - -o /dev/null -H "Origin: https://${FRONTEND_HOSTNAME}" "https://${API_HOSTNAME}/health")"
  grep -Fqi "access-control-allow-origin: https://${FRONTEND_HOSTNAME}" <<<"$cors_headers" || die "Staging frontend origin is not allowed by CORS."
  grep -Fqi 'access-control-allow-credentials: true' <<<"$cors_headers" || die "Credentialed CORS is not enabled for the staging frontend."
  blocked_origin_code="$(curl --max-time 20 -sS -o /dev/null -w '%{http_code}' -H 'Origin: https://evil.invalid' -H 'content-type: application/json' --data '{}' "https://${API_HOSTNAME}/api/auth/login")"
  [[ "$blocked_origin_code" == 403 ]] || die "Unapproved browser origin was not rejected with HTTP 403."
}

verify_ecs_secret_contract() {
  local cluster api_service scanner_service api_task scanner_task api_json scanner_json api_role scanner_role api_policy scanner_policy discovery_arn
  cluster="$(tf_output ecs_cluster_name)"
  api_service="$(tf_output api_service_name)"
  scanner_service="$(tf_output scanner_service_name)"
  discovery_arn="$(tf_output scanner_discovery_service_arn)"
  api_task="$(aws ecs describe-services --cluster "$cluster" --services "$api_service" --query 'services[0].taskDefinition' --output text)"
  scanner_task="$(aws ecs describe-services --cluster "$cluster" --services "$scanner_service" --query 'services[0].taskDefinition' --output text)"
  api_json="$(aws ecs describe-task-definition --task-definition "$api_task")"
  scanner_json="$(aws ecs describe-task-definition --task-definition "$scanner_task")"
  [[ "$(jq -r '.taskDefinition.containerDefinitions[0].secrets[].name' <<<"$api_json" | sort | paste -sd, -)" == 'DB_PASSWORD,JWT_SECRET,SCANNER_API_KEY,STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET' ]] || die "API ECS secret injection does not match the approved five-secret contract."
  [[ "$(jq -r '.taskDefinition.containerDefinitions[0].secrets[].name' <<<"$scanner_json" | sort | paste -sd, -)" == 'SCANNER_API_KEY' ]] || die "Scanner ECS must receive only SCANNER_API_KEY."
  jq -e '.taskDefinition.containerDefinitions[0].secrets[] | select(.name=="DB_PASSWORD") | .valueFrom | endswith(":password::")' <<<"$api_json" >/dev/null || die "DB_PASSWORD is not using RDS managed-secret JSON extraction."
  aws ecs describe-services --cluster "$cluster" --services "$scanner_service" --query 'services[0].serviceRegistries[0].registryArn' --output text | grep -Fqx "$discovery_arn"
  api_role="$(jq -r '.taskDefinition.executionRoleArn | split("/")[-1]' <<<"$api_json")"
  scanner_role="$(jq -r '.taskDefinition.executionRoleArn | split("/")[-1]' <<<"$scanner_json")"
  api_policy="$(aws iam get-role-policy --role-name "$api_role" --policy-name runtime --query PolicyDocument --output json)"
  scanner_policy="$(aws iam get-role-policy --role-name "$scanner_role" --policy-name runtime --query PolicyDocument --output json)"
  jq -e '[.Statement[] | select((.Action|type)=="array" and (.Action|index("secretsmanager:GetSecretValue"))) | .Resource] as $resources | ($resources|length)==1 and ($resources[0]|type)=="array" and ($resources[0]|length)==5 and all($resources[0][]; .!="*")' <<<"$api_policy" >/dev/null || die "API execution role secret access is not scoped to exactly five ARNs."
  jq -e '[.Statement[] | select((.Action|type)=="array" and (.Action|index("secretsmanager:GetSecretValue"))) | .Resource] as $resources | ($resources|length)==1 and ($resources[0]|type)=="array" and ($resources[0]|length)==1 and all($resources[0][]; .!="*")' <<<"$scanner_policy" >/dev/null || die "Scanner execution role secret access is not scoped to one ARN."
}

security_checks() {
  phase VERIFY "Running non-destructive security checks"
  local cluster bucket distribution alb_sg api_sg scanner_sg rds_sg
  verify_configuration_contracts
  verify_ecs_secret_contract
  cluster="$(tf_output ecs_cluster_name)"; bucket="$(tf_output frontend_bucket_name)"; distribution="$(tf_output cloudfront_distribution_id)"
  alb_sg="$(tf_output alb_security_group_id)"; api_sg="$(tf_output api_security_group_id)"; scanner_sg="$(tf_output scanner_security_group_id)"; rds_sg="$(tf_output rds_security_group_id)"
  local services
  services="$(aws ecs list-services --cluster "$cluster" --query 'serviceArns[]' --output text)"
  local service
  for service in $services; do
    aws ecs describe-services --cluster "$cluster" --services "$service" --query 'services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp' --output text | grep -qx DISABLED
    if [[ "$service" == *scanner ]]; then
      aws ecs describe-services --cluster "$cluster" --services "$service" --query 'length(services[0].loadBalancers)' --output text | grep -qx 0
    fi
    local image
    image="$(aws ecs describe-task-definition --task-definition "$(aws ecs describe-services --cluster "$cluster" --services "$service" --query 'services[0].taskDefinition' --output text)" --query 'taskDefinition.containerDefinitions[0].image' --output text)"
    [[ "$image" != *:latest ]] || die "ECS task uses forbidden :latest image."
  done
  aws ec2 describe-security-group-rules --filters Name=group-id,Values="$rds_sg" --query 'length(SecurityGroupRules[?IsEgress==`false` && ReferencedGroupInfo.GroupId!=`'$api_sg'`])' --output text | grep -qx 0
  aws ec2 describe-security-group-rules --filters Name=group-id,Values="$scanner_sg" --query 'length(SecurityGroupRules[?IsEgress==`false` && ReferencedGroupInfo.GroupId!=`'$api_sg'`])' --output text | grep -qx 0
  aws ec2 describe-security-groups --group-ids "$alb_sg" "$api_sg" "$scanner_sg" "$rds_sg" --query 'length(SecurityGroups[].IpPermissionsEgress[?IpProtocol==`-1` && IpRanges[?CidrIp==`0.0.0.0/0`]])' --output text | grep -qx 0
  aws s3api get-public-access-block --bucket "$bucket" --query 'PublicAccessBlockConfiguration' --output json | jq -e 'all(.[]; . == true)' >/dev/null
  aws cloudfront get-distribution --id "$distribution" --query 'Distribution.DistributionConfig.Origins.Items[0].OriginAccessControlId' --output text | grep -vq '^None$'
  if rg -n --glob '*.tf' '(sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|JWT_SECRET[[:space:]]*=[[:space:]]*"[^$])' "$ROOT_DIR/terraform"; then die "Potential plaintext application secret found in Terraform."; fi
  info "AWS security posture checks passed."
}

verify_scanner() {
  phase VERIFY "Checking scanner hardening and anonymous rate limiting"
  ecr_login
  "$CONTAINER_BUILDER" run --rm --entrypoint python "$SCANNER_IMAGE_URI" -m unittest discover -s tests -v
  local endpoint="https://${API_HOSTNAME}/api/public/scan" code
  local target
  for target in 'http://127.0.0.1' 'http://[::1]' 'http://10.0.0.1' 'http://169.254.169.254/latest/meta-data/' 'http://user:pass@example.com' 'file:///etc/passwd' 'ftp://example.com'; do
    code="$(jq -n --arg target "$target" '{targetIdentifier:$target,scanType:"website"}' | curl --max-time 30 -sS -o /dev/null -w '%{http_code}' -H 'content-type: application/json' --data-binary @- "$endpoint")"
    [[ ! "$code" =~ ^2 ]] || die "Scanner accepted prohibited target ${target}."
  done
  local rate_limited=false attempt
  for attempt in $(seq 1 11); do
    code="$(curl --max-time 45 -sS -o /dev/null -w '%{http_code}' -H 'content-type: application/json' --data '{"targetIdentifier":"https://example.net:9","scanType":"website"}' "$endpoint")"
    if [[ "$code" == 429 ]]; then rate_limited=true; break; fi
    [[ "$code" =~ ^2 || "$code" == 400 ]] || die "Anonymous scanner rate-limit probe returned unexpected HTTP ${code}."
  done
  [[ "$rate_limited" == true ]] || die "Anonymous scanner did not rate-limit repeated requests."
  info "Scanner unit, SSRF, redirect, DNS-rebinding, response-size and anonymous-rate-limit checks passed."
}

verify_homepage_claim_flow() {
  phase VERIFY "Checking homepage scan and one-time claim contract"
  local response claim_token claim_code
  response="$(curl --max-time 60 -sS -f -H 'content-type: application/json' --data '{"targetIdentifier":"https://example.com","scanType":"website"}' "https://${API_HOSTNAME}/api/public/scan")"
  jq -e '.id and (.claimToken | (type=="string" and test("^[a-f0-9]{64}$"))) and .targetIdentifier' <<<"$response" >/dev/null || die "Public scan response lacks the server-persisted scan ID or one-time claim token."
  if grep -Eq 'SCANNER_API_KEY|privacyready\.local' <<<"$response"; then die "Public scan response exposes scanner internals."; fi
  claim_token="$(jq -r '.claimToken' <<<"$response")"
  claim_code="$(jq -n --arg claimToken "$claim_token" '{claimToken:$claimToken}' | curl --max-time 20 -sS -o /dev/null -w '%{http_code}' -H 'content-type: application/json' --data-binary @- "https://${API_HOSTNAME}/api/scan/claim")"
  unset claim_token response
  [[ "$claim_code" == 401 ]] || die "Unauthenticated claim endpoint did not reject the one-time token."
  info "Homepage scan persistence, body-only claim token, and unauthenticated-claim rejection checks passed."
}

cost_summary() {
  phase VERIFY "Cost summary"
  info "Chargeable services include NAT Gateway, ALB, RDS, Fargate, WAF and CloudFront. Review AWS Cost Explorer and Budgets after deployment."
}

recover_staging() {
  phase RECOVER "Inspecting staging state and AWS drift without mutation"
  terraform_init
  backup_staging_state recover
  verify_staging_state_scope false
  local tfvars refresh_plan refresh_json refresh_text refresh_status tag_json state_strings aws_arns matched_arns untracked_arns
  tfvars="$(write_staging_tfvars)"
  refresh_plan="${STATE_BACKUP_DIR}/refresh-only.tfplan"
  refresh_json="${STATE_BACKUP_DIR}/refresh-only.json"
  refresh_text="${STATE_BACKUP_DIR}/refresh-only.txt"
  set +e
  terraform -chdir="$STAGING_DIR" plan -refresh-only -lock=false -input=false -detailed-exitcode -out="$refresh_plan" -var-file="$tfvars" > "$refresh_text" 2>&1
  refresh_status=$?
  set -e
  [[ "$refresh_status" == 0 || "$refresh_status" == 2 ]] || die "Refresh-only planning failed. Review ${refresh_text}."
  terraform -chdir="$STAGING_DIR" show -json "$refresh_plan" > "$refresh_json"
  local drift_count missing_from_aws_count
  drift_count="$(jq '[.resource_changes[]? | select(.change.actions != ["no-op"] and .change.actions != ["read"])] | length' "$refresh_json")"
  missing_from_aws_count="$(jq '[.resource_changes[]? | select(.change.actions == ["delete"])] | length' "$refresh_json")"
  jq -r '.resource_changes[]? | select(.change.actions != ["no-op"] and .change.actions != ["read"]) | "\(.address)\t\(.change.actions|join(","))"' "$refresh_json" > "${STATE_BACKUP_DIR}/drift.tsv"

  tag_json="${STATE_BACKUP_DIR}/aws-tagged-staging.json"
  aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=privacyready Key=Environment,Values=staging > "$tag_json"
  state_strings="${STATE_BACKUP_DIR}/state-strings.txt"
  aws_arns="${STATE_BACKUP_DIR}/aws-tagged-arns.txt"
  matched_arns="${STATE_BACKUP_DIR}/aws-and-state-arns.txt"
  untracked_arns="${STATE_BACKUP_DIR}/aws-not-in-state-arns.txt"
  jq -r '.. | strings' "${STATE_BACKUP_DIR}/staging.tfstate" | sort -u > "$state_strings"
  jq -r '.ResourceTagMappingList[].ResourceARN' "$tag_json" | sort -u > "$aws_arns"
  : > "$matched_arns"
  : > "$untracked_arns"
  local arn
  while IFS= read -r arn; do
    [[ -n "$arn" ]] || continue
    if grep -Fqx "$arn" "$state_strings"; then printf '%s\n' "$arn" >> "$matched_arns"; else printf '%s\n' "$arn" >> "$untracked_arns"; fi
  done < "$aws_arns"
  local tracked_count untracked_count
  tracked_count="$(wc -l < "$matched_arns")"
  untracked_count="$(wc -l < "$untracked_arns")"
  info "Refresh-only drift actions: ${drift_count}"
  info "State resources apparently absent from AWS: ${missing_from_aws_count}"
  info "Tagged AWS resources represented in state: ${tracked_count}"
  info "Tagged AWS resources not represented in state: ${untracked_count}"
  if ((drift_count == 0 && untracked_count == 0)); then
    clear_apply_guard
    info "Recovery assessment: state and discoverable AWS resources are consistent. Next: ./rebuild-aws.sh plan"
  else
    warn "Recovery assessment found drift or AWS/state mismatches. Review ${STATE_BACKUP_DIR}."
    warn "Do not import, remove state, or apply until each listed resource is reconciled with the current staging configuration."
  fi
  info "Recover is read-only: refresh state was NOT applied, and no import/state-rm command was run."
}

report_remaining_chargeable_resources() {
  phase DESTROY "Checking remaining staging chargeable resources"
  local nat_count alb_count rds_count eip_count cloudfront_count waf_count ecs_count ecr_count frontend_bucket_count cf_json
  nat_count="$(aws ec2 describe-nat-gateways --filter Name=tag:Project,Values=privacyready Name=tag:Environment,Values=staging Name=state,Values=pending,available,deleting --query 'length(NatGateways)' --output text)"
  eip_count="$(aws ec2 describe-addresses --filters Name=tag:Project,Values=privacyready Name=tag:Environment,Values=staging --query 'length(Addresses)' --output text)"
  alb_count="$(aws elbv2 describe-load-balancers --query 'length(LoadBalancers[?starts_with(LoadBalancerName, `privacyready-staging`)])' --output text)"
  rds_count="$(aws rds describe-db-instances --query 'length(DBInstances[?starts_with(DBInstanceIdentifier, `privacyready-staging`)])' --output text)"
  cf_json="$(aws cloudfront list-distributions)"
  cloudfront_count="$(jq --arg alias "$FRONTEND_HOSTNAME" '[.DistributionList.Items[]? | select((.Aliases.Items // []) | index($alias))] | length' <<<"$cf_json")"
  waf_count="$(aws wafv2 list-web-acls --scope REGIONAL --query 'length(WebACLs[?starts_with(Name, `privacyready-staging`)])' --output text)"
  ecs_count="$(aws ecs list-clusters --query 'length(clusterArns[?ends_with(@, `/privacyready-staging`)])' --output text)"
  ecr_count="$(aws ecr describe-repositories --query 'length(repositories[?starts_with(repositoryName, `privacyready-staging`)])' --output text 2>/dev/null || printf 0)"
  frontend_bucket_count="$(aws s3api list-buckets --query 'length(Buckets[?starts_with(Name, `privacyready-staging-frontend-`)])' --output text)"
  info "Remaining staging NAT gateways: ${nat_count}"
  info "Remaining staging EIPs: ${eip_count}"
  info "Remaining staging ALBs: ${alb_count}"
  info "Remaining staging RDS instances: ${rds_count}"
  info "Remaining staging ECS clusters: ${ecs_count}"
  info "Remaining staging ECR repositories: ${ecr_count}"
  info "Remaining staging frontend buckets: ${frontend_bucket_count}"
  info "Remaining staging CloudFront distributions: ${cloudfront_count}"
  info "Remaining staging WAF ACLs: ${waf_count}"
  info "The account-specific Terraform backend and privacyready.co.uk hosted zone were deliberately preserved."
}

destroy_staging() {
  phase DESTROY "Preparing saved staging-only destroy plan"
  authorize_mutation
  require_no_interrupted_apply
  terraform_init
  backup_staging_state destroy
  verify_staging_state_scope true
  local tfvars plan_file json_file destroy_count confirmation
  tfvars="$(write_staging_tfvars)"
  plan_file="${STATE_BACKUP_DIR}/staging-destroy.tfplan"
  json_file="${STATE_BACKUP_DIR}/staging-destroy.json"
  terraform -chdir="$STAGING_DIR" plan -destroy -input=false -out="$plan_file" -var-file="$tfvars"
  inspect_destroy_plan "$STAGING_DIR" "$plan_file" "$json_file"
  destroy_count="$(jq '[.resource_changes[]? | select(.change.actions | index("delete"))] | length' "$json_file")"
  cat <<EOF

This will destroy ${destroy_count} Terraform-managed STAGING resources in AWS account ${AWS_ACCOUNT_ID}.
It preserves the Terraform backend and Route53 hosted zone, which use separate state roots.
Names.co.uk is never modified. There is no non-interactive bypass for this confirmation.
EOF
  [[ -t 0 ]] || die "Destroy requires an interactive terminal and typed account confirmation."
  read -r -p "Type DESTROY STAGING ${AWS_ACCOUNT_ID} to apply the saved destroy plan: " confirmation
  [[ "$confirmation" == "DESTROY STAGING ${AWS_ACCOUNT_ID}" ]] || die "Destroy confirmation did not match exactly."
  printf 'account=%s\nplan_sha256=%s\nstarted=%s\n' "$AWS_ACCOUNT_ID" "$(sha256sum "$plan_file" | awk '{print $1}')" "$(timestamp)" > "$APPLY_GUARD_FILE"
  terraform -chdir="$STAGING_DIR" apply -input=false "$plan_file"
  clear_apply_guard
  [[ -z "$(terraform -chdir="$STAGING_DIR" state list)" ]] || die "Staging state is not empty after destroy; run recover and inspect."
  report_remaining_chargeable_resources
}

verify_all() {
  verify_infrastructure
  verify_dns
  verify_application
  security_checks
  verify_homepage_claim_flow
  verify_scanner
  cost_summary
}

preflight() {
  require_tools
  check_repository_layout
  verify_configuration_contracts
  check_git
  check_aws_identity
  check_region
}

all_command() {
  preflight
  authorize_mutation
  confirm_costs
  bootstrap_backend
  bootstrap_dns
  check_dns_delegation || return $?
  images_command
  terraform_plan
  require_stripe_test_credentials
  deploy_application
  deploy_frontend
  verify_all
}

main() {
  COMMAND="${1:-help}"
  case "$COMMAND" in help|-h|--help) usage; return 0;; esac
  [[ $# -eq 1 ]] || die "Exactly one command is required. Run ./rebuild-aws.sh help."
  start_logging
  case "$COMMAND" in
    check) preflight ;;
    bootstrap) preflight; bootstrap_backend ;;
    dns) preflight; bootstrap_dns; check_dns_delegation || return $? ;;
    plan) preflight; load_dns_outputs; terraform_plan ;;
    deploy) preflight; load_dns_outputs; check_dns_delegation || return $?; terraform_init; deploy_application ;;
    images) preflight; load_dns_outputs; images_command ;;
    frontend) preflight; deploy_frontend ;;
    verify) preflight; verify_all ;;
    recover) preflight; recover_staging ;;
    destroy) preflight; destroy_staging ;;
    all) all_command ;;
    *) usage >&2; die "Unknown command: $COMMAND" ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
