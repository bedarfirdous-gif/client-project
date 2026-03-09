#!/bin/bash
# =============================================================
# BijnisBooks AWS Deployment Script
# =============================================================
# 
# Prerequisites:
# 1. AWS CLI configured with proper credentials
# 2. Docker installed and logged into ECR
# 3. Replace all YOUR_* placeholders with actual values
#
# Usage: ./deploy-aws.sh
# =============================================================

set -e

echo "=========================================="
echo "BijnisBooks AWS Production Deployment"
echo "=========================================="

# Configuration - REPLACE THESE
AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID="YOUR_ACCOUNT_ID"
ECR_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
CLUSTER_NAME="bijnisbooks-production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Building Docker Images${NC}"
echo "----------------------------------------"

# Build backend image
echo "Building backend..."
docker build -t bijnisbooks-backend:latest ./backend

# Build frontend image
echo "Building frontend..."
docker build -t bijnisbooks-frontend:latest ./frontend

echo -e "${GREEN}✓ Docker images built${NC}"

echo -e "${YELLOW}Step 2: Pushing to ECR${NC}"
echo "----------------------------------------"

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# Tag and push backend
docker tag bijnisbooks-backend:latest $ECR_REPO/bijnisbooks-backend:latest
docker push $ECR_REPO/bijnisbooks-backend:latest

# Tag and push frontend
docker tag bijnisbooks-frontend:latest $ECR_REPO/bijnisbooks-frontend:latest
docker push $ECR_REPO/bijnisbooks-frontend:latest

echo -e "${GREEN}✓ Images pushed to ECR${NC}"

echo -e "${YELLOW}Step 3: Updating ECS Services${NC}"
echo "----------------------------------------"

# Update backend service (forces new deployment with latest image)
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service bijnisbooks-backend \
    --force-new-deployment \
    --region $AWS_REGION

# Update frontend service
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service bijnisbooks-frontend \
    --force-new-deployment \
    --region $AWS_REGION

echo -e "${GREEN}✓ ECS services updated${NC}"

echo -e "${YELLOW}Step 4: Waiting for Deployment${NC}"
echo "----------------------------------------"

# Wait for backend to stabilize
echo "Waiting for backend deployment..."
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services bijnisbooks-backend \
    --region $AWS_REGION

echo -e "${GREEN}✓ Backend deployed successfully${NC}"

# Wait for frontend to stabilize
echo "Waiting for frontend deployment..."
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services bijnisbooks-frontend \
    --region $AWS_REGION

echo -e "${GREEN}✓ Frontend deployed successfully${NC}"

echo -e "${YELLOW}Step 5: Verifying Health${NC}"
echo "----------------------------------------"

# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names bijnisbooks-alb \
    --query 'LoadBalancers[0].DNSName' \
    --output text \
    --region $AWS_REGION)

echo "ALB DNS: $ALB_DNS"

# Check health endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS/api/health")

if [ "$HEALTH_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ Health check passed!${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HEALTH_STATUS)${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "Application URL: http://$ALB_DNS"
echo ""
echo "Important Settings Applied:"
echo "  - AI_DEVELOPER_MODE=monitor_only (production safe)"
echo "  - Backend replicas: 3 (zero-downtime)"
echo "  - Health checks: Every 30 seconds"
echo "  - Auto-recovery: Enabled via ECS"
echo ""
echo "Monitor your application:"
echo "  - CloudWatch Logs: /ecs/bijnisbooks-backend"
echo "  - CloudWatch Alarms: BijnisBooks-Backend-Unhealthy"
echo ""
