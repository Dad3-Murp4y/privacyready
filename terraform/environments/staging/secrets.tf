module "secrets" {
  source       = "../../modules/secrets"
  name         = local.name
  secret_names = ["jwt-secret", "scanner-api-key", "stripe-secret-key", "stripe-webhook-secret"]
  tags         = var.common_tags
}
