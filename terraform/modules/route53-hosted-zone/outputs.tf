output "hosted_zone_id" { value = aws_route53_zone.this.zone_id }
output "hosted_zone_name" { value = aws_route53_zone.this.name }
output "route53_name_servers" { value = aws_route53_zone.this.name_servers }
