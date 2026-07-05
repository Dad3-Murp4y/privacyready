locals {
  app_name    = "datawai-api"
  environment = var.environment

  tags = {
    Project       = "datawai"
    Environment   = local.environment
    PDPA          = "compliant"
    DataResidency = "thailand"
    ManagedBy     = "terraform"
    Deployment    = "ecs-native-bluegreen"
  }
}
