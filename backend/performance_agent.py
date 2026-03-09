"""
Performance Optimization Agent - AI-Powered Speed Enhancement
=============================================================
An AI agent that automatically analyzes and optimizes application performance
to achieve sub-3-second load times.

Features:
1. Performance metrics monitoring
2. Code splitting optimization
3. Lazy loading improvements
4. Asset compression analysis
5. Database query optimization
6. Bundle size analysis
7. Caching strategy optimization
8. Real-time performance scoring

Author: Performance Optimization Agent
Version: 1.0.0
"""

import os
import re
import json
import asyncio
import logging
import uuid
import subprocess
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase
from emergentintegrations.llm.chat import LlmChat, UserMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PerformanceAgent")


class OptimizationType(Enum):
    """Types of performance optimizations"""
    CODE_SPLITTING = "code_splitting"
    LAZY_LOADING = "lazy_loading"
    ASSET_COMPRESSION = "asset_compression"
    DATABASE_QUERY = "database_query"
    CACHING = "caching"
    BUNDLE_SIZE = "bundle_size"
    RENDER_BLOCKING = "render_blocking"
    MEMORY_USAGE = "memory_usage"
    API_RESPONSE = "api_response"
    IMAGE_OPTIMIZATION = "image_optimization"


class ImpactLevel(Enum):
    """Impact level of optimization"""
    HIGH = "high"  # > 1s improvement
    MEDIUM = "medium"  # 0.3-1s improvement
    LOW = "low"  # < 0.3s improvement


class OptimizationStatus(Enum):
    """Status of an optimization"""
    DETECTED = "detected"
    ANALYZING = "analyzing"
    READY = "ready"
    APPLIED = "applied"
    VERIFIED = "verified"
    ROLLED_BACK = "rolled_back"


@dataclass
class PerformanceIssue:
    """Represents a detected performance issue"""
    issue_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    optimization_type: OptimizationType = OptimizationType.CODE_SPLITTING
    impact_level: ImpactLevel = ImpactLevel.MEDIUM
    component: str = ""
    file_path: str = ""
    description: str = ""
    current_metric: float = 0
    target_metric: float = 0
    potential_improvement: float = 0
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class PerformanceOptimization:
    """Represents an optimization to apply"""
    optimization_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    issue_id: str = ""
    optimization_type: OptimizationType = OptimizationType.CODE_SPLITTING
    description: str = ""
    original_code: str = ""
    optimized_code: str = ""
    config_changes: Dict[str, Any] = field(default_factory=dict)
    estimated_improvement_ms: float = 0
    status: OptimizationStatus = OptimizationStatus.DETECTED
    applied_at: Optional[str] = None


# Performance patterns to detect
PERFORMANCE_PATTERNS = {
    OptimizationType.CODE_SPLITTING: {
        "detection_patterns": [
            r"import\s+\{[^}]+\}\s+from\s+['\"](?!react|\.)",  # Non-lazy imports
            r"import\s+\w+\s+from\s+['\"](?!react|\.)",
        ],
        "description": "Large imports that should be code-split",
        "impact": ImpactLevel.HIGH
    },
    OptimizationType.LAZY_LOADING: {
        "detection_patterns": [
            r"import\s+(\w+)\s+from\s+['\"]\.\.?/pages/",  # Direct page imports
            r"import\s+(\w+)\s+from\s+['\"]\.\.?/components/(?!ui)",  # Large component imports
        ],
        "description": "Components that should be lazy loaded",
        "impact": ImpactLevel.HIGH
    },
    OptimizationType.RENDER_BLOCKING: {
        "detection_patterns": [
            r"useEffect\(\s*\(\)\s*=>\s*\{[^}]*fetch",  # Fetch in useEffect without deps
            r"useState\([^)]*fetch",  # Fetch in initial state
        ],
        "description": "Render-blocking operations",
        "impact": ImpactLevel.MEDIUM
    },
    OptimizationType.MEMORY_USAGE: {
        "detection_patterns": [
            r"\.map\([^)]+\)\.filter\(",  # Chained array operations
            r"JSON\.parse\(JSON\.stringify",  # Deep clone pattern
        ],
        "description": "Memory-intensive operations",
        "impact": ImpactLevel.MEDIUM
    },
    OptimizationType.IMAGE_OPTIMIZATION: {
        "detection_patterns": [
            r"<img\s+src=['\"][^'\"]+\.(png|jpg|jpeg)['\"](?![^>]*loading)",  # Images without lazy loading
            r"background-image:\s*url\(['\"][^'\"]+\.(png|jpg|jpeg)",
        ],
        "description": "Unoptimized image loading",
        "impact": ImpactLevel.MEDIUM
    }
}

# Optimization templates
OPTIMIZATION_TEMPLATES = {
    "lazy_import": """
// BEFORE: Direct import
// import {Component} from './Component';

// AFTER: Lazy import with React.lazy
const {Component} = React.lazy(() => import('./Component'));

// Usage with Suspense
<Suspense fallback={<LoadingSkeleton />}>
  <Component />
</Suspense>
""",
    "code_splitting": """
// BEFORE: Large bundle import
// import { feature1, feature2, feature3 } from 'large-library';

// AFTER: Dynamic imports for code splitting
const loadFeature = async (featureName) => {
  const module = await import(`large-library/${featureName}`);
  return module.default;
};
""",
    "image_lazy_loading": """
// BEFORE: Immediate image load
// <img src="/image.jpg" alt="..." />

// AFTER: Lazy loaded image
<img 
  src="/image.jpg" 
  alt="..." 
  loading="lazy"
  decoding="async"
/>
""",
    "memo_optimization": """
// BEFORE: Component re-renders on every parent update
// export function ExpensiveComponent({ data }) { ... }

// AFTER: Memoized component
export const ExpensiveComponent = React.memo(function ExpensiveComponent({ data }) {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.data.id === nextProps.data.id;
});
""",
    "useCallback_optimization": """
// BEFORE: New function reference on every render
// const handleClick = () => { ... };

// AFTER: Stable function reference
const handleClick = useCallback(() => {
  // Handler logic
}, [/* dependencies */]);
""",
    "useMemo_optimization": """
// BEFORE: Expensive computation on every render
// const sortedData = data.sort((a, b) => ...);

// AFTER: Memoized computation
const sortedData = useMemo(() => {
  return data.sort((a, b) => ...);
}, [data]);
""",
    "api_caching": """
// BEFORE: Fetch on every render
// useEffect(() => { fetchData(); }, []);

// AFTER: Cached fetch with SWR pattern
const { data, error, isLoading } = useSWR(
  '/api/data',
  fetcher,
  { 
    revalidateOnFocus: false,
    dedupingInterval: 60000 
  }
);
""",
    "database_indexing": """
# BEFORE: Slow query without index
# await collection.find({"field": value})

# AFTER: Create index for frequent queries
await collection.create_index([("field", 1)])
# Then query uses index automatically
""",
    "bundle_analysis": """
// Add to package.json scripts
"scripts": {
  "analyze": "source-map-explorer 'build/static/js/*.js'"
}

// Run: npm run build && npm run analyze
"""
}


class PerformanceOptimizationAgent:
    """
    AI Agent for automatically optimizing application performance.
    
    Capabilities:
    1. Analyze frontend bundle size and suggest code splitting
    2. Detect and implement lazy loading opportunities
    3. Optimize database queries with indexing
    4. Implement caching strategies
    5. Compress and optimize assets
    6. Monitor and report performance metrics
    7. Auto-apply safe optimizations
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, api_key: str):
        self.db = db
        self.api_key = api_key
        self.issues_collection = db.performance_issues
        self.optimizations_collection = db.performance_optimizations
        self.metrics_collection = db.performance_metrics
        self.config_collection = db.performance_config
        
        # Paths
        self.frontend_src = "/app/frontend/src"
        self.backend_src = "/app/backend"
        
        # Target performance
        self.target_load_time_ms = 3000  # 3 seconds
        
        logger.info("Performance Optimization Agent initialized")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.issues_collection.create_index([("detected_at", -1)])
        await self.issues_collection.create_index([("optimization_type", 1)])
        await self.issues_collection.create_index([("impact_level", 1)])
        await self.optimizations_collection.create_index([("issue_id", 1)])
        await self.optimizations_collection.create_index([("status", 1)])
        await self.metrics_collection.create_index([("recorded_at", -1)])
        logger.info("Performance Optimization Agent indexes created")
    
    async def analyze_performance(self) -> Dict[str, Any]:
        """Run a full performance analysis"""
        analysis = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "frontend_issues": [],
            "backend_issues": [],
            "recommendations": [],
            "estimated_improvement_ms": 0,
            "current_score": 0,
            "target_score": 100
        }
        
        # Analyze frontend
        frontend_issues = await self._analyze_frontend()
        analysis["frontend_issues"] = frontend_issues
        
        # Analyze backend
        backend_issues = await self._analyze_backend()
        analysis["backend_issues"] = backend_issues
        
        # Calculate potential improvement
        all_issues = frontend_issues + backend_issues
        total_improvement = sum(
            issue.get("potential_improvement_ms", 0) for issue in all_issues
        )
        analysis["estimated_improvement_ms"] = total_improvement
        
        # Generate recommendations
        analysis["recommendations"] = await self._generate_recommendations(all_issues)
        
        # Calculate performance score (0-100)
        issues_by_impact = {"high": 0, "medium": 0, "low": 0}
        for issue in all_issues:
            impact = issue.get("impact_level", "low")
            issues_by_impact[impact] += 1
        
        # Score calculation: Start at 100, deduct based on issues
        score = 100
        score -= issues_by_impact["high"] * 10
        score -= issues_by_impact["medium"] * 5
        score -= issues_by_impact["low"] * 2
        analysis["current_score"] = max(0, min(100, score))
        
        # Save metrics
        await self.metrics_collection.insert_one({
            "metric_id": str(uuid.uuid4()),
            "score": analysis["current_score"],
            "issues_count": len(all_issues),
            "estimated_improvement_ms": total_improvement,
            "recorded_at": datetime.now(timezone.utc).isoformat()
        })
        
        return analysis
    
    async def _analyze_frontend(self) -> List[Dict]:
        """Analyze frontend for performance issues"""
        issues = []
        
        # Scan all JS/JSX files
        for root, dirs, files in os.walk(self.frontend_src):
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'build', 'ui']]
            
            for file in files:
                if file.endswith(('.js', '.jsx', '.tsx', '.ts')):
                    file_path = os.path.join(root, file)
                    file_issues = await self._analyze_file(file_path)
                    issues.extend(file_issues)
        
        # Check bundle size
        bundle_issues = await self._analyze_bundle_size()
        issues.extend(bundle_issues)
        
        return issues
    
    async def _analyze_file(self, file_path: str) -> List[Dict]:
        """Analyze a single file for performance issues"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            logger.error(f"Failed to read {file_path}: {e}")
            return issues
        
        component_name = os.path.basename(file_path).replace('.js', '').replace('.jsx', '')
        
        for opt_type, config in PERFORMANCE_PATTERNS.items():
            for pattern in config["detection_patterns"]:
                matches = list(re.finditer(pattern, content, re.MULTILINE))
                
                if matches:
                    # Find line numbers
                    line_numbers = []
                    for match in matches[:5]:  # Limit to 5 matches
                        start_pos = match.start()
                        line_num = content[:start_pos].count('\n') + 1
                        line_numbers.append(line_num)
                    
                    issue = PerformanceIssue(
                        optimization_type=opt_type,
                        impact_level=config["impact"],
                        component=component_name,
                        file_path=file_path,
                        description=config["description"],
                        potential_improvement=self._estimate_improvement(opt_type, len(matches))
                    )
                    
                    # Save to database
                    await self.issues_collection.update_one(
                        {"file_path": file_path, "optimization_type": opt_type.value},
                        {"$set": {
                            "issue_id": issue.issue_id,
                            "optimization_type": issue.optimization_type.value,
                            "impact_level": issue.impact_level.value,
                            "component": issue.component,
                            "file_path": issue.file_path,
                            "description": issue.description,
                            "potential_improvement_ms": issue.potential_improvement,
                            "line_numbers": line_numbers,
                            "match_count": len(matches),
                            "detected_at": issue.detected_at,
                            "status": "detected"
                        }},
                        upsert=True
                    )
                    
                    issues.append({
                        "issue_id": issue.issue_id,
                        "optimization_type": opt_type.value,
                        "impact_level": config["impact"].value,
                        "component": component_name,
                        "file_path": file_path,
                        "description": config["description"],
                        "potential_improvement_ms": issue.potential_improvement,
                        "line_numbers": line_numbers
                    })
        
        return issues
    
    async def _analyze_bundle_size(self) -> List[Dict]:
        """Analyze JavaScript bundle size"""
        issues = []
        
        # Check for large imports in App.js
        app_path = os.path.join(self.frontend_src, "App.js")
        if os.path.exists(app_path):
            with open(app_path, 'r') as f:
                content = f.read()
            
            # Count direct page imports
            page_imports = re.findall(r"import\s+\w+\s+from\s+['\"]\.\/pages\/", content)
            if len(page_imports) > 5:
                issues.append({
                    "issue_id": str(uuid.uuid4()),
                    "optimization_type": OptimizationType.CODE_SPLITTING.value,
                    "impact_level": ImpactLevel.HIGH.value,
                    "component": "App.js",
                    "file_path": app_path,
                    "description": f"Found {len(page_imports)} direct page imports. Use React.lazy for code splitting.",
                    "potential_improvement_ms": len(page_imports) * 50
                })
        
        return issues
    
    async def _analyze_backend(self) -> List[Dict]:
        """Analyze backend for performance issues"""
        issues = []
        
        # Check for missing database indexes
        # This would need actual query analysis
        
        # Check for N+1 query patterns
        server_path = os.path.join(self.backend_src, "server.py")
        if os.path.exists(server_path):
            with open(server_path, 'r') as f:
                content = f.read()
            
            # Look for loops with database calls
            loop_db_pattern = r"for\s+\w+\s+in\s+\w+:[^}]+(?:find_one|find|aggregate)"
            matches = re.findall(loop_db_pattern, content, re.DOTALL)
            
            if matches:
                issues.append({
                    "issue_id": str(uuid.uuid4()),
                    "optimization_type": OptimizationType.DATABASE_QUERY.value,
                    "impact_level": ImpactLevel.HIGH.value,
                    "component": "server.py",
                    "file_path": server_path,
                    "description": f"Potential N+1 query pattern detected. Consider batch queries.",
                    "potential_improvement_ms": len(matches) * 100
                })
        
        return issues
    
    def _estimate_improvement(self, opt_type: OptimizationType, match_count: int) -> float:
        """Estimate improvement in milliseconds"""
        base_improvements = {
            OptimizationType.CODE_SPLITTING: 100,
            OptimizationType.LAZY_LOADING: 80,
            OptimizationType.ASSET_COMPRESSION: 50,
            OptimizationType.DATABASE_QUERY: 150,
            OptimizationType.CACHING: 100,
            OptimizationType.BUNDLE_SIZE: 200,
            OptimizationType.RENDER_BLOCKING: 70,
            OptimizationType.MEMORY_USAGE: 30,
            OptimizationType.API_RESPONSE: 100,
            OptimizationType.IMAGE_OPTIMIZATION: 40
        }
        
        base = base_improvements.get(opt_type, 50)
        return min(base * match_count, 1000)  # Cap at 1 second
    
    async def _generate_recommendations(self, issues: List[Dict]) -> List[Dict]:
        """Generate prioritized recommendations"""
        recommendations = []
        
        # Group by type
        by_type = {}
        for issue in issues:
            opt_type = issue.get("optimization_type")
            if opt_type not in by_type:
                by_type[opt_type] = []
            by_type[opt_type].append(issue)
        
        # Generate recommendations for each type
        for opt_type, type_issues in by_type.items():
            if opt_type == OptimizationType.CODE_SPLITTING.value:
                recommendations.append({
                    "title": "Implement Code Splitting",
                    "description": f"Found {len(type_issues)} components that can be code-split using React.lazy()",
                    "impact": "high",
                    "estimated_improvement": f"{sum(i.get('potential_improvement_ms', 0) for i in type_issues)}ms",
                    "template": "lazy_import",
                    "auto_fixable": True
                })
            
            elif opt_type == OptimizationType.LAZY_LOADING.value:
                recommendations.append({
                    "title": "Add Lazy Loading",
                    "description": f"Found {len(type_issues)} components that should be lazy loaded",
                    "impact": "high",
                    "estimated_improvement": f"{sum(i.get('potential_improvement_ms', 0) for i in type_issues)}ms",
                    "template": "lazy_import",
                    "auto_fixable": True
                })
            
            elif opt_type == OptimizationType.IMAGE_OPTIMIZATION.value:
                recommendations.append({
                    "title": "Optimize Image Loading",
                    "description": f"Found {len(type_issues)} images without lazy loading",
                    "impact": "medium",
                    "estimated_improvement": f"{sum(i.get('potential_improvement_ms', 0) for i in type_issues)}ms",
                    "template": "image_lazy_loading",
                    "auto_fixable": True
                })
            
            elif opt_type == OptimizationType.DATABASE_QUERY.value:
                recommendations.append({
                    "title": "Optimize Database Queries",
                    "description": f"Found {len(type_issues)} potential N+1 query patterns",
                    "impact": "high",
                    "estimated_improvement": f"{sum(i.get('potential_improvement_ms', 0) for i in type_issues)}ms",
                    "template": "database_indexing",
                    "auto_fixable": False
                })
        
        # Sort by impact
        impact_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda x: impact_order.get(x.get("impact", "low"), 2))
        
        return recommendations
    
    async def generate_optimization(self, issue_id: str) -> Optional[PerformanceOptimization]:
        """Generate an optimization for an issue"""
        issue = await self.issues_collection.find_one({"issue_id": issue_id})
        if not issue:
            return None
        
        opt_type = issue.get("optimization_type")
        
        # Get template-based optimization
        template_key = self._get_template_key(opt_type)
        template = OPTIMIZATION_TEMPLATES.get(template_key, "")
        
        # Generate AI-powered optimization if template isn't enough
        if not template or issue.get("match_count", 0) > 3:
            optimized_code = await self._generate_ai_optimization(issue)
        else:
            optimized_code = template
        
        optimization = PerformanceOptimization(
            issue_id=issue_id,
            optimization_type=OptimizationType(opt_type),
            description=f"Optimize {issue.get('component')} for better performance",
            optimized_code=optimized_code,
            estimated_improvement_ms=issue.get("potential_improvement_ms", 0),
            status=OptimizationStatus.READY
        )
        
        await self.optimizations_collection.insert_one({
            "optimization_id": optimization.optimization_id,
            "issue_id": optimization.issue_id,
            "optimization_type": optimization.optimization_type.value,
            "description": optimization.description,
            "optimized_code": optimization.optimized_code[:5000],
            "estimated_improvement_ms": optimization.estimated_improvement_ms,
            "status": optimization.status.value,
            "generated_at": datetime.now(timezone.utc).isoformat()
        })
        
        return optimization
    
    def _get_template_key(self, opt_type: str) -> str:
        """Get the template key for an optimization type"""
        mapping = {
            "code_splitting": "code_splitting",
            "lazy_loading": "lazy_import",
            "image_optimization": "image_lazy_loading",
            "memory_usage": "useMemo_optimization",
            "caching": "api_caching",
            "database_query": "database_indexing"
        }
        return mapping.get(opt_type, "")
    
    async def _generate_ai_optimization(self, issue: Dict) -> str:
        """Generate AI-powered optimization"""
        # Read the file content
        file_path = issue.get("file_path", "")
        file_content = ""
        
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, 'r') as f:
                    file_content = f.read()[:8000]
            except:
                pass
        
        prompt = f"""You are a performance optimization expert.

PERFORMANCE ISSUE:
- Type: {issue.get('optimization_type')}
- Component: {issue.get('component')}
- Description: {issue.get('description')}
- Lines affected: {issue.get('line_numbers', [])}
- Potential improvement: {issue.get('potential_improvement_ms')}ms

FILE CONTENT:
```javascript
{file_content}
```

Generate an optimized version of the problematic code. Focus on:
1. Lazy loading for large components
2. Code splitting for better bundle size
3. Memoization for expensive computations
4. Efficient data structures

Return ONLY the optimized code snippet that can replace the problematic code."""

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"perf-opt-{issue['issue_id']}",
                system_message="You are a React/JavaScript performance optimization expert."
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(text=prompt))
            return response.strip()
            
        except Exception as e:
            logger.error(f"AI optimization failed: {e}")
            return ""
    
    async def apply_optimization(self, optimization_id: str) -> Dict[str, Any]:
        """Apply a generated optimization"""
        opt = await self.optimizations_collection.find_one({"optimization_id": optimization_id})
        if not opt:
            return {"status": "failed", "error": "Optimization not found"}
        
        issue = await self.issues_collection.find_one({"issue_id": opt["issue_id"]})
        if not issue:
            return {"status": "failed", "error": "Related issue not found"}
        
        result = {
            "optimization_id": optimization_id,
            "status": "pending",
            "file_path": issue.get("file_path"),
            "backup_path": None
        }
        
        # For safety, we don't auto-apply code changes
        # Instead, mark as ready for review
        await self.optimizations_collection.update_one(
            {"optimization_id": optimization_id},
            {"$set": {
                "status": OptimizationStatus.READY.value,
                "ready_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        result["status"] = "ready_for_review"
        result["optimized_code"] = opt.get("optimized_code", "")[:1000]
        
        return result
    
    async def auto_optimize_safe(self) -> Dict[str, Any]:
        """Automatically apply safe optimizations (images, simple lazy loading)"""
        results = {
            "optimizations_applied": 0,
            "improvements_ms": 0,
            "files_modified": [],
            "errors": []
        }
        
        # Get safe optimization types
        safe_types = [
            OptimizationType.IMAGE_OPTIMIZATION.value,
            OptimizationType.LAZY_LOADING.value
        ]
        
        issues = await self.issues_collection.find({
            "optimization_type": {"$in": safe_types},
            "status": "detected"
        }).to_list(50)
        
        for issue in issues:
            try:
                file_path = issue.get("file_path")
                if not file_path or not os.path.exists(file_path):
                    continue
                
                with open(file_path, 'r') as f:
                    content = f.read()
                
                original_content = content
                
                # Create backup
                backup_path = f"{file_path}.perf_backup"
                with open(backup_path, 'w') as f:
                    f.write(content)
                
                # Apply image lazy loading optimization
                if issue.get("optimization_type") == OptimizationType.IMAGE_OPTIMIZATION.value:
                    # Add loading="lazy" to img tags
                    optimized = re.sub(
                        r'<img(\s+[^>]*?)(?<!loading=["\'][^"\']*["\'])(\s*/?>)',
                        r'<img\1 loading="lazy"\2',
                        content
                    )
                    content = optimized
                
                # Apply lazy loading for components (simpler patterns)
                elif issue.get("optimization_type") == OptimizationType.LAZY_LOADING.value:
                    # This is more complex, skip for now to avoid breaking code
                    pass
                
                if content != original_content:
                    with open(file_path, 'w') as f:
                        f.write(content)
                    
                    results["optimizations_applied"] += 1
                    results["improvements_ms"] += issue.get("potential_improvement_ms", 0)
                    results["files_modified"].append(file_path)
                    
                    await self.issues_collection.update_one(
                        {"issue_id": issue["issue_id"]},
                        {"$set": {"status": "applied"}}
                    )
                
            except Exception as e:
                results["errors"].append({
                    "file": issue.get("file_path"),
                    "error": str(e)
                })
        
        # Also scan and fix images directly
        image_fixes = await self._fix_images_directly()
        results["optimizations_applied"] += image_fixes.get("count", 0)
        results["improvements_ms"] += image_fixes.get("improvement_ms", 0)
        results["files_modified"].extend(image_fixes.get("files", []))
        
        return results
    
    async def _fix_images_directly(self) -> Dict[str, Any]:
        """Scan and fix image lazy loading directly"""
        result = {"count": 0, "improvement_ms": 0, "files": []}
        
        for root, dirs, files in os.walk(self.frontend_src):
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'build', 'ui']]
            
            for file in files:
                if file.endswith(('.js', '.jsx', '.tsx')):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r') as f:
                            content = f.read()
                        
                        # Find img tags without loading="lazy"
                        pattern = r'<img\s+([^>]*?)(?<!loading=["\']lazy["\'])(\s*/?>)'
                        if re.search(pattern, content):
                            # Create backup
                            backup_path = f"{file_path}.perf_backup.{uuid.uuid4().hex[:8]}"
                            with open(backup_path, 'w') as f:
                                f.write(content)
                            
                            # Add loading="lazy" to all img tags that don't have it
                            optimized = re.sub(
                                r'<img(\s+)(?!.*loading=)',
                                r'<img loading="lazy"\1',
                                content
                            )
                            
                            if optimized != content:
                                with open(file_path, 'w') as f:
                                    f.write(optimized)
                                result["count"] += 1
                                result["improvement_ms"] += 40
                                result["files"].append(file_path)
                    except Exception as e:
                        logger.error(f"Failed to fix images in {file_path}: {e}")
        
        return result
    
    async def get_issues(self, status: str = None, impact: str = None) -> List[Dict]:
        """Get performance issues with optional filters"""
        query = {}
        if status:
            query["status"] = status
        if impact:
            query["impact_level"] = impact
        
        issues = await self.issues_collection.find(
            query, {"_id": 0}
        ).sort("detected_at", -1).to_list(100)
        
        return issues
    
    async def get_optimizations(self, status: str = None) -> List[Dict]:
        """Get optimizations with optional filters"""
        query = {}
        if status:
            query["status"] = status
        
        optimizations = await self.optimizations_collection.find(
            query, {"_id": 0}
        ).sort("generated_at", -1).to_list(50)
        
        return optimizations
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get statistics for the performance dashboard"""
        total_issues = await self.issues_collection.count_documents({})
        optimized = await self.issues_collection.count_documents({"status": "applied"})
        pending = await self.issues_collection.count_documents({"status": "detected"})
        
        # Get issues by type
        pipeline = [
            {"$group": {"_id": "$optimization_type", "count": {"$sum": 1}}}
        ]
        by_type = await self.issues_collection.aggregate(pipeline).to_list(20)
        
        # Get issues by impact
        impact_pipeline = [
            {"$group": {"_id": "$impact_level", "count": {"$sum": 1}}}
        ]
        by_impact = await self.issues_collection.aggregate(impact_pipeline).to_list(20)
        
        # Calculate total potential improvement
        improvement_pipeline = [
            {"$match": {"status": "detected"}},
            {"$group": {"_id": None, "total": {"$sum": "$potential_improvement_ms"}}}
        ]
        improvement_result = await self.issues_collection.aggregate(improvement_pipeline).to_list(1)
        potential_improvement = improvement_result[0]["total"] if improvement_result else 0
        
        # Get latest performance score
        latest_metric = await self.metrics_collection.find_one(
            {}, {"_id": 0}, sort=[("recorded_at", -1)]
        )
        
        return {
            "total_issues": total_issues,
            "optimized_issues": optimized,
            "pending_issues": pending,
            "optimization_rate": (optimized / total_issues * 100) if total_issues > 0 else 0,
            "potential_improvement_ms": potential_improvement,
            "target_load_time_ms": self.target_load_time_ms,
            "current_score": latest_metric.get("score", 0) if latest_metric else 0,
            "by_type": {item["_id"]: item["count"] for item in by_type},
            "by_impact": {item["_id"]: item["count"] for item in by_impact}
        }
    
    async def apply_code_splitting(self) -> Dict[str, Any]:
        """
        Automatically apply code splitting to React components.
        Converts direct imports to React.lazy imports.
        """
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "files_modified": [],
            "components_split": 0,
            "estimated_improvement_ms": 0,
            "errors": []
        }
        
        app_js_path = os.path.join(self.frontend_src, "App.js")
        
        if not os.path.exists(app_js_path):
            results["errors"].append("App.js not found")
            return results
        
        try:
            with open(app_js_path, 'r') as f:
                content = f.read()
            
            original_content = content
            
            # Create backup
            backup_path = f"{app_js_path}.code_split_backup.{uuid.uuid4().hex[:8]}"
            with open(backup_path, 'w') as f:
                f.write(content)
            
            # Find page imports that can be lazy loaded
            page_import_pattern = r"import\s+(\w+)\s+from\s+['\"](\./pages/[^'\"]+)['\"];"
            page_imports = re.findall(page_import_pattern, content)
            
            if page_imports:
                # Check if lazy is already imported from React
                has_lazy_import = bool(re.search(r"import.*\{[^}]*\blazy\b[^}]*\}.*from\s+['\"]react['\"]", content))
                has_suspense_import = bool(re.search(r"import.*\{[^}]*\bSuspense\b[^}]*\}.*from\s+['\"]react['\"]", content))
                
                if not has_lazy_import or not has_suspense_import:
                    # Need to add lazy and/or Suspense to React imports
                    react_import_match = re.search(r"import React,?\s*\{([^}]*)\}\s*from\s*['\"]react['\"]", content)
                    if react_import_match:
                        existing_imports = react_import_match.group(1)
                        imports_to_add = []
                        if not has_lazy_import:
                            imports_to_add.append('lazy')
                        if not has_suspense_import:
                            imports_to_add.append('Suspense')
                        
                        new_imports = existing_imports.strip()
                        for imp in imports_to_add:
                            if imp not in new_imports:
                                new_imports = new_imports.rstrip(', ') + ', ' + imp
                        
                        old_import = react_import_match.group(0)
                        new_import = f"import React, {{ {new_imports} }} from 'react'"
                        content = content.replace(old_import, new_import)
                    else:
                        # Simple React import without destructuring
                        content = content.replace(
                            "import React from 'react';",
                            "import React, { lazy, Suspense } from 'react';"
                        )
                
                # Add loading component if not exists
                if "LoadingFallback" not in content:
                    loading_component = """
// Code-split loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);
"""
                    # Add after imports
                    last_import = re.search(r"(import [^;]+from [^;]+;)\s*\n(?!import)", content)
                    if last_import:
                        pos = last_import.end()
                        content = content[:pos] + loading_component + content[pos:]
                
                # Convert page imports to lazy imports
                for component_name, import_path in page_imports:
                    old_import = f"import {component_name} from '{import_path}';"
                    new_import = f"const {component_name} = lazy(() => import('{import_path}'));"
                    
                    if old_import in content:
                        content = content.replace(old_import, new_import)
                        results["components_split"] += 1
                        results["estimated_improvement_ms"] += 50
                
                # Wrap Routes with Suspense if not already wrapped
                if "<Routes>" in content and "<Suspense" not in content:
                    content = content.replace(
                        "<Routes>",
                        "<Suspense fallback={<LoadingFallback />}>\n        <Routes>"
                    )
                    content = content.replace(
                        "</Routes>",
                        "</Routes>\n        </Suspense>"
                    )
            
            if content != original_content:
                with open(app_js_path, 'w') as f:
                    f.write(content)
                
                results["files_modified"].append({
                    "file": app_js_path,
                    "backup": backup_path
                })
                
                logger.info(f"Applied code splitting to {results['components_split']} components")
        
        except Exception as e:
            results["errors"].append(str(e))
            logger.error(f"Code splitting failed: {e}")
        
        return results
    
    async def analyze_asset_compression(self) -> Dict[str, Any]:
        """
        Analyze assets for compression opportunities.
        Checks images, CSS, and JavaScript files.
        """
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_assets_size_kb": 0,
            "compressible_size_kb": 0,
            "potential_savings_kb": 0,
            "assets": {
                "images": [],
                "css": [],
                "js": []
            },
            "recommendations": []
        }
        
        public_path = "/app/frontend/public"
        src_path = "/app/frontend/src"
        
        # Analyze images
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp')
        
        for base_path in [public_path, src_path]:
            if not os.path.exists(base_path):
                continue
            
            for root, dirs, files in os.walk(base_path):
                dirs[:] = [d for d in dirs if d not in ['node_modules', 'build']]
                
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        file_size = os.path.getsize(file_path) / 1024  # KB
                        results["total_assets_size_kb"] += file_size
                        
                        if file.lower().endswith(image_extensions):
                            asset_info = {
                                "file": file_path,
                                "size_kb": round(file_size, 2),
                                "format": os.path.splitext(file)[1].lower()
                            }
                            
                            # Check for optimization opportunities
                            if file_size > 100:  # Images > 100KB
                                asset_info["recommendation"] = "Consider compression or WebP conversion"
                                results["compressible_size_kb"] += file_size
                                results["potential_savings_kb"] += file_size * 0.3  # Estimate 30% savings
                            
                            if not file.lower().endswith('.webp'):
                                asset_info["format_recommendation"] = "Consider converting to WebP format"
                            
                            results["assets"]["images"].append(asset_info)
                        
                        elif file.endswith('.css'):
                            results["assets"]["css"].append({
                                "file": file_path,
                                "size_kb": round(file_size, 2)
                            })
                        
                        elif file.endswith('.js') and 'min' not in file:
                            results["assets"]["js"].append({
                                "file": file_path,
                                "size_kb": round(file_size, 2),
                                "recommendation": "Minify for production"
                            })
                    
                    except Exception as e:
                        logger.error(f"Error analyzing {file_path}: {e}")
        
        # Generate recommendations
        if results["potential_savings_kb"] > 100:
            results["recommendations"].append({
                "title": "Image Compression",
                "description": f"Compress images to save ~{round(results['potential_savings_kb'])}KB",
                "impact": "high"
            })
        
        large_images = [img for img in results["assets"]["images"] if img.get("size_kb", 0) > 200]
        if large_images:
            results["recommendations"].append({
                "title": "Large Images Detected",
                "description": f"Found {len(large_images)} images > 200KB that need optimization",
                "impact": "high",
                "files": [img["file"] for img in large_images[:5]]
            })
        
        non_webp = [img for img in results["assets"]["images"] if img.get("format") != '.webp']
        if len(non_webp) > 5:
            results["recommendations"].append({
                "title": "Convert to WebP",
                "description": f"{len(non_webp)} images can be converted to WebP for better compression",
                "impact": "medium"
            })
        
        return results
    
    async def apply_asset_compression(self) -> Dict[str, Any]:
        """
        Apply asset compression optimizations.
        Note: This adds loading="lazy" and other optimizations.
        Actual image compression would require external tools.
        """
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "optimizations_applied": 0,
            "files_modified": [],
            "recommendations_generated": [],
            "errors": []
        }
        
        # Apply lazy loading to images
        img_results = await self._fix_images_directly()
        results["optimizations_applied"] += img_results.get("count", 0)
        results["files_modified"].extend(img_results.get("files", []))
        
        # Generate compression script recommendation
        results["recommendations_generated"].append({
            "title": "Image Compression Script",
            "description": "Run this command to compress images:",
            "command": "npx imagemin-cli 'public/**/*.{jpg,png}' --out-dir=public/optimized",
            "setup": "npm install -g imagemin-cli"
        })
        
        results["recommendations_generated"].append({
            "title": "WebP Conversion",
            "description": "Convert images to WebP format:",
            "command": "npx cwebp-bin public/image.png -o public/image.webp",
            "setup": "npm install -g cwebp-bin"
        })
        
        return results
    
    async def run_full_optimization(self) -> Dict[str, Any]:
        """
        Run all performance optimizations:
        - Code splitting
        - Lazy loading
        - Asset compression analysis
        - Bundle analysis
        """
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "phases": {},
            "total_improvement_ms": 0,
            "files_modified": [],
            "summary": []
        }
        
        # Phase 1: Code Splitting
        logger.info("Phase 1: Applying code splitting...")
        code_split_results = await self.apply_code_splitting()
        results["phases"]["code_splitting"] = code_split_results
        results["total_improvement_ms"] += code_split_results.get("estimated_improvement_ms", 0)
        results["files_modified"].extend(code_split_results.get("files_modified", []))
        
        # Phase 2: Safe Optimizations (lazy loading)
        logger.info("Phase 2: Applying safe optimizations...")
        safe_opt_results = await self.auto_optimize_safe()
        results["phases"]["safe_optimizations"] = safe_opt_results
        results["total_improvement_ms"] += safe_opt_results.get("improvements_ms", 0)
        results["files_modified"].extend([{"file": f} for f in safe_opt_results.get("files_modified", [])])
        
        # Phase 3: Asset Compression Analysis
        logger.info("Phase 3: Analyzing assets...")
        asset_results = await self.analyze_asset_compression()
        results["phases"]["asset_analysis"] = {
            "total_size_kb": asset_results.get("total_assets_size_kb", 0),
            "potential_savings_kb": asset_results.get("potential_savings_kb", 0),
            "recommendations_count": len(asset_results.get("recommendations", []))
        }
        
        # Phase 4: Apply asset optimizations
        logger.info("Phase 4: Applying asset optimizations...")
        compression_results = await self.apply_asset_compression()
        results["phases"]["asset_compression"] = compression_results
        results["total_improvement_ms"] += compression_results.get("optimizations_applied", 0) * 40
        
        # Generate summary
        results["summary"] = [
            f"Code split {code_split_results.get('components_split', 0)} components",
            f"Applied {safe_opt_results.get('optimizations_applied', 0)} lazy loading optimizations",
            f"Analyzed {round(asset_results.get('total_assets_size_kb', 0))}KB of assets",
            f"Potential asset savings: {round(asset_results.get('potential_savings_kb', 0))}KB",
            f"Total estimated improvement: {results['total_improvement_ms']}ms"
        ]
        
        logger.info(f"Full optimization complete: {results['total_improvement_ms']}ms estimated improvement")
        
        return results
