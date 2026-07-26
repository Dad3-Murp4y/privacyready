#!/bin/bash
set -e

echo "=== PrivacyReady Startup for Testing ==="
echo "This script will START the main RDS instance, and RECREATE the ALB, ECS service, and SaaS NAT Gateways using Terraform."
echo ""

# Start Main RDS Instance
echo "3. Starting main RDS database instance..."
DB_STATUS=$(aws rds describe-db-instances --db-instance-identifier privacyready-db --query "DBInstances[0].DBInstanceStatus" --output text 2>/dev/null || true)
if [ "$DB_STATUS" == "stopped" ]; then
  aws rds start-db-instance --db-instance-identifier privacyready-db
  echo "Main RDS start command sent."
else
  echo "Main RDS instance is already available or not found (Status: $DB_STATUS)."
fi

# Apply Terraform
echo "2. Recreating expensive Terraform resources..."
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR/../terraform"
terraform init
terraform apply -auto-approve -var="domain_name=privacyready.local"

echo "=== Startup Complete ==="
echo "Your GitLab instance is waking up, and the environment has been fully restored!"
