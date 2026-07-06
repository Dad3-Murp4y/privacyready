#!/bin/bash
set -e

echo "=== DataWai Teardown for Testing ==="
echo "This script will STOP the GitLab EC2 and RDS instances, and DESTROY the ALB, ECS service, NAT Gateway, and Redis cluster to save costs."
echo ""

# Stop EC2
echo "1. Stopping GitLab EC2 instance..."
INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=datawai-gitlab-primary" "Name=instance-state-name,Values=running" --query "Reservations[*].Instances[*].InstanceId" --output text || true)
if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
  aws ec2 stop-instances --instance-ids $INSTANCE_ID
  echo "EC2 stop command sent."
else
  echo "GitLab EC2 instance is not running or already stopped."
fi

# Stop RDS
echo "2. Stopping GitLab RDS cluster..."
CLUSTER_STATUS=$(aws rds describe-db-clusters --db-cluster-identifier datawai-gitlab-postgres --query "DBClusters[0].Status" --output text 2>/dev/null || true)
if [ "$CLUSTER_STATUS" == "available" ]; then
  aws rds stop-db-cluster --db-cluster-identifier datawai-gitlab-postgres
  echo "RDS stop command sent."
else
  echo "GitLab RDS cluster is not available or already stopped (Status: $CLUSTER_STATUS)."
fi

# Destroy Terraform expensive resources
echo "3. Destroying expensive Terraform resources (ALB, ECS, NAT Gateway, Redis)..."
cd terraform
terraform destroy \
  -target=aws_lb.main \
  -target=aws_ecs_service.app \
  -target=aws_nat_gateway.management \
  -target=aws_elasticache_replication_group.gitlab \
  -auto-approve \
  -var="domain_name=datawai.local"

echo "=== Teardown Complete ==="
echo "Your GitLab codebase is safe on the stopped EC2 and RDS instances. Other expensive resources have been destroyed."
