#!/bin/bash
set -x
export AWS_DEFAULT_REGION=eu-west-2
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Cleaning up EC2 Key Pair..."
aws ec2 delete-key-pair --key-name privacyready-gitlab-key || true

echo "Cleaning up ElastiCache Subnet Group..."
aws elasticache delete-cache-subnet-group --cache-subnet-group-name privacyready-gitlab-cache-subnet || true

echo "Cleaning up KMS Alias..."
aws kms delete-alias --alias-name alias/privacyready-gitlab-gdpr || true

