#!/usr/bin/env bash
# =============================================================================
# post-import.sh  —  privacyready
#
# Run this script AFTER `terraform apply` completes to re-import persistent
# resources back into Terraform state.
#
# Resources re-imported:
#   1. aws_route53_zone.main       — existing hosted zone (avoids duplicate creation)
#   2. aws_instance.gitlab[0]      — existing EC2 instance with GitLab data intact
#
# Usage:
#   terraform apply              # deploy fresh infra (zone/instance won't be touched)
#   scripts/post-import.sh       # re-attach persistent resources to state
#   terraform apply              # reconcile any drift (records, tags, etc.)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

DOMAIN=$(terraform output -raw domain_name 2>/dev/null || grep 'domain_name' terraform.tfvars 2>/dev/null | awk -F'"' '{print $2}' || echo "")
WORKSPACE=$(terraform workspace show)

echo "==> Workspace: $WORKSPACE"
echo "==> Domain:    ${DOMAIN:-<unknown>}"
echo ""

# ── 1. Route 53 hosted zone ──────────────────────────────────────────────────
if terraform state list 2>/dev/null | grep -q '^aws_route53_zone\.main$'; then
  echo "==> aws_route53_zone.main already in state, skipping import"
else
  if [ -z "$DOMAIN" ]; then
    echo "ERROR: Could not determine domain name. Set DOMAIN env var and re-run:"
    echo "  DOMAIN=privacyready.co.uk scripts/post-import.sh"
    exit 1
  fi
  ZONE_ID="${ROUTE53_ZONE_ID:-}"
  if [ -z "$ZONE_ID" ]; then
    echo "==> Looking up hosted zone for ${DOMAIN}..."
    ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "${DOMAIN}." \
      --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text | sed 's|/hostedzone/||')
  fi
  if [ -z "$ZONE_ID" ]; then
    echo "ERROR: Could not find Route 53 hosted zone for ${DOMAIN}."
    echo "  If the zone was never created, run: terraform apply (it will create it)"
    exit 1
  fi
  echo "==> Importing Route 53 zone ${ZONE_ID} (${DOMAIN})..."
  terraform import aws_route53_zone.main "$ZONE_ID"
fi

# ── 2. GitLab EC2 instance ───────────────────────────────────────────────────
if terraform state list 2>/dev/null | grep -q '^aws_instance\.gitlab\[0\]$'; then
  echo "==> aws_instance.gitlab[0] already in state, skipping import"
else
  INSTANCE_ID="${GITLAB_INSTANCE_ID:-}"
  if [ -z "$INSTANCE_ID" ]; then
    echo "==> Looking up stopped GitLab EC2 instance by tag..."
    INSTANCE_ID=$(aws ec2 describe-instances \
      --filters "Name=tag:Name,Values=privacyready-gitlab-primary" \
                "Name=instance-state-name,Values=stopped,stopping,running" \
      --query 'Reservations[0].Instances[0].InstanceId' --output text)
  fi
  if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
    echo "==> No stopped GitLab instance found. It will be created fresh by terraform apply."
  else
    echo "==> Importing GitLab EC2 instance ${INSTANCE_ID}..."
    terraform import 'aws_instance.gitlab[0]' "$INSTANCE_ID"
    echo "==> Starting instance..."
    aws ec2 start-instances --instance-ids "$INSTANCE_ID" --output text --query 'StartingInstances[0].CurrentState.Name'
  fi
fi

echo ""
echo "✅  Import complete. Run 'terraform apply' once more to reconcile any tag/config drift."
