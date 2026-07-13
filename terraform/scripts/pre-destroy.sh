#!/usr/bin/env bash
# =============================================================================
# pre-destroy.sh  —  privacyready
#
# Run this script BEFORE `terraform destroy` to safely remove persistent
# resources from Terraform state without deleting them from AWS.
#
# Resources protected:
#   1. aws_route53_zone.main       — keeps your NS records, no re-delegation needed
#   2. aws_instance.gitlab[0]      — keeps the EC2 instance + EBS data volumes
#
# After running terraform destroy you can bring everything back up with:
#   terraform apply && scripts/post-import.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

WORKSPACE=$(terraform workspace show)
echo "==> Workspace: $WORKSPACE"

# ── 1. Route 53 hosted zone ──────────────────────────────────────────────────
if terraform state list | grep -q '^aws_route53_zone\.main$'; then
  ZONE_ID=$(terraform state show aws_route53_zone.main | grep '^\s*zone_id' | awk '{print $3}' | tr -d '"')
  echo "==> Removing Route 53 zone ${ZONE_ID} from state (zone stays in AWS)"
  terraform state rm aws_route53_zone.main

  # Also remove any Route 53 records and DNSSEC resources that reference the zone.
  ROUTE53_RESOURCES=$(terraform state list 2>/dev/null | grep -E '^aws_route53_|^aws_kms_key\.dnssec$|^aws_route53_hosted_zone_dnssec\.|^aws_route53_key_signing_key\.' || true)
  if [ -n "$ROUTE53_RESOURCES" ]; then
    echo "==> Removing dependent Route 53 / DNSSEC resources from state..."
    # shellcheck disable=SC2086
    terraform state rm $ROUTE53_RESOURCES
  fi
else
  echo "==> aws_route53_zone.main not in state, skipping"
fi

# ── 2. GitLab EC2 instance ───────────────────────────────────────────────────
if terraform state list | grep -q '^aws_instance\.gitlab\[0\]$'; then
  INSTANCE_ID=$(terraform state show 'aws_instance.gitlab[0]' | grep '^\s*id\s' | awk '{print $3}' | tr -d '"')
  echo "==> Stopping GitLab EC2 instance ${INSTANCE_ID}..."
  aws ec2 stop-instances --instance-ids "$INSTANCE_ID" --output text --query 'StoppingInstances[0].CurrentState.Name'
  echo "==> Removing GitLab EC2 instance ${INSTANCE_ID} from state (instance stays in AWS)"
  terraform state rm 'aws_instance.gitlab[0]'
else
  echo "==> aws_instance.gitlab[0] not in state, skipping"
fi

echo ""
echo "✅  Persistent resources removed from state. Safe to run terraform destroy."
echo "    Persistent resources still exist in AWS:"
echo "      - Route 53 hosted zone (nameservers unchanged)"
echo "      - GitLab EC2 instance (stopping / stopped)"
echo ""
echo "    When done, re-deploy with:"
echo "      terraform apply"
echo "      scripts/post-import.sh"
