variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  type    = string
  default = "ypnus-wordpress"
}

variable "availability_zone" {
  type    = string
  default = "us-east-1a"
}

variable "bundle_id" {
  description = "Lightsail plan. medium_3_0 = 4 GB RAM / 2 vCPU, a sane floor for ~50 plugins. Resize later from the console."
  type        = string
  default     = "medium_3_0"
}

variable "ssh_allowed_cidrs" {
  description = "Who may SSH in. Set to your office/home IP (x.x.x.x/32). Never leave open."
  type        = list(string)
}

variable "key_pair_name" {
  description = "Existing Lightsail key pair name for SSH. Leave empty to use the Lightsail default key."
  type        = string
  default     = ""
}
