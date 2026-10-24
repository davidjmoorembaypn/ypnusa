output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "alb_dns_name" {
  description = "Point app.ypnus.com here (CNAME/alias) at cutover if DNS is not in Route 53."
  value       = aws_lb.app.dns_name
}

output "acm_validation_records" {
  description = "Create these CNAMEs at your DNS host if route53_zone_id is empty."
  value = [
    for o in aws_acm_certificate.app.domain_validation_options : {
      name  = o.resource_record_name
      type  = o.resource_record_type
      value = o.resource_record_value
    }
  ]
}

output "secret_arns" {
  value = { for k, s in aws_secretsmanager_secret.env : k => s.arn }
}
