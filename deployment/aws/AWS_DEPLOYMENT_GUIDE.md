# ============================================
# BijnisBooks - AWS Deployment Guide
# ============================================

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [AWS Infrastructure Setup](#aws-infrastructure-setup)
3. [Database Setup (MongoDB Atlas)](#database-setup)
4. [Build & Deploy](#build--deploy)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
```

### Required AWS Permissions
- ECR: Full access
- ECS: Full access
- EC2: VPC, Security Groups, Load Balancers
- IAM: Create roles
- Secrets Manager: Create/read secrets
- CloudWatch Logs: Create/write logs

---

## AWS Infrastructure Setup

### Step 1: Create ECR Repositories
```bash
# Create backend repository
aws ecr create-repository \
    --repository-name bijnisbooks-backend \
    --image-scanning-configuration scanOnPush=true \
    --region us-east-1

# Create frontend repository
aws ecr create-repository \
    --repository-name bijnisbooks-frontend \
    --image-scanning-configuration scanOnPush=true \
    --region us-east-1
```

### Step 2: Create VPC and Networking
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=bijnisbooks-vpc}]'

# Note the VPC ID and create subnets
# Public subnets (for ALB): 10.0.1.0/24, 10.0.2.0/24
# Private subnets (for ECS): 10.0.10.0/24, 10.0.20.0/24
```

### Step 3: Create Security Groups
```bash
# ALB Security Group (allow 80, 443 from anywhere)
aws ec2 create-security-group \
    --group-name bijnisbooks-alb-sg \
    --description "ALB Security Group" \
    --vpc-id vpc-YOUR_VPC_ID

# Backend Security Group (allow 8001 from ALB)
aws ec2 create-security-group \
    --group-name bijnisbooks-backend-sg \
    --description "Backend Security Group" \
    --vpc-id vpc-YOUR_VPC_ID

# Frontend Security Group (allow 80 from ALB)
aws ec2 create-security-group \
    --group-name bijnisbooks-frontend-sg \
    --description "Frontend Security Group" \
    --vpc-id vpc-YOUR_VPC_ID
```

### Step 4: Create ECS Cluster
```bash
aws ecs create-cluster \
    --cluster-name bijnisbooks-cluster \
    --capacity-providers FARGATE FARGATE_SPOT \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

### Step 5: Create Application Load Balancer
```bash
# Create ALB
aws elbv2 create-load-balancer \
    --name bijnisbooks-alb \
    --subnets subnet-PUBLIC_1 subnet-PUBLIC_2 \
    --security-groups sg-ALB_SG_ID \
    --scheme internet-facing \
    --type application

# Create target groups for backend and frontend
aws elbv2 create-target-group \
    --name bijnisbooks-backend-tg \
    --protocol HTTP \
    --port 8001 \
    --vpc-id vpc-YOUR_VPC_ID \
    --target-type ip \
    --health-check-path /api/health

aws elbv2 create-target-group \
    --name bijnisbooks-frontend-tg \
    --protocol HTTP \
    --port 80 \
    --vpc-id vpc-YOUR_VPC_ID \
    --target-type ip \
    --health-check-path /health
```

### Step 6: Create IAM Roles
```bash
# ECS Task Execution Role (for pulling images, logging)
aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document file://ecs-trust-policy.json

aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# ECS Task Role (for application permissions)
aws iam create-role \
    --role-name ecsTaskRole \
    --assume-role-policy-document file://ecs-trust-policy.json
```

### Step 7: Store Secrets
```bash
# Store MongoDB URL
aws secretsmanager create-secret \
    --name bijnisbooks/mongodb-url \
    --secret-string "mongodb+srv://user:pass@cluster.mongodb.net/bijnisbooks"

# Store API keys
aws secretsmanager create-secret \
    --name bijnisbooks/emergent-llm-key \
    --secret-string "sk-emergent-your-key"

aws secretsmanager create-secret \
    --name bijnisbooks/stripe-api-key \
    --secret-string "sk_live_your-stripe-key"

aws secretsmanager create-secret \
    --name bijnisbooks/jwt-secret \
    --secret-string "your-super-secret-jwt-key-min-32-characters"
```

---

## Database Setup

### Option A: MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster (M0) or production cluster (M10+)
3. Create database user with readWrite access
4. Whitelist your ECS VPC CIDR or use VPC Peering
5. Get connection string and store in AWS Secrets Manager

### Option B: Self-hosted MongoDB on EC2
```bash
# Launch EC2 instance with MongoDB AMI
# Configure security group to allow 27017 from ECS subnets
# Set up authentication and replica set for production
```

---

## Build & Deploy

### Quick Deploy
```bash
cd /app/deployment/aws

# Copy environment template
cp .env.example .env
# Edit .env with your values

# Make deploy script executable
chmod +x deploy.sh

# Deploy to dev environment
./deploy.sh dev

# Deploy to production
./deploy.sh prod
```

### Manual Deploy Steps
```bash
# 1. Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# 2. Build images
docker build -t bijnisbooks-backend -f Dockerfile.backend ../..
docker build -t bijnisbooks-frontend -f Dockerfile.frontend --build-arg REACT_APP_BACKEND_URL=https://api.yourdomain.com ../..

# 3. Tag images
docker tag bijnisbooks-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bijnisbooks-backend:latest
docker tag bijnisbooks-frontend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bijnisbooks-frontend:latest

# 4. Push images
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bijnisbooks-backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bijnisbooks-frontend:latest

# 5. Register task definitions
aws ecs register-task-definition --cli-input-json file://ecs-task-definition-backend.json
aws ecs register-task-definition --cli-input-json file://ecs-task-definition-frontend.json

# 6. Create/update services
aws ecs create-service --cli-input-json file://ecs-service-backend.json
aws ecs create-service --cli-input-json file://ecs-service-frontend.json
```

---

## Post-Deployment

### Configure Custom Domain
```bash
# 1. Request SSL certificate in ACM
aws acm request-certificate \
    --domain-name yourdomain.com \
    --subject-alternative-names "*.yourdomain.com" \
    --validation-method DNS

# 2. Add HTTPS listener to ALB
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:... \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=arn:aws:acm:... \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...

# 3. Create Route 53 record pointing to ALB
```

### Set Up Auto-Scaling
```bash
# Register scalable targets
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/bijnisbooks-cluster/bijnisbooks-backend \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
    --policy-name cpu-scaling \
    --service-namespace ecs \
    --resource-id service/bijnisbooks-cluster/bijnisbooks-backend \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

---

## Troubleshooting

### View Logs
```bash
# Backend logs
aws logs tail /ecs/bijnisbooks --filter-pattern "backend" --follow

# Frontend logs
aws logs tail /ecs/bijnisbooks --filter-pattern "frontend" --follow
```

### Check Service Status
```bash
aws ecs describe-services \
    --cluster bijnisbooks-cluster \
    --services bijnisbooks-backend bijnisbooks-frontend
```

### Connect to Container (Debug)
```bash
aws ecs execute-command \
    --cluster bijnisbooks-cluster \
    --task TASK_ID \
    --container backend \
    --interactive \
    --command "/bin/sh"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Task fails to start | Check CloudWatch logs, verify secrets access |
| Health check failing | Verify security group allows ALB to reach containers |
| Cannot connect to MongoDB | Check VPC peering, security groups, IP whitelist |
| Images not pulling | Verify ECR permissions in task execution role |

---

## Cost Estimation (Monthly)

| Service | Configuration | Est. Cost |
|---------|--------------|-----------|
| ECS Fargate (Backend) | 2 tasks, 0.5 vCPU, 1GB | ~$30 |
| ECS Fargate (Frontend) | 2 tasks, 0.25 vCPU, 0.5GB | ~$15 |
| Application Load Balancer | 1 ALB | ~$20 |
| MongoDB Atlas | M10 (Production) | ~$60 |
| ECR | Image storage | ~$5 |
| CloudWatch | Logs & Metrics | ~$10 |
| **Total** | | **~$140/month** |

For development/testing, use:
- 1 task per service
- MongoDB Atlas M0 (free)
- Estimated: **~$40/month**

---

## Files Reference

```
/app/deployment/aws/
├── Dockerfile.backend          # Backend Docker image
├── Dockerfile.frontend         # Frontend Docker image
├── nginx.conf                  # Nginx configuration
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production overrides
├── mongo-init.js              # MongoDB initialization
├── ecs-task-definition-backend.json
├── ecs-task-definition-frontend.json
├── ecs-service-backend.json
├── ecs-service-frontend.json
├── deploy.sh                   # Automated deployment script
├── .env.example               # Environment template
└── AWS_DEPLOYMENT_GUIDE.md    # This file
```
