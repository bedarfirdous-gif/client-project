# 🚀 AWS DEPLOYMENT QUICK REFERENCE

## Files Created for You

```
/app/aws/
├── deploy-aws.sh           # One-click deployment script
├── ecs-backend-task.json   # Backend container config
├── ecs-backend-service.json # 3 replicas, auto-recovery
├── alb-target-group.json   # Health check config
└── cloudwatch-alarm.json   # Alert when unhealthy
```

## Critical Settings

### 1. Environment Variable (MOST IMPORTANT)
```bash
AI_DEVELOPER_MODE=monitor_only
```
This is already set in `ecs-backend-task.json`

### 2. Replicas
```
Backend:  3 replicas (zero-downtime)
Frontend: 2 replicas
```

### 3. Health Check
```
Path: /api/health
Interval: 30 seconds
Timeout: 5 seconds
Unhealthy threshold: 3 failures
```

## Deployment Steps

### Step 1: Update AWS Config Files
Replace these placeholders in all JSON files:
- `YOUR_ACCOUNT` → Your AWS Account ID
- `YOUR_REGION` → e.g., `ap-south-1`
- `subnet-xxxxx` → Your VPC subnet IDs
- `sg-xxxxx` → Your security group ID
- `vpc-xxxxx` → Your VPC ID

### Step 2: Create AWS Resources (First Time Only)
```bash
# Create ECR repositories
aws ecr create-repository --repository-name bijnisbooks-backend
aws ecr create-repository --repository-name bijnisbooks-frontend

# Create ECS cluster
aws ecs create-cluster --cluster-name bijnisbooks-production

# Create secrets in Secrets Manager
aws secretsmanager create-secret --name bijnisbooks/mongodb --secret-string "your-mongo-url"
aws secretsmanager create-secret --name bijnisbooks/jwt-secret --secret-string "your-jwt-secret"
aws secretsmanager create-secret --name bijnisbooks/llm-key --secret-string "your-llm-key"

# Create target group
aws elbv2 create-target-group --cli-input-json file://aws/alb-target-group.json

# Register task definition
aws ecs register-task-definition --cli-input-json file://aws/ecs-backend-task.json

# Create service with 3 replicas
aws ecs create-service --cli-input-json file://aws/ecs-backend-service.json

# Create CloudWatch alarm
aws cloudwatch put-metric-alarm --cli-input-json file://aws/cloudwatch-alarm.json
```

### Step 3: Deploy Updates
```bash
cd /app
./aws/deploy-aws.sh
```

## What Happens When Crash Occurs

```
┌─────────────────────────────────────────────────────────────┐
│                    CRASH RECOVERY TIMELINE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  0s   │ Container crashes                                    │
│  5s   │ ALB health check fails (1st)                        │
│  10s  │ ALB health check fails (2nd)                        │
│  15s  │ ALB health check fails (3rd) → UNHEALTHY            │
│       │ → ALB stops sending traffic to crashed container     │
│       │ → ECS notices unhealthy task                         │
│  20s  │ ECS starts new container                            │
│  30s  │ New container passes health check                   │
│       │ → ALB routes traffic to new container                │
│                                                              │
│  USER IMPACT: ZERO (other 2 replicas handle traffic)        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring Commands

```bash
# Check service status
aws ecs describe-services --cluster bijnisbooks-production --services bijnisbooks-backend

# View recent logs
aws logs tail /ecs/bijnisbooks-backend --follow

# Check alarms
aws cloudwatch describe-alarms --alarm-names "BijnisBooks-Backend-Unhealthy"

# Force restart (if needed)
aws ecs update-service --cluster bijnisbooks-production --service bijnisbooks-backend --force-new-deployment
```

## Cost Estimate (Monthly)

| Service | Config | Est. Cost |
|---------|--------|-----------|
| ECS Fargate (Backend) | 3 × 0.5 vCPU, 1GB | ~$45 |
| ECS Fargate (Frontend) | 2 × 0.25 vCPU, 0.5GB | ~$15 |
| ALB | Standard | ~$20 |
| MongoDB Atlas | M10 | ~$57 |
| CloudWatch | Logs + Alarms | ~$10 |
| **TOTAL** | | **~$150/month** |

## Support

If something goes wrong:
1. Check CloudWatch Logs: `/ecs/bijnisbooks-backend`
2. Check CloudWatch Alarms
3. ECS Service Events: `aws ecs describe-services --cluster bijnisbooks-production --services bijnisbooks-backend`
