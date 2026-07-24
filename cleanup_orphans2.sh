#!/bin/bash
set -x
export AWS_DEFAULT_REGION=eu-west-2
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Cleaning up Redis Secret..."
aws secretsmanager delete-secret --secret-id privacyready/gitlab/redis-password --force-delete-without-recovery || true

echo "Cleaning up Elasticache Subnet Group..."
aws elasticache delete-cache-subnet-group --cache-subnet-group-name privacyready-gitlab-redis-subnet || true

echo "Cleaning up IAM Role..."
ROLE="privacyready-gitlab-role"
for policy_arn in $(aws iam list-attached-role-policies --role-name $ROLE --query "AttachedPolicies[*].PolicyArn" --output text 2>/dev/null); do
  aws iam detach-role-policy --role-name $ROLE --policy-arn "$policy_arn"
done
aws iam remove-role-from-instance-profile --instance-profile-name privacyready-gitlab-profile --role-name $ROLE || true
aws iam delete-instance-profile --instance-profile-name privacyready-gitlab-profile || true
aws iam delete-role --role-name $ROLE || true

echo "Cleaning up IAM Policy..."
POLICY="privacyready-gitlab-kms-secrets"
ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY}"
for ver in $(aws iam list-policy-versions --policy-arn "$ARN" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text 2>/dev/null); do
  aws iam delete-policy-version --policy-arn "$ARN" --version-id "$ver"
done
aws iam delete-policy --policy-arn "$ARN" || true

