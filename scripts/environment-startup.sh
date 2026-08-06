#!/bin/bash
set -e

ENV=${ENV:-test}

if [ "$ENV" = "production" ]; then
  DB_ID="privacyready-db"
else
  DB_ID="privacyready-test-db"
fi

echo "=== PrivacyReady Startup ($ENV) ==="
echo "This script will START the main RDS instance, and RECREATE the ALB, ECS service, and SaaS NAT Gateways using Terraform."
echo ""

# Start Main RDS Instance
echo "3. Starting main RDS database instance ($DB_ID)..."
DB_STATUS=$(aws rds describe-db-instances --db-instance-identifier "$DB_ID" --query "DBInstances[0].DBInstanceStatus" --output text 2>/dev/null || true)
if [ "$DB_STATUS" == "stopped" ]; then
  aws rds start-db-instance --db-instance-identifier "$DB_ID"
  echo "Main RDS start command sent."
else
  echo "Main RDS instance is already available or not found (Status: $DB_STATUS)."
fi

# Apply Terraform
echo "2. Recreating expensive Terraform resources..."
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR/../terraform/environments/$ENV"
terraform init
terraform apply -auto-approve

echo "=== Startup Complete ==="
echo "Your GitLab instance is waking up, and the environment has been fully restored!"
