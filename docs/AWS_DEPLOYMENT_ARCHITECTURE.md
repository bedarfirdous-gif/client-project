# AWS Production Deployment Architecture

## The Problem We Solved Today
The AI Senior Developer was trying to restart the backend FROM WITHIN the backend process.
This caused a crash because a service cannot safely restart itself.

## Production Architecture for AWS

### 1. Service Separation (Required)
```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │    │   Backend    │    │  AI Monitor  │       │
│  │   (ECS/EKS)  │    │   (ECS/EKS)  │    │  (Separate)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │  Load Balancer  │                          │
│                    │  (ALB/NLB)      │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              │              │              │                    │
│        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐             │
│        │  MongoDB  │  │   Redis   │  │    S3     │             │
│        │  (Atlas)  │  │(ElastiCache│  │ (Assets)  │             │
│        └───────────┘  └───────────┘  └───────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. External Health Monitoring Options

#### Option A: AWS Native (Recommended for Small-Medium)
```yaml
# ECS Service with Auto-Recovery
Services:
  Backend:
    HealthCheck:
      Path: /api/health
      Interval: 30s
      Timeout: 5s
      HealthyThreshold: 2
      UnhealthyThreshold: 3
    AutoScaling:
      MinCapacity: 2
      MaxCapacity: 10
      TargetCPU: 70%
    
  # ALB automatically replaces unhealthy containers
```

#### Option B: Kubernetes (EKS) - Recommended for Large Scale
```yaml
# Kubernetes Deployment with Liveness/Readiness Probes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8001
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Option C: Separate Monitoring Service (Our AI Senior Developer)
```python
# Deploy AI Monitor as SEPARATE service
# File: ai_monitor_service.py (runs independently)

class ExternalAIMonitor:
    """
    Runs as a SEPARATE container/service
    Can safely restart other services
    """
    
    def __init__(self):
        self.services = {
            'backend': 'http://backend-service:8001/api/health',
            'frontend': 'http://frontend-service:3000'
        }
    
    async def check_and_heal(self):
        for service, url in self.services.items():
            if not await self.is_healthy(url):
                await self.restart_service(service)
    
    async def restart_service(self, service):
        # Use AWS SDK to restart ECS task
        import boto3
        ecs = boto3.client('ecs')
        ecs.update_service(
            cluster='production',
            service=service,
            forceNewDeployment=True
        )
```

### 3. Recommended AWS Services

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Container Orchestration | ECS Fargate or EKS | Auto-restart failed containers |
| Load Balancer | ALB | Health checks, traffic routing |
| Database | MongoDB Atlas or DocumentDB | Managed, auto-failover |
| Cache | ElastiCache (Redis) | Session storage, caching |
| Monitoring | CloudWatch | Logs, metrics, alarms |
| Alerting | SNS + Lambda | Auto-remediation |
| CI/CD | CodePipeline + CodeDeploy | Zero-downtime deployments |

### 4. CloudWatch Alarms for Auto-Recovery

```json
{
  "AlarmName": "Backend-Unhealthy",
  "MetricName": "UnHealthyHostCount",
  "Namespace": "AWS/ApplicationELB",
  "Threshold": 1,
  "ComparisonOperator": "GreaterThanOrEqualToThreshold",
  "AlarmActions": [
    "arn:aws:sns:region:account:notify-team",
    "arn:aws:lambda:region:account:auto-restart-backend"
  ]
}
```

### 5. What Happens When Service Crashes in Production?

```
Timeline of Auto-Recovery:

0s    - Backend crashes
5s    - ALB health check fails (1st)
10s   - ALB health check fails (2nd) 
15s   - ALB health check fails (3rd) - UNHEALTHY
15s   - ALB stops routing traffic to unhealthy container
15s   - ECS detects unhealthy task
20s   - ECS starts new container
30s   - New container passes health check
30s   - ALB routes traffic to new container
        
Total Downtime: ~15-30 seconds (with multiple replicas: 0 seconds)
```

### 6. Zero-Downtime Strategy

```
┌─────────────────────────────────────────┐
│         Production Setup                 │
├─────────────────────────────────────────┤
│                                          │
│   Backend Replicas: 3 (minimum)          │
│   Frontend Replicas: 2 (minimum)         │
│                                          │
│   If 1 crashes:                          │
│   - 2 others handle traffic              │
│   - Auto-recovery starts new one         │
│   - User sees NO downtime                │
│                                          │
└─────────────────────────────────────────┘
```

### 7. Our Current Fix (Development)

For development/preview environment, we fixed it by:
1. Removing self-restart capability from backend
2. Backend only monitors - doesn't restart itself
3. Frontend can be safely restarted by backend

For production, deploy the AI Monitor as a **separate service** that CAN restart both frontend and backend safely.

## Summary

| Environment | Who Restarts Backend? |
|-------------|----------------------|
| Development | Manual / Supervisor |
| Production (AWS) | ECS/EKS + ALB Health Checks |
| AI Senior Developer | NEVER (monitors only, alerts team) |

## Deployment Checklist for AWS

- [ ] Deploy backend with 3+ replicas
- [ ] Configure ALB health checks on `/api/health`
- [ ] Set up CloudWatch alarms
- [ ] Configure SNS notifications
- [ ] Deploy AI Monitor as separate service (optional)
- [ ] Test failover by killing a container
- [ ] Verify zero-downtime deployment
