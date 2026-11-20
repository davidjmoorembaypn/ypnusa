#!/usr/bin/env bash
# Run in AWS CloudShell (or any shell with AWS CLI v2 + admin-ish creds). Idempotent.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; source "$DIR/config.env"
export AWS_DEFAULT_REGION="$AWS_REGION"

VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values="$NAME" Name=vpc-id,Values="$VPC" --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = "None" ]; then
  SG=$(aws ec2 create-security-group --group-name "$NAME" --description "$NAME web" --vpc-id "$VPC" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions \
    'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]' \
    'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]' \
    'IpProtocol=tcp,FromPort=443,ToPort=443,Ipv6Ranges=[{CidrIpv6=::/0}]'
  # SSH only from the EC2 Instance Connect service range for this region
  EIC=$(curl -s https://ip-ranges.amazonaws.com/ip-ranges.json | python3 -c "import json,sys,os;r=os.environ['AWS_REGION'];print(next(p['ip_prefix'] for p in json.load(sys.stdin)['prefixes'] if p['service']=='EC2_INSTANCE_CONNECT' and p['region']==r))")
  aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port 22 --cidr "$EIC"
fi

ROLE="$NAME-role"
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document \
   '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  for p in AmazonSSMManagedInstanceCore CloudWatchAgentServerPolicy; do
    aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/$p; done
  aws iam create-instance-profile --instance-profile-name "$ROLE" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$ROLE" --role-name "$ROLE"
  sleep 12
fi

AMI=$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
IID=$(aws ec2 describe-instances --filters Name=tag:Name,Values="$NAME" Name=instance-state-name,Values=pending,running,stopped --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ "$IID" = "None" ]; then
  IID=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$INSTANCE_TYPE" --security-group-ids "$SG" \
    --iam-instance-profile Name="$ROLE" --metadata-options HttpTokens=required,HttpEndpoint=enabled \
    --block-device-mappings "DeviceName=/dev/sda1,Ebs={VolumeSize=$VOLUME_GB,VolumeType=gp3,Encrypted=true,DeleteOnTermination=false}" \
    --user-data "file://$DIR/bootstrap-server.sh" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" "ResourceType=volume,Tags=[{Key=Name,Value=$NAME}]" \
    --query 'Instances[0].InstanceId' --output text)
  aws ec2 wait instance-running --instance-ids "$IID"
fi

EIP=$(aws ec2 describe-addresses --filters Name=tag:Name,Values="$NAME" --query 'Addresses[0].PublicIp' --output text)
if [ "$EIP" = "None" ]; then
  ALLOC=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME}]" --query AllocationId --output text)
  aws ec2 associate-address --instance-id "$IID" --allocation-id "$ALLOC" >/dev/null
  EIP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].PublicIp' --output text)
fi

# Daily EBS snapshots (DLM)
cat <<OUT
Instance: $IID   Elastic IP: $EIP
Connect : aws ec2-instance-connect ssh --instance-id $IID --os-user ubuntu
Next    : bootstrap runs automatically (~5 min). Check: sudo tail -f /var/log/ypnus-bootstrap.log
          then run aws/migrate-wordpress.sh from the instance.
OUT
