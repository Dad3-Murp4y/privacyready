#!/bin/bash
set -e

ENV=${ENV:-test}

if [ "$ENV" = "production" ]; then
  DB_ID="privacyready-db"
else
  DB_ID="privacyready-test-db"
fi

echo "=== PrivacyReady Teardown ($ENV) ==="
echo "This script will STOP the main RDS instance, and DESTROY the ALB, ECS service, and SaaS NAT Gateways to save costs. GitLab remains fully online."
echo ""

# Stop Main RDS Instance
echo "3. Stopping main RDS database instance ($DB_ID)..."
DB_STATUS=$(aws rds describe-db-instances --db-instance-identifier "$DB_ID" --query "DBInstances[0].DBInstanceStatus" --output text 2>/dev/null || true)
if [ "$DB_STATUS" == "available" ]; then
  aws rds stop-db-instance --db-instance-identifier "$DB_ID"
  echo "Main RDS stop command sent."
else
  echo "Main RDS instance is not available or already stopped (Status: $DB_STATUS)."
fi

# Destroy Terraform expensive resources
echo "1. Destroying expensive Terraform resources (ALB, ECS services, SaaS NAT Gateways)..."
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR/../terraform/environments/$ENV"
terraform init
terraform destroy \
  -target=aws_lb.main \
  -target=aws_ecs_service.app \
  -target=aws_ecs_service.scanner \
  -target=aws_ecs_service.dsr \
  -target=aws_nat_gateway.staging \
  -target=aws_nat_gateway.main \
  -auto-approve

echo "=== Teardown Complete ==="
echo "Your codebase and GitLab instance are completely safe and online. Expensive SaaS resources (ALB, ECS, NAT Gateways) are destroyed and the SaaS database is stopped to minimize costs."
