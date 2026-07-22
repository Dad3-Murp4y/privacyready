#!/bin/bash
# Install dependencies
yum update -y
yum install -y docker amazon-cloudwatch-agent unzip jq
systemctl enable docker
systemctl start docker

# Download AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -o -q awscliv2.zip
./aws/install --update

# Setup external storage
if [ -b /dev/nvme1n1 ]; then
  mkfs -t xfs /dev/nvme1n1 || true
  mkdir -p /mnt/gitlab
  mount /dev/nvme1n1 /mnt/gitlab || true
else
  mkdir -p /mnt/gitlab
fi

# Fetch passwords securely
export AWS_DEFAULT_REGION=eu-west-2
DB_PASS=$(aws secretsmanager get-secret-value --secret-id privacyready/gitlab/db-password --query SecretString --output text)
REDIS_PASS=$(aws secretsmanager get-secret-value --secret-id privacyready/gitlab/redis-password --query SecretString --output text)

DB_ENDPOINT="privacyready-gitlab-postgres.cluster-cr8coc0yypsj.eu-west-2.rds.amazonaws.com"
REDIS_ENDPOINT="master.privacyready-gitlab-redis.ljym3u.apse1.cache.amazonaws.com"

# Run GitLab Container
docker run --detach \
  --hostname gitlab.privacyready.co.uk \
  --publish 80:80 \
  --name gitlab \
  --restart always \
  --health-start-period 300s \
  --volume /mnt/gitlab/config:/etc/gitlab \
  --volume /mnt/gitlab/logs:/var/log/gitlab \
  --volume /mnt/gitlab/data:/var/opt/gitlab \
  --env GITLAB_OMNIBUS_CONFIG="external_url 'https://gitlab.privacyready.co.uk'; nginx['listen_port'] = 80; nginx['listen_https'] = false; postgresql['enable'] = false; gitlab_rails['db_adapter'] = 'postgresql'; gitlab_rails['db_encoding'] = 'unicode'; gitlab_rails['db_host'] = '$DB_ENDPOINT'; gitlab_rails['db_password'] = '$DB_PASS'; redis['enable'] = false; gitlab_rails['redis_host'] = '$REDIS_ENDPOINT'; gitlab_rails['redis_port'] = 6379; gitlab_rails['redis_password'] = '$REDIS_PASS';" \
  gitlab/gitlab-ce:16.11.10-ce.0
