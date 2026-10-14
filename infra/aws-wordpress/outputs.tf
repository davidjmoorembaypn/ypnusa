output "static_ip" {
  description = "Staging address. Test the migrated site via an /etc/hosts entry pointing ypnus.com here. Use at DNS cutover."
  value       = aws_lightsail_static_ip.wp.ip_address
}

output "instance_name" {
  value = aws_lightsail_instance.wp.name
}
