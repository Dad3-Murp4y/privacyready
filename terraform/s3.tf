# S3 bucket configuration for application storage
resource "aws_s3_bucket" "app" {
  bucket = "datawai-app-data-${data.aws_caller_identity.current.account_id}"

  tags = merge(local.tags, { Name = "datawai-app-data" })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app" {
  bucket = aws_s3_bucket.app.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "app" {
  bucket = aws_s3_bucket.app.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}
