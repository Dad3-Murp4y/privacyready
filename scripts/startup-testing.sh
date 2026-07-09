#!/bin/bash
set -e

echo "=== DataWai Startup for Testing ==="
echo "This script will START the GitLab EC2 and RDS instances, and RECREATE the ALB, ECS service, NAT Gateway, and Redis cluster using Terraform."
echo ""

# Start EC2
echo "1. Starting GitLab EC2 instance..."
INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=privacyready-gitlab-primary" "Name=instance-state-name,Values=stopped" --query "Reservations[*].Instances[*].InstanceId" --output text || true)
if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
  aws ec2 start-instances --instance-ids $INSTANCE_ID
  echo "EC2 start command sent."
else
  echo "GitLab EC2 instance is already running or not found."
fi

# Start RDS
echo "2. Starting GitLab RDS cluster..."
CLUSTER_STATUS=$(aws rds describe-db-clusters --db-cluster-identifier privacyready-gitlab-postgres --query "DBClusters[0].Status" --output text 2>/dev/null || true)
if [ "$CLUSTER_STATUS" == "stopped" ]; then
  aws rds start-db-cluster --db-cluster-identifier privacyready-gitlab-postgres
  echo "GitLab RDS start command sent."
else
  echo "GitLab RDS cluster is already available or not found (Status: $CLUSTER_STATUS)."
fi

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
echo "4. Recreating expensive Terraform resources..."
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR/../terraform"
terraform init
terraform apply -auto-approve -var="domain_name=privacyready.local"

echo "=== Startup Complete ==="
echo "Your GitLab instance is waking up, and the environment has been fully restored!"
