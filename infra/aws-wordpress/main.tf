# WordPress (Bitnami/Apache stack) on Lightsail with a static IP.
# Staging first: this creates a standalone copy on its own IP. DNS for ypnus.com is NOT touched.

resource "aws_lightsail_instance" "wp" {
  name              = var.name
  availability_zone = var.availability_zone
  blueprint_id      = "wordpress"
  bundle_id         = var.bundle_id
  key_pair_name     = var.key_pair_name == "" ? null : var.key_pair_name
  tags              = { project = "ypnus", role = "wordpress" }

  # Daily automatic snapshot (Lightsail built-in), 03:00 UTC.
  add_on {
    type          = "AutomaticSnapshot"
    snapshot_time = "03:00"
    status        = "Enabled"
  }
}

resource "aws_lightsail_static_ip" "wp" {
  name = "${var.name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "wp" {
  static_ip_name = aws_lightsail_static_ip.wp.name
  instance_name  = aws_lightsail_instance.wp.name
}

resource "aws_lightsail_instance_public_ports" "wp" {
  instance_name = aws_lightsail_instance.wp.name

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
  }
  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
  }
  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = var.ssh_allowed_cidrs
  }
}
