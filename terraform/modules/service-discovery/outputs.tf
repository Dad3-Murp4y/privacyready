output "namespace_id" { value = aws_service_discovery_private_dns_namespace.this.id }
output "namespace_name" { value = aws_service_discovery_private_dns_namespace.this.name }
output "service_arn" { value = aws_service_discovery_service.this.arn }
output "service_name" { value = aws_service_discovery_service.this.name }
output "hostname" { value = "${aws_service_discovery_service.this.name}.${aws_service_discovery_private_dns_namespace.this.name}" }
