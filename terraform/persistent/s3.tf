# tfsec:ignore:aws-s3-enable-bucket-logging
resource "aws_s3_bucket" "gitlab_artifacts" {
  count  = var.gitlab_enabled ? 1 : 0
  bucket = "privacyready-gitlab-artifacts-${data.aws_caller_identity.current.account_id}"

  tags = merge(local.tags, { GDPR = "compliant" })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "gitlab_artifacts" {
  count  = var.gitlab_enabled ? 1 : 0
  bucket = aws_s3_bucket.gitlab_artifacts[0].id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.gitlab.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "gitlab_artifacts" {
  count  = var.gitlab_enabled ? 1 : 0
  bucket = aws_s3_bucket.gitlab_artifacts[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "gitlab_artifacts" {
  count  = var.gitlab_enabled ? 1 : 0
  bucket = aws_s3_bucket.gitlab_artifacts[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
