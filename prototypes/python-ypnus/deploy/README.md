# Running the prototype on AWS

**Status: not deployed, and the container image has not been built or tested** (no Docker or AWS
access in the session that wrote this). Do not use the production server `i-0ad200fc61f4d39f5`
for this. Use a new, separate resource so the live site is never at risk. Creating AWS resources
costs money, so approve the cost first.

## Option A: AWS App Runner (fastest, data resets on redeploy)
Good for a demo. App Runner has no persistent disk, so leads and zip code claims are lost on every
deploy or restart.
```bash
REGION=us-east-2; ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws ecr create-repository --repository-name ypn-prototype --region $REGION
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build -t $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/ypn-prototype:latest ..
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/ypn-prototype:latest
```
Then in the console: **App Runner → Create service → Container registry → Amazon ECR**, choose the
image, port `8080`, health check path `/health`, smallest size (0.25 vCPU / 0.5 GB), and add the
environment variables from the README. App Runner gives you an `*.awsapprunner.com` URL to review.

## Option B: a new small EC2 instance (data persists)
1. Launch a new Amazon Linux 2023 `t4g.small`, attach the SSM role, open ports 80/443 only.
2. `sudo dnf install -y docker && sudo systemctl enable --now docker`
3. Build or pull the image, then run it with a persistent volume:
```bash
sudo docker run -d --name ypn --restart unless-stopped -p 8080:8080 \
  -v /var/lib/ypn:/data -e SITE_URL=https://proto.example.com ypn-prototype:latest
```
4. Put an Application Load Balancer or Caddy in front for HTTPS.

## Before real traffic
- Replace SQLite with DynamoDB or RDS if you run more than one instance.
- Put AWS WAF (rate limit and bot control) in front.
- Connect zip code status to the live ledger before showing availability to real visitors.
