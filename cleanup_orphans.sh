#!/bin/bash
set -x

export AWS_DEFAULT_REGION=eu-west-2

echo "Cleaning up Secrets..."
aws secretsmanager delete-secret --secret-id privacyready/gitlab/runner-token --force-delete-without-recovery || true
aws secretsmanager delete-secret --secret-id privacyready/gitlab/ci-credentials --force-delete-without-recovery || true
aws secretsmanager delete-secret --secret-id privacyready-gitlab/db-password --force-delete-without-recovery || true
aws secretsmanager delete-secret --secret-id privacyready-gitlab/jwt-secret --force-delete-without-recovery || true

echo "Cleaning up RDS DB Subnet Group..."
aws rds delete-db-subnet-group --db-subnet-group-name privacyready-gitlab-db-subnet || true

echo "Cleaning up SES Rule Set..."
aws ses delete-receipt-rule-set --rule-set-name privacyready-inbound-ruleset || true

