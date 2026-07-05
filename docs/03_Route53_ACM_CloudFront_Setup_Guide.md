# Route 53 + ACM + CloudFront Setup Guide
## For DataWai Static Website (Thailand PDPA Compliance)

**Last Updated:** 2026-06-05  
**Domain:** datawai.co.th (example — replace with your actual domain)  
**AWS Region:** us-east-1 (ACM for CloudFront) + ap-southeast-1 (origin/S3)  
**Architecture:** S3 Static Website → CloudFront CDN → Route 53 DNS + ACM SSL

---

## Architecture Overview

```
User Request
    │
    ▼
┌─────────────────────────────────────────┐
│  Route 53 (DNS Resolution)              │
│  datawai.co.th → CloudFront Alias      │
│  www.datawai.co.th → CloudFront Alias │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  CloudFront Distribution                │
│  • Edge locations (Bangkok, Singapore)    │
│  • ACM SSL Certificate (TLS 1.2+)       │
│  • Origin Access Control (OAC)          │
│  • Cache behaviors for static assets    │
│  • Security headers (HSTS, CSP)         │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  S3 Bucket (ap-southeast-1)             │
│  • Static website files                 │
│  • Versioning enabled                   │
│  • Server-side encryption (AES-256)       │
│  • Block ALL public access              │
│  • Access restricted to CloudFront OAC  │
└─────────────────────────────────────────┘
```

---

## Step 1: Register Domain in Route 53 (or Transfer)

### Option A: Register New Domain via Route 53

```bash
# Check domain availability
aws route53domains check-domain-availability   --domain-name datawai.co.th   --region us-east-1

# Register domain (requires contact info)
aws route53domains register-domain   --domain-name datawai.co.th   --duration-in-years 1   --admin-contact file://admin-contact.json   --registrant-contact file://registrant-contact.json   --tech-contact file://tech-contact.json   --auto-renew   --region us-east-1
```

**Contact Info JSON (`admin-contact.json`):**
```json
{
  "FirstName": "Somsak",
  "LastName": "Tongsai",
  "ContactType": "PERSON",
  "OrganizationName": "DataWai Co., Ltd.",
  "AddressLine1": "123 Sukhumvit Road",
  "City": "Bangkok",
  "CountryCode": "TH",
  "ZipCode": "10110",
  "PhoneNumber": "+66.21234567",
  "Email": "admin@datawai.co.th"
}
```

### Option B: Transfer Existing Domain to Route 53

If your domain is registered elsewhere (e.g., GoDaddy, Namecheap):

1. **Unlock domain** at current registrar
2. **Get auth code** (EPP code) from current registrar
3. **Request transfer** in Route 53:

```bash
aws route53domains transfer-domain   --domain-name datawai.co.th   --duration-in-years 1   --auth-code "YOUR_AUTH_CODE"   --admin-contact file://admin-contact.json   --registrant-contact file://registrant-contact.json   --tech-contact file://tech-contact.json   --region us-east-1
```

4. **Update nameservers** at old registrar to Route 53 nameservers (provided after hosted zone creation)

---

## Step 2: Create Route 53 Hosted Zone

```bash
# Create public hosted zone
aws route53 create-hosted-zone   --name datawai.co.th   --caller-reference $(date +%s)   --hosted-zone-config Comment="DataWai production domain",PrivateZone=false

# Output: Note the HostedZoneId and NS records
```

**Terraform equivalent:**
```hcl
resource "aws_route53_zone" "datawai" {
  name    = "datawai.co.th"
  comment = "DataWai production domain - PDPA compliant"

  tags = {
    Environment   = "production"
    PDPA          = "compliant"
    DataResidency = "thailand"
    ManagedBy     = "terraform"
  }
}

# Output the nameservers for domain registrar configuration
output "nameservers" {
  value = aws_route53_zone.datawai.name_servers
}
```

---

## Step 3: Request SSL Certificate in ACM

**⚠️ CRITICAL:** For CloudFront, the ACM certificate **MUST** be in `us-east-1` (N. Virginia). This is a CloudFront requirement — it cannot use certificates from other regions. citeweb_search:23#4

```bash
# Request certificate in us-east-1 (required for CloudFront)
aws acm request-certificate   --domain-name datawai.co.th   --subject-alternative-names www.datawai.co.th   --validation-method DNS   --idempotency-token datawai-cert-2024   --region us-east-1

# Output: Note the CertificateArn
```

**Terraform equivalent:**
```hcl
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_acm_certificate" "datawai" {
  provider = aws.us_east_1

  domain_name               = "datawai.co.th"
  subject_alternative_names = ["www.datawai.co.th", "*.datawai.co.th"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name          = "datawai-co-th"
    Environment   = "production"
    PDPA          = "compliant"
    DataResidency = "thailand"
  }
}

# DNS validation records in Route 53
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.datawai.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = aws_route53_zone.datawai.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

# Wait for certificate validation
resource "aws_acm_certificate_validation" "datawai" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.datawai.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}
```

---

## Step 4: Validate Certificate via Route 53 DNS

### Automatic Validation (if domain is in Route 53)

```bash
# Get certificate details
aws acm describe-certificate   --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/xxxxxx   --region us-east-1

# Create DNS validation records automatically
# ACM provides CNAME records that must be added to Route 53

# Example CNAME record for validation:
aws route53 change-resource-record-sets   --hosted-zone-id Z1234567890ABC   --change-batch file://cert-validation.json
```

**`cert-validation.json`:**
```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_abc123def456.datawai.co.th",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "_xyz789uvw012.acm-validations.aws"
          }
        ]
      }
    }
  ]
}
```

**Validation typically completes in 5-30 minutes.** Monitor status:

```bash
aws acm describe-certificate   --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/xxxxxx   --region us-east-1   --query 'Certificate.DomainValidationOptions[*].{Domain:DomainName,Status:ValidationStatus}'
```

---

## Step 5: Create S3 Bucket for Static Website

```bash
# Create bucket in ap-southeast-1 (Thailand proximity)
aws s3api create-bucket   --bucket datawai-website-prod   --region ap-southeast-1   --create-bucket-configuration LocationConstraint=ap-southeast-1

# Enable versioning (for rollback capability)
aws s3api put-bucket-versioning   --bucket datawai-website-prod   --versioning-configuration Status=Enabled

# Enable server-side encryption
aws s3api put-bucket-encryption   --bucket datawai-website-prod   --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }
    ]
  }'

# Block ALL public access (access only via CloudFront OAC)
aws s3api put-public-access-block   --bucket datawai-website-prod   --public-access-block-configuration '{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }'

# Enable bucket policy for CloudFront OAC (see Step 6)
```

**Terraform equivalent:**
```hcl
resource "aws_s3_bucket" "website" {
  bucket = "datawai-website-prod"

  tags = {
    Name          = "datawai-website"
    Environment   = "production"
    PDPA          = "compliant"
    DataResidency = "thailand"
  }
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}
```

---

## Step 6: Create CloudFront Distribution with OAC

**Origin Access Control (OAC)** is the modern, secure way to connect CloudFront to S3. It replaces the older Origin Access Identity (OAI). citeweb_search:23#5

```bash
# Create Origin Access Control
aws cloudfront create-origin-access-control   --origin-access-control-config '{
    "Name": "datawai-oac",
    "Description": "OAC for DataWai S3 origin",
    "SigningProtocol": "sigv4",
    "SigningBehavior": "always",
    "OriginAccessControlOriginType": "s3"
  }'

# Note the OriginAccessControlId for the distribution
```

**CloudFront Distribution Configuration:**

```bash
aws cloudfront create-distribution   --distribution-config file://cloudfront-config.json
```

**`cloudfront-config.json`:**
```json
{
  "CallerReference": "datawai-distribution-2024",
  "Aliases": {
    "Quantity": 2,
    "Items": ["datawai.co.th", "www.datawai.co.th"]
  },
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-datawai-website",
        "DomainName": "datawai-website-prod.s3.ap-southeast-1.amazonaws.com",
        "OriginAccessControlId": "EABC123DEF456G",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-datawai-website",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["HEAD", "GET"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["HEAD", "GET"]
      }
    },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "OriginRequestPolicyId": "88a5a4f4-13e8-45c1-9f3e-3f5e8a7b2c1d",
    "ResponseHeadersPolicyId": "67f7725c-6f97-4210-82d7-6251b75f5e5e"
  },
  "Comment": "DataWai PDPA-compliant static website",
  "Enabled": true,
  "HttpVersion": "http2and3",
  "PriceClass": "PriceClass_200",
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxx",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "CertificateSource": "acm"
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 10
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 10
      }
    ]
  },
  "DefaultRootObject": "index.html",
  "IsIPV6Enabled": true
}
```

**Terraform equivalent:**
```hcl
# Origin Access Control
resource "aws_cloudfront_origin_access_control" "datawai" {
  name                              = "datawai-oac"
  description                       = "OAC for DataWai S3 origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "datawai" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "DataWai PDPA-compliant static website"
  default_root_object = "index.html"
  http_version        = "http2and3"
  price_class         = "PriceClass_200"  # Asia, Europe, US

  aliases = ["datawai.co.th", "www.datawai.co.th"]

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-datawai-website"
    origin_access_control_id = aws_cloudfront_origin_access_control.datawai.id
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-datawai-website"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 86400    # 24 hours
    max_ttl                = 31536000 # 1 year
  }

  # Cache behavior for static assets (longer cache)
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-datawai-website"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 604800   # 7 days
    max_ttl                = 31536000 # 1 year
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
      # Optional: whitelist Thailand only for PDPA compliance
      # restriction_type = "whitelist"
      # locations        = ["TH"]
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.datawai.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = {
    Name          = "datawai-cdn"
    Environment   = "production"
    PDPA          = "compliant"
    DataResidency = "thailand"
  }

  depends_on = [aws_acm_certificate_validation.datawai]
}
```

---

## Step 7: S3 Bucket Policy for CloudFront OAC

```bash
# Apply bucket policy allowing CloudFront OAC access
aws s3api put-bucket-policy   --bucket datawai-website-prod   --policy file://bucket-policy.json
```

**`bucket-policy.json`:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::datawai-website-prod/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE"
        }
      }
    }
  ]
}
```

**Terraform equivalent:**
```hcl
data "aws_iam_policy_document" "website_oac" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.website.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.datawai.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = data.aws_iam_policy_document.website_oac.json
}
```

---

## Step 8: Create Route 53 Alias Records

```bash
# Create A record (Alias) for apex domain → CloudFront
aws route53 change-resource-record-sets   --hosted-zone-id Z1234567890ABC   --change-batch file://alias-record.json
```

**`alias-record.json`:**
```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "datawai.co.th",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1234abcd5678.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.datawai.co.th",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1234abcd5678.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
```

**⚠️ Note:** The `HostedZoneId` for CloudFront alias records is **always** `Z2FDTNDATAQYW2` — this is a fixed AWS value, not your CloudFront distribution's zone ID. citeweb_search:23#4

**Terraform equivalent:**
```hcl
resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.datawai.zone_id
  name    = "datawai.co.th"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.datawai.domain_name
    zone_id                = aws_cloudfront_distribution.datawai.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.datawai.zone_id
  name    = "www.datawai.co.th"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.datawai.domain_name
    zone_id                = aws_cloudfront_distribution.datawai.hosted_zone_id
    evaluate_target_health = false
  }
}
```

---

## Step 9: Deploy Website Files to S3

```bash
# Sync static files to S3 (from your build output)
aws s3 sync ./dist s3://datawai-website-prod/   --delete   --cache-control "max-age=86400"   --region ap-southeast-1

# Set content types for specific files
aws s3 cp s3://datawai-website-prod/index.html s3://datawai-website-prod/index.html   --metadata-directive REPLACE   --content-type "text/html; charset=utf-8"   --cache-control "no-cache"   --region ap-southeast-1

# Invalidate CloudFront cache after deployment
aws cloudfront create-invalidation   --distribution-id EDFDVBD6EXAMPLE   --paths "/*"   --region us-east-1
```

**CI/CD Script (GitLab CI):**
```yaml
# .gitlab-ci.yml
stages:
  - build
  - deploy

variables:
  AWS_DEFAULT_REGION: ap-southeast-1
  S3_BUCKET: datawai-website-prod
  CLOUDFRONT_DIST_ID: EDFDVBD6EXAMPLE

build:
  stage: build
  image: node:20-alpine
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy:
  stage: deploy
  image: amazon/aws-cli:latest
  dependencies:
    - build
  script:
    - aws s3 sync dist/ s3://$S3_BUCKET/ --delete --cache-control "max-age=86400"
    - aws s3 cp s3://$S3_BUCKET/index.html s3://$S3_BUCKET/index.html --metadata-directive REPLACE --content-type "text/html; charset=utf-8" --cache-control "no-cache"
    - aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"
  only:
    - main
```

---

## Step 10: Security Hardening

### 10.1 Security Headers (CloudFront Response Headers Policy)

```bash
# Create custom response headers policy
aws cloudfront create-response-headers-policy   --response-headers-policy-config file://security-headers.json
```

**`security-headers.json`:**
```json
{
  "Name": "datawai-security-headers",
  "Comment": "PDPA-compliant security headers",
  "SecurityHeadersConfig": {
    "ContentSecurityPolicy": {
      "Override": true,
      "ContentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
      "ContentTypeOptions": {
        "Override": true
      }
    },
    "StrictTransportSecurity": {
      "Override": true,
      "IncludeSubdomains": true,
      "Preload": true,
      "AccessControlMaxAgeSec": 63072000
    },
    "XSSProtection": {
      "Override": true,
      "Protection": true,
      "ModeBlock": true
    },
    "FrameOptions": {
      "Override": true,
      "FrameOption": "DENY"
    },
    "ReferrerPolicy": {
      "Override": true,
      "ReferrerPolicy": "strict-origin-when-cross-origin"
    }
  }
}
```

### 10.2 WAF Web ACL (Optional but Recommended)

```hcl
resource "aws_wafv2_web_acl" "datawai" {
  name        = "datawai-cloudfront-waf"
  description = "WAF rules for DataWai static site"
  scope       = "CLOUDFRONT"
  provider    = aws.us_east_1  # WAF for CloudFront must be in us-east-1

  default_action {
    allow {}
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rate limiting
  rule {
    name     = "RateLimit"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  # Geographic restriction (optional - Thailand only)
  rule {
    name     = "GeoBlock"
    priority = 3

    action {
      block {}
    }

    statement {
      not_statement {
        statement {
          geo_match_statement {
            country_codes = ["TH"]
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoBlockMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "datawai-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "datawai-cloudfront-waf"
    PDPA = "compliant"
  }
}

# Associate WAF with CloudFront distribution
resource "aws_cloudfront_distribution" "datawai" {
  # ... existing config ...
  web_acl_id = aws_wafv2_web_acl.datawai.arn
}
```

---

## Step 11: Monitoring & Logging

### 11.1 CloudFront Access Logs

```hcl
# S3 bucket for CloudFront logs
resource "aws_s3_bucket" "cloudfront_logs" {
  bucket = "datawai-cloudfront-logs"

  tags = {
    Name = "cloudfront-access-logs"
    PDPA = "compliant"
  }
}

resource "aws_s3_bucket_acl" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id
  acl    = "private"
}

# Enable CloudFront logging
resource "aws_cloudfront_distribution" "datawai" {
  # ... existing config ...

  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = "cdn/"
  }
}
```

### 11.2 CloudWatch Alarms

```hcl
# 5xx error rate alarm
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  alarm_name          = "datawai-cloudfront-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "CloudFront 5xx error rate > 5%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.datawai.id
    Region         = "Global"
  }
}

# Origin latency alarm
resource "aws_cloudwatch_metric_alarm" "cloudfront_latency" {
  alarm_name          = "datawai-cloudfront-origin-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "OriginLatency"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "p90"
  threshold           = 2000  # 2 seconds
  alarm_description   = "CloudFront origin latency P90 > 2s"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.datawai.id
    Region         = "Global"
  }
}
```

---

## Complete Terraform Module

```hcl
# main.tf - Complete DataWai Website Infrastructure
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-southeast-1"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  domain_name = "datawai.co.th"
  tags = {
    Project       = "datawai-website"
    Environment   = "production"
    PDPA          = "compliant"
    DataResidency = "thailand"
    ManagedBy     = "terraform"
  }
}

# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name    = local.domain_name
  comment = "DataWai production domain"
  tags    = local.tags
}

# ACM Certificate (us-east-1 required for CloudFront)
resource "aws_acm_certificate" "main" {
  provider = aws.us_east_1

  domain_name               = local.domain_name
  subject_alternative_names = ["www.${local.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

# DNS validation records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "main" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# S3 Website Bucket
resource "aws_s3_bucket" "website" {
  bucket = "datawai-website-prod"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "datawai-oac"
  description                       = "OAC for DataWai S3 origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 Bucket Policy for OAC
data "aws_iam_policy_document" "website_oac" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.website.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = data.aws_iam_policy_document.website_oac.json
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "DataWai PDPA-compliant static website"
  default_root_object = "index.html"
  http_version        = "http2and3"
  price_class         = "PriceClass_200"

  aliases = [local.domain_name, "www.${local.domain_name}"]

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-datawai-website"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-datawai-website"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = local.tags

  depends_on = [aws_acm_certificate_validation.main]
}

# Route 53 Alias Records
resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${local.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# Outputs
output "nameservers" {
  description = "Update your domain registrar with these nameservers"
  value       = aws_route53_zone.main.name_servers
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = aws_acm_certificate.main.arn
}

output "s3_bucket_name" {
  description = "S3 website bucket name"
  value       = aws_s3_bucket.website.id
}
```

---

## Cost Estimate (Monthly)

| Service | Usage | Monthly Cost |
|---------|-------|-------------|
| Route 53 Hosted Zone | 1 zone | $0.50 |
| Route 53 Queries | ~1M queries | $0.40 |
| ACM Certificate | 1 cert | **Free** |
| CloudFront Data Transfer | 100GB out | $8.50 |
| CloudFront Requests | 10M requests | $7.50 |
| S3 Storage | 10GB | $0.23 |
| S3 Requests | 1M GET | $0.40 |
| **Total** | | **~$17.53/month** |

*Costs scale with traffic. For a typical SaaS marketing site, expect $10-50/month.*

---

## PDPA Compliance Notes

| Requirement | Implementation |
|-------------|---------------|
| **Data Localization** | S3 bucket in `ap-southeast-1`. CloudFront caches at edge locations (including Bangkok). |
| **Encryption in Transit** | TLS 1.2+ via ACM. HSTS header enforced. |
| **Encryption at Rest** | S3 SSE-S3 (AES-256). |
| **Access Logging** | CloudFront access logs → S3. CloudTrail for API calls. |
| **Breach Detection** | CloudWatch alarms on 5xx errors + WAF blocked requests. |
| **Geographic Restriction** | Optional WAF rule to block non-Thailand traffic. |
| **Cookie Handling** | CloudFront forwards cookies only if needed (configured off by default). |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Certificate validation pending > 1 hour | Check DNS records match exactly. Ensure no CNAME conflicts. |
| CloudFront returns 403 | Verify S3 bucket policy allows CloudFront OAC. Check `AWS:SourceArn` matches distribution ARN. |
| Domain shows "Not Secure" | Certificate must be in `us-east-1`. Verify aliases match certificate SANs exactly. |
| SPA routing broken (404 on /about) | Ensure `CustomErrorResponse` maps 403/404 to `/index.html` (already configured above). |
| Changes not reflecting | CloudFront cache invalidation needed: `aws cloudfront create-invalidation --distribution-id ID --paths "/*"` |
| DNS not resolving | Nameserver propagation takes 24-48 hours. Verify registrar uses Route 53 NS records. |

---

*Document Version: 1.0*  
*Prepared for: DataWai PDPA Compliance Platform*  
*AWS Services: Route 53, ACM, CloudFront, S3, WAFv2, CloudWatch*  
*Regions: us-east-1 (ACM/CloudFront/WAF), ap-southeast-1 (S3/Route 53)*
