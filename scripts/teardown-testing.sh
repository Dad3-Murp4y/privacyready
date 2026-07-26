#!/bin/bash
set -e

echo "=== PrivacyReady Teardown for Testing ==="
echo "This script will STOP the GitLab EC2 and RDS instances, and DESTROY the ALB, ECS service, NAT Gateway, and Redis cluster to save costs."
echo ""

# Stop EC2
echo "1. Stopping GitLab EC2 instance..."
INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=privacyready-gitlab-primary" "Name=instance-state-name,Values=running" --query "Reservations[*].Instances[*].InstanceId" --output text || true)
if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
  aws ec2 stop-instances --instance-ids "$INSTANCE_ID"
  echo "EC2 stop command sent."
else
  echo "GitLab EC2 instance is not running or already stopped."
fi

# Stop RDS
echo "2. Stopping GitLab RDS cluster..."
CLUSTER_STATUS=$(aws rds describe-db-clusters --db-cluster-identifier privacyready-gitlab-postgres --query "DBClusters[0].Status" --output text 2>/dev/null || true)
if [ "$CLUSTER_STATUS" == "available" ]; then
  aws rds stop-db-cluster --db-cluster-identifier privacyready-gitlab-postgres
  echo "GitLab RDS stop command sent."
else
  echo "GitLab RDS cluster is not available or already stopped (Status: $CLUSTER_STATUS)."
fi

# Stop Main RDS Instance
echo "3. Stopping main RDS database instance..."
DB_STATUS=$(aws rds describe-db-instances --db-instance-identifier privacyready-db --query "DBInstances[0].DBInstanceStatus" --output text 2>/dev/null || true)
if [ "$DB_STATUS" == "available" ]; then
  aws rds stop-db-instance --db-instance-identifier privacyready-db
  echo "Main RDS stop command sent."
else
  echo "Main RDS instance is not available or already stopped (Status: $DB_STATUS)."
fi

# Destroy Terraform expensive resources
echo "4. Destroying expensive Terraform resources (ALB, ECS services, NAT Gateways, Redis)..."
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR/../terraform"
terraform destroy \
  -target=aws_lb.main \
  -target=aws_ecs_service.app \
  -target=aws_ecs_service.scanner \
  -target=aws_ecs_service.dsr \
  -target=aws_nat_gateway.management \
  -target=aws_nat_gateway.staging \
  -target=aws_nat_gateway.main \
  -target=aws_elasticache_replication_group.gitlab \
  -auto-approve \
  -var="domain_name=privacyready.local"

echo "=== Teardown Complete ==="
echo "Your codebase and GitLab files are safe. Expensive resources (ALB, ECS, NAT Gateways, Redis) are destroyed and databases are stopped to minimize costs."
