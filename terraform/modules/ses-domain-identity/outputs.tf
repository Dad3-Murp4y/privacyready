output "domain_name" { value = aws_ses_domain_identity.this.domain }
output "mail_from_domain" { value = aws_ses_domain_mail_from.this.mail_from_domain }
