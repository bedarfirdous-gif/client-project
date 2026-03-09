#!/bin/bash
# ============================================
# BijnisBooks AWS Deployment Script
# ============================================
# This script automates the deployment to AWS ECS
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Docker installed and running
#   - ECR repositories created
#
# Usage: ./deploy.sh [environment]
#   environment: dev, staging, prod (default: dev)

set -e

# ============================================
# Configuration
# ============================================
ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

BACKEND_REPO="bijnisbooks-backend"
FRONTEND_REPO="bijnisbooks-frontend"
CLUSTER_NAME="bijnisbooks-cluster"

# Image tags
IMAGE_TAG="${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"
LATEST_TAG="${ENVIRONMENT}-latest"

echo "============================================"
echo "BijnisBooks Deployment"
echo "============================================"
echo "Environment: ${ENVIRONMENT}"
echo "AWS Region: ${AWS_REGION}"
echo "AWS Account: ${AWS_ACCOUNT_ID}"
echo "Image Tag: ${IMAGE_TAG}"
echo "============================================"

# ============================================
# Step 1: Login to ECR
# ============================================
echo ""
echo "Step 1: Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# ============================================
# Step 2: Build Docker Images
# ============================================
echo ""
echo "Step 2: Building Docker images..."

# Build backend
echo "Building backend image..."
docker build -t ${BACKEND_REPO}:${IMAGE_TAG} \
    -f deployment/aws/Dockerfile.backend \
    --build-arg ENVIRONMENT=${ENVIRONMENT} \
    ../..

# Build frontend
echo "Building frontend image..."
docker build -t ${FRONTEND_REPO}:${IMAGE_TAG} \
    -f deployment/aws/Dockerfile.frontend \
    --build-arg REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL} \
    ../..

# ============================================
# Step 3: Tag Images
# ============================================
echo ""
echo "Step 3: Tagging images..."

docker tag ${BACKEND_REPO}:${IMAGE_TAG} ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}
docker tag ${BACKEND_REPO}:${IMAGE_TAG} ${ECR_REGISTRY}/${BACKEND_REPO}:${LATEST_TAG}

docker tag ${FRONTEND_REPO}:${IMAGE_TAG} ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}
docker tag ${FRONTEND_REPO}:${IMAGE_TAG} ${ECR_REGISTRY}/${FRONTEND_REPO}:${LATEST_TAG}

# ============================================
# Step 4: Push Images to ECR
# ============================================
echo ""
echo "Step 4: Pushing images to ECR..."

docker push ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}
docker push ${ECR_REGISTRY}/${BACKEND_REPO}:${LATEST_TAG}

docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}
docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:${LATEST_TAG}

# ============================================
# Step 5: Update ECS Services
# ============================================
echo ""
echo "Step 5: Updating ECS services..."

# Update backend service
echo "Updating backend service..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service bijnisbooks-backend \
    --force-new-deployment \
    --region ${AWS_REGION}

# Update frontend service
echo "Updating frontend service..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service bijnisbooks-frontend \
    --force-new-deployment \
    --region ${AWS_REGION}

# ============================================
# Step 6: Wait for Deployment
# ============================================
echo ""
echo "Step 6: Waiting for deployment to complete..."

aws ecs wait services-stable \
    --cluster ${CLUSTER_NAME} \
    --services bijnisbooks-backend bijnisbooks-frontend \
    --region ${AWS_REGION}

# ============================================
# Deployment Complete
# ============================================
echo ""
echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo "Backend Image: ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}"
echo "Frontend Image: ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"
echo ""
echo "To check deployment status:"
echo "  aws ecs describe-services --cluster ${CLUSTER_NAME} --services bijnisbooks-backend bijnisbooks-frontend"
echo ""
