"""
Health Monitor
==============
Real-time system health tracking and metrics collection.
"""

import asyncio
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import uuid
import psutil

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HealthMonitor")


class ServiceStatus(Enum):
    """Status of a service"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class MetricType(Enum):
    """Types of metrics"""
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    NETWORK = "network"
    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"
    REQUEST_RATE = "request_rate"
    DATABASE = "database"


@dataclass
class HealthMetric:
    """A health metric measurement"""
    metric_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    metric_type: MetricType = MetricType.CPU
    name: str = ""
    value: float = 0.0
    unit: str = ""
    
    # Thresholds
    warning_threshold: float = 0.0
    critical_threshold: float = 0.0
    
    # Status based on value
    status: ServiceStatus = ServiceStatus.HEALTHY
    
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class ServiceHealth:
    """Health status of a service"""
    service_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    status: ServiceStatus = ServiceStatus.UNKNOWN
    
    # Metrics
    metrics: List[HealthMetric] = field(default_factory=list)
    
    # Connectivity
    is_reachable: bool = False
    last_response_time_ms: float = 0.0
    last_error: Optional[str] = None
    
    # Uptime
    uptime_seconds: float = 0.0
    last_restart: Optional[str] = None
    
    # Checks
    last_check: Optional[str] = None
    consecutive_failures: int = 0
    consecutive_successes: int = 0


@dataclass
class SystemHealth:
    """Overall system health"""
    status: ServiceStatus = ServiceStatus.UNKNOWN
    services: List[ServiceHealth] = field(default_factory=list)
    metrics: List[HealthMetric] = field(default_factory=list)
    
    # Summary
    healthy_services: int = 0
    degraded_services: int = 0
    unhealthy_services: int = 0
    
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class HealthMonitor:
    """
    System health monitoring service.
    
    Features:
    - Monitor service health (backend, frontend, database)
    - Collect system metrics (CPU, memory, disk)
    - Track error rates and response times
    - Alert on threshold breaches
    """
    
    def __init__(self, db=None):
        self.db = db
        self.services: Dict[str, ServiceHealth] = {}
        self.metrics_history: List[HealthMetric] = []
        self.is_monitoring = False
        self.monitor_task: Optional[asyncio.Task] = None
        self.check_interval = 30  # seconds
        self.max_history = 1000
        
        # Alert callbacks
        self.alert_callbacks: List[Callable] = []
        
        # Collections
        if db is not None:
            self.health_collection = db.health_metrics
            self.alerts_collection = db.health_alerts
        
        # Initialize service definitions
        self._init_services()
        
        logger.info("HealthMonitor initialized")
    
    def _init_services(self):
        """Initialize service definitions"""
        self.services["backend"] = ServiceHealth(
            name="Backend API",
            status=ServiceStatus.UNKNOWN
        )
        self.services["frontend"] = ServiceHealth(
            name="Frontend",
            status=ServiceStatus.UNKNOWN
        )
        self.services["mongodb"] = ServiceHealth(
            name="MongoDB",
            status=ServiceStatus.UNKNOWN
        )
    
    async def start_monitoring(self):
        """Start health monitoring loop"""
        if self.is_monitoring:
            return
        
        self.is_monitoring = True
        self.monitor_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Health monitoring started")
    
    async def stop_monitoring(self):
        """Stop health monitoring"""
        self.is_monitoring = False
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
        logger.info("Health monitoring stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                await self.check_all_services()
                await self.collect_system_metrics()
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
            
            await asyncio.sleep(self.check_interval)
    
    async def check_all_services(self) -> Dict[str, ServiceHealth]:
        """Check health of all services"""
        await asyncio.gather(
            self._check_backend(),
            self._check_frontend(),
            self._check_mongodb()
        )
        
        return self.services
    
    async def _check_backend(self):
        """Check backend service health"""
        service = self.services["backend"]
        service.last_check = datetime.now(timezone.utc).isoformat()
        
        try:
            start_time = datetime.now(timezone.utc)
            
            proc = await asyncio.create_subprocess_exec(
                'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                'http://localhost:8001/api/health',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            
            end_time = datetime.now(timezone.utc)
            response_time = (end_time - start_time).total_seconds() * 1000
            
            status_code = int(stdout.decode().strip()) if stdout else 0
            
            service.is_reachable = status_code == 200
            service.last_response_time_ms = response_time
            
            if status_code == 200:
                service.status = ServiceStatus.HEALTHY
                service.consecutive_successes += 1
                service.consecutive_failures = 0
                service.last_error = None
            elif status_code >= 500:
                service.status = ServiceStatus.UNHEALTHY
                service.consecutive_failures += 1
                service.consecutive_successes = 0
                service.last_error = f"HTTP {status_code}"
            else:
                service.status = ServiceStatus.DEGRADED
                service.last_error = f"HTTP {status_code}"
            
            # Add response time metric
            service.metrics = [
                HealthMetric(
                    metric_type=MetricType.RESPONSE_TIME,
                    name="Response Time",
                    value=response_time,
                    unit="ms",
                    warning_threshold=1000,
                    critical_threshold=5000,
                    status=self._get_metric_status(response_time, 1000, 5000)
                )
            ]
            
        except asyncio.TimeoutError:
            service.status = ServiceStatus.UNHEALTHY
            service.is_reachable = False
            service.last_error = "Timeout"
            service.consecutive_failures += 1
        except Exception as e:
            service.status = ServiceStatus.UNHEALTHY
            service.is_reachable = False
            service.last_error = str(e)
            service.consecutive_failures += 1
    
    async def _check_frontend(self):
        """Check frontend service health"""
        service = self.services["frontend"]
        service.last_check = datetime.now(timezone.utc).isoformat()
        
        try:
            start_time = datetime.now(timezone.utc)
            
            proc = await asyncio.create_subprocess_exec(
                'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                'http://localhost:3000',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            
            end_time = datetime.now(timezone.utc)
            response_time = (end_time - start_time).total_seconds() * 1000
            
            status_code = int(stdout.decode().strip()) if stdout else 0
            
            service.is_reachable = status_code in [200, 304]
            service.last_response_time_ms = response_time
            
            if status_code in [200, 304]:
                service.status = ServiceStatus.HEALTHY
                service.consecutive_successes += 1
                service.consecutive_failures = 0
            else:
                service.status = ServiceStatus.UNHEALTHY
                service.consecutive_failures += 1
                service.last_error = f"HTTP {status_code}"
            
        except asyncio.TimeoutError:
            service.status = ServiceStatus.UNHEALTHY
            service.is_reachable = False
            service.last_error = "Timeout"
        except Exception as e:
            service.status = ServiceStatus.UNHEALTHY
            service.last_error = str(e)
    
    async def _check_mongodb(self):
        """Check MongoDB health"""
        service = self.services["mongodb"]
        service.last_check = datetime.now(timezone.utc).isoformat()
        
        try:
            if self.db is not None:
                # Try to ping the database
                await self.db.command("ping")
                service.status = ServiceStatus.HEALTHY
                service.is_reachable = True
                service.consecutive_successes += 1
                service.consecutive_failures = 0
            else:
                service.status = ServiceStatus.UNKNOWN
                service.last_error = "No database connection"
            
        except Exception as e:
            service.status = ServiceStatus.UNHEALTHY
            service.is_reachable = False
            service.last_error = str(e)
            service.consecutive_failures += 1
    
    async def collect_system_metrics(self) -> List[HealthMetric]:
        """Collect system-level metrics"""
        metrics = []
        timestamp = datetime.now(timezone.utc).isoformat()
        
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=1)
            metrics.append(HealthMetric(
                metric_type=MetricType.CPU,
                name="CPU Usage",
                value=cpu_percent,
                unit="%",
                warning_threshold=70,
                critical_threshold=90,
                status=self._get_metric_status(cpu_percent, 70, 90),
                timestamp=timestamp
            ))
            
            # Memory
            memory = psutil.virtual_memory()
            metrics.append(HealthMetric(
                metric_type=MetricType.MEMORY,
                name="Memory Usage",
                value=memory.percent,
                unit="%",
                warning_threshold=80,
                critical_threshold=95,
                status=self._get_metric_status(memory.percent, 80, 95),
                timestamp=timestamp
            ))
            
            # Disk
            disk = psutil.disk_usage('/')
            metrics.append(HealthMetric(
                metric_type=MetricType.DISK,
                name="Disk Usage",
                value=disk.percent,
                unit="%",
                warning_threshold=80,
                critical_threshold=95,
                status=self._get_metric_status(disk.percent, 80, 95),
                timestamp=timestamp
            ))
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
        
        # Store metrics
        self.metrics_history.extend(metrics)
        if len(self.metrics_history) > self.max_history:
            self.metrics_history = self.metrics_history[-self.max_history:]
        
        if self.db is not None:
            for metric in metrics:
                await self.health_collection.insert_one({
                    "metric_id": metric.metric_id,
                    "metric_type": metric.metric_type.value,
                    "name": metric.name,
                    "value": metric.value,
                    "unit": metric.unit,
                    "status": metric.status.value,
                    "timestamp": metric.timestamp
                })
        
        # Check for alerts
        for metric in metrics:
            if metric.status in [ServiceStatus.DEGRADED, ServiceStatus.UNHEALTHY]:
                await self._trigger_alert(metric)
        
        return metrics
    
    def _get_metric_status(self, value: float, warning: float, critical: float) -> ServiceStatus:
        """Determine status based on thresholds"""
        if value >= critical:
            return ServiceStatus.UNHEALTHY
        elif value >= warning:
            return ServiceStatus.DEGRADED
        else:
            return ServiceStatus.HEALTHY
    
    async def _trigger_alert(self, metric: HealthMetric):
        """Trigger an alert for a metric"""
        alert = {
            "alert_id": str(uuid.uuid4()),
            "metric_type": metric.metric_type.value,
            "metric_name": metric.name,
            "value": metric.value,
            "status": metric.status.value,
            "threshold_type": "critical" if metric.status == ServiceStatus.UNHEALTHY else "warning",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if self.db is not None:
            await self.alerts_collection.insert_one(alert)
        
        # Call alert callbacks
        for callback in self.alert_callbacks:
            try:
                await callback(alert)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")
    
    def register_alert_callback(self, callback: Callable):
        """Register a callback for alerts"""
        self.alert_callbacks.append(callback)
    
    async def get_system_health(self) -> SystemHealth:
        """Get overall system health"""
        await self.check_all_services()
        
        health = SystemHealth()
        health.services = list(self.services.values())
        health.metrics = self.metrics_history[-10:] if self.metrics_history else []
        
        # Count service statuses
        for service in health.services:
            if service.status == ServiceStatus.HEALTHY:
                health.healthy_services += 1
            elif service.status == ServiceStatus.DEGRADED:
                health.degraded_services += 1
            else:
                health.unhealthy_services += 1
        
        # Determine overall status
        if health.unhealthy_services > 0:
            health.status = ServiceStatus.UNHEALTHY
        elif health.degraded_services > 0:
            health.status = ServiceStatus.DEGRADED
        elif health.healthy_services > 0:
            health.status = ServiceStatus.HEALTHY
        else:
            health.status = ServiceStatus.UNKNOWN
        
        return health
    
    async def get_metrics_history(
        self,
        metric_type: Optional[MetricType] = None,
        hours: int = 1
    ) -> List[Dict]:
        """Get metrics history"""
        if self.db is None:
            filtered = self.metrics_history
            if metric_type:
                filtered = [m for m in filtered if m.metric_type == metric_type]
            return [
                {
                    "metric_type": m.metric_type.value,
                    "name": m.name,
                    "value": m.value,
                    "status": m.status.value,
                    "timestamp": m.timestamp
                }
                for m in filtered[-100:]
            ]
        
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        query = {"timestamp": {"$gte": since}}
        
        if metric_type:
            query["metric_type"] = metric_type.value
        
        cursor = self.health_collection.find(query, {"_id": 0}).sort("timestamp", -1).limit(100)
        return await cursor.to_list(100)
    
    async def get_health_summary(self) -> Dict[str, Any]:
        """Get health summary for dashboard"""
        health = await self.get_system_health()
        
        return {
            "overall_status": health.status.value,
            "services": {
                s.name: {
                    "status": s.status.value,
                    "is_reachable": s.is_reachable,
                    "response_time_ms": s.last_response_time_ms,
                    "last_error": s.last_error
                }
                for s in health.services
            },
            "metrics": {
                "healthy": health.healthy_services,
                "degraded": health.degraded_services,
                "unhealthy": health.unhealthy_services
            },
            "system": {
                m.name: {"value": m.value, "unit": m.unit, "status": m.status.value}
                for m in health.metrics
            },
            "timestamp": health.timestamp
        }
