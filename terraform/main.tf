# PrivacyReady Platform Infrastructure main deployment entrypoint.
# Infrastructure resources are modularized across logical domain files:
# - vpc.tf          : Networking configuration
# - security.tf     : Security groups and network access rules
# - alb.tf          : Application Load Balancer and domain certificate
# - ecs.tf          : ECS Cluster, task definition, Fargate service, and auto-scaling
# - rds.tf          : RDS PostgreSQL Database instance and credentials
# - elasticache.tf  : Redis cluster setup
# - s3.tf           : Secure private storage bucket
# - outputs.tf      : Resource endpoints and URLs
