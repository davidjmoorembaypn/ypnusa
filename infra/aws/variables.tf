variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  type    = string
  default = "ypnusa"
}

variable "domain" {
  description = "Public hostname for the app."
  type        = string
  default     = "app.ypnus.com"
}

variable "route53_zone_id" {
  description = "Hosted zone ID that serves ypnus.com. Leave empty to manage DNS elsewhere (validation CNAMEs and the alias are then output, not created)."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "ECR image tag to run."
  type        = string
  default     = "latest"
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "secret_names" {
  description = "Env vars stored in Secrets Manager and injected into the task. Values are set out-of-band, never in Terraform."
  type        = list(string)
  default = [
    "SESSION_SECRET",
    "YPNUS_SSO_SHARED_SECRET",
    "ADMIN_TOKEN",
    "CRON_SECRET",
    "LAMBDA_FULFILLMENT_SECRET",
    "TWILIO_AUTH_TOKEN",
    "REVIEW_REQUEST_API_SECRET",
    "ANTHROPIC_API_KEY",
  ]
}
