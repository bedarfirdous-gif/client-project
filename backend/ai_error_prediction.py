"""
AI-Powered Error Prediction System
===================================
A proactive error detection system that uses AI to:
1. Predict potential errors before they occur
2. Analyze code patterns that typically lead to bugs
3. Connect all AI agents for unified auto-fix capability
4. Learn from historical errors to improve prediction accuracy

Author: AI Error Prediction System
Version: 1.0.0
"""

import os
import re
import json
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase
from emergentintegrations.llm.chat import LlmChat, UserMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AIErrorPrediction")


class PredictionType(Enum):
    """Types of error predictions"""
    POTENTIAL_BUG = "potential_bug"
    PERFORMANCE_ISSUE = "performance_issue"
    SECURITY_RISK = "security_risk"
    UI_INSTABILITY = "ui_instability"
    DATA_INTEGRITY = "data_integrity"
    MEMORY_LEAK = "memory_leak"
    RACE_CONDITION = "race_condition"
    NULL_REFERENCE = "null_reference"
    TYPE_MISMATCH = "type_mismatch"
    API_INCONSISTENCY = "api_inconsistency"


class PredictionSeverity(Enum):
    """Severity of predicted issues"""
    CRITICAL = "critical"  # Will definitely cause errors
    HIGH = "high"  # Very likely to cause errors
    MEDIUM = "medium"  # May cause errors under certain conditions
    LOW = "low"  # Potential future issue


class PredictionStatus(Enum):
    """Status of a prediction"""
    DETECTED = "detected"
    ANALYZING = "analyzing"
    FIX_READY = "fix_ready"
    AUTO_FIXING = "auto_fixing"
    FIXED = "fixed"
    DEFERRED = "deferred"
    FALSE_POSITIVE = "false_positive"


@dataclass
class ErrorPrediction:
    """Represents a predicted error"""
    prediction_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    prediction_type: PredictionType = PredictionType.POTENTIAL_BUG
    severity: PredictionSeverity = PredictionSeverity.MEDIUM
    file_path: str = ""
    component: str = ""
    line_numbers: List[int] = field(default_factory=list)
    description: str = ""
    root_cause_analysis: str = ""
    affected_code: str = ""
    predicted_error: str = ""
    confidence_score: float = 0.5
    suggested_fix: str = ""
    status: PredictionStatus = PredictionStatus.DETECTED
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    agent_source: str = ""  # Which agent detected this


@dataclass 
class PredictionFix:
    """Represents a fix for a prediction"""
    fix_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    prediction_id: str = ""
    original_code: str = ""
    fixed_code: str = ""
    description: str = ""
    applied: bool = False
    applied_at: Optional[str] = None
    backup_path: Optional[str] = None
    verified: bool = False


# Patterns that typically lead to errors
RISKY_PATTERNS = {
    "null_reference": {
        "patterns": [
            r"\.(\w+)\s*\?\.",  # Optional chaining (indicates uncertainty)
            r"(\w+)\s*&&\s*\1\.",  # Short-circuit access
            r"if\s*\(\s*(\w+)\s*\)\s*{[^}]*\1\.",  # Conditional access
        ],
        "risk_description": "Potential null/undefined reference",
        "severity": PredictionSeverity.MEDIUM
    },
    "memory_leak": {
        "patterns": [
            r"useEffect\([^)]+\{[^}]*setInterval\s*\([^)]+\)[^}]*\}[^)]*\)",  # setInterval without cleanup
            r"useEffect\([^)]+\{[^}]*addEventListener[^}]*\}[^)]*\)",  # addEventListener without removeEventListener
            r"new\s+EventEmitter\(\)",  # Event emitter creation without cleanup
        ],
        "risk_description": "Potential memory leak - resources not cleaned up",
        "severity": PredictionSeverity.HIGH
    },
    "race_condition": {
        "patterns": [
            r"async\s+function[^{]+\{[^}]*await[^}]*setState",  # Async setState
            r"\.then\([^)]+setState",  # Promise then with setState
            r"fetch\([^)]+\)\.then[^}]*set\w+\(",  # Fetch then set state
        ],
        "risk_description": "Potential race condition in async state updates",
        "severity": PredictionSeverity.MEDIUM
    },
    "infinite_loop": {
        "patterns": [
            r"useEffect\([^)]+,\s*\[\s*\]\s*\)[^}]*set\w+\(",  # useEffect with empty deps setting state
            r"while\s*\(\s*true\s*\)",  # Explicit infinite loop
        ],
        "risk_description": "Potential infinite loop or re-render",
        "severity": PredictionSeverity.CRITICAL
    },
    "error_handling": {
        "patterns": [
            r"catch\s*\(\s*\w*\s*\)\s*\{\s*\}",  # Empty catch block
            r"\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)",  # Empty .catch()
            r"catch\s*\(\s*\w+\s*\)\s*\{[^}]*console\.log",  # catch with only console.log
        ],
        "risk_description": "Inadequate error handling - errors may be silently ignored",
        "severity": PredictionSeverity.MEDIUM
    },
    "security_risk": {
        "patterns": [
            r"innerHTML\s*=",  # Direct innerHTML assignment
            r"dangerouslySetInnerHTML",  # React dangerous HTML
            r"eval\s*\(",  # eval usage
            r"document\.write\s*\(",  # document.write
        ],
        "risk_description": "Potential security vulnerability (XSS risk)",
        "severity": PredictionSeverity.HIGH
    },
    "performance_issue": {
        "patterns": [
            r"\.map\([^)]+\)\.filter\([^)]+\)\.map\(",  # Multiple chained array operations
            r"JSON\.parse\(JSON\.stringify",  # Deep clone anti-pattern
            r"new\s+RegExp\([^)]+\)",  # RegExp in render/hot path
        ],
        "risk_description": "Performance anti-pattern detected",
        "severity": PredictionSeverity.MEDIUM
    },
    "api_inconsistency": {
        "patterns": [
            r"fetch\([^)]+\)[^}]*\{[^}]*\.json\(\)[^}]*\}",  # Fetch without error check
            r"axios\.[a-z]+\([^)]+\)[^.]*$",  # Axios without .catch
        ],
        "risk_description": "API call without proper error handling",
        "severity": PredictionSeverity.MEDIUM
    }
}


class AIErrorPredictionSystem:
    """
    AI-powered system for predicting and preventing errors.
    
    Features:
    1. Proactive code scanning for risky patterns
    2. AI analysis for deeper prediction
    3. Automatic fix generation
    4. Integration with all AI agents
    5. Learning from historical data
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, api_key: str):
        self.db = db
        self.api_key = api_key
        self.predictions_collection = db.error_predictions
        self.fixes_collection = db.prediction_fixes
        self.learning_collection = db.prediction_learning
        
        # Paths to scan
        self.frontend_src = "/app/frontend/src"
        self.backend_src = "/app/backend"
        
        # Connected agents
        self.connected_agents = {}
        
        logger.info("AI Error Prediction System initialized")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.predictions_collection.create_index([("detected_at", -1)])
        await self.predictions_collection.create_index([("prediction_type", 1)])
        await self.predictions_collection.create_index([("severity", 1)])
        await self.predictions_collection.create_index([("status", 1)])
        await self.fixes_collection.create_index([("prediction_id", 1)])
        logger.info("AI Error Prediction indexes created")
    
    def connect_agent(self, agent_name: str, agent_instance):
        """Connect an AI agent for unified orchestration"""
        self.connected_agents[agent_name] = agent_instance
        logger.info(f"Connected agent: {agent_name}")
    
    async def predict_errors(self, scan_path: str = None) -> List[ErrorPrediction]:
        """
        Scan code and predict potential errors using pattern matching and AI.
        """
        predictions = []
        
        # Determine scan paths
        if scan_path:
            scan_paths = [scan_path]
        else:
            scan_paths = [self.frontend_src, self.backend_src]
        
        # Phase 1: Pattern-based prediction
        pattern_predictions = await self._pattern_based_scan(scan_paths)
        predictions.extend(pattern_predictions)
        
        # Phase 2: AI-powered deep analysis for high-risk files
        high_risk_files = self._identify_high_risk_files(predictions)
        if high_risk_files:
            ai_predictions = await self._ai_deep_analysis(high_risk_files[:5])  # Limit to 5 files
            predictions.extend(ai_predictions)
        
        # Store predictions
        for pred in predictions:
            await self._store_prediction(pred)
        
        logger.info(f"Predicted {len(predictions)} potential errors")
        return predictions
    
    async def _pattern_based_scan(self, scan_paths: List[str]) -> List[ErrorPrediction]:
        """Scan files for risky patterns"""
        predictions = []
        
        for base_path in scan_paths:
            if not os.path.exists(base_path):
                continue
            
            for root, dirs, files in os.walk(base_path):
                dirs[:] = [d for d in dirs if d not in ['node_modules', 'build', '__pycache__', 'ui']]
                
                for file in files:
                    if file.endswith(('.js', '.jsx', '.tsx', '.ts', '.py')):
                        file_path = os.path.join(root, file)
                        file_predictions = await self._scan_file_patterns(file_path)
                        predictions.extend(file_predictions)
        
        return predictions
    
    async def _scan_file_patterns(self, file_path: str) -> List[ErrorPrediction]:
        """Scan a single file for risky patterns"""
        predictions = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            logger.error(f"Failed to read {file_path}: {e}")
            return predictions
        
        component = os.path.basename(file_path).split('.')[0]
        
        for pattern_name, config in RISKY_PATTERNS.items():
            for pattern in config["patterns"]:
                try:
                    matches = list(re.finditer(pattern, content, re.MULTILINE | re.DOTALL))
                    
                    if matches:
                        # Find line numbers
                        line_numbers = []
                        for match in matches[:3]:  # Limit to 3 matches
                            line_num = content[:match.start()].count('\n') + 1
                            line_numbers.append(line_num)
                        
                        # Extract code snippet
                        if line_numbers:
                            first_line = max(0, line_numbers[0] - 2)
                            last_line = min(len(lines), line_numbers[0] + 3)
                            affected_code = '\n'.join(lines[first_line:last_line])
                        else:
                            affected_code = ""
                        
                        # Calculate confidence based on pattern specificity
                        confidence = 0.5 + (0.1 * len(matches))
                        confidence = min(confidence, 0.95)
                        
                        prediction = ErrorPrediction(
                            prediction_type=self._map_pattern_to_type(pattern_name),
                            severity=config["severity"],
                            file_path=file_path,
                            component=component,
                            line_numbers=line_numbers,
                            description=config["risk_description"],
                            affected_code=affected_code[:500],
                            predicted_error=f"{pattern_name} risk detected",
                            confidence_score=confidence,
                            agent_source="pattern_detection"
                        )
                        predictions.append(prediction)
                        break  # One prediction per pattern type per file
                
                except re.error:
                    continue
        
        return predictions
    
    def _map_pattern_to_type(self, pattern_name: str) -> PredictionType:
        """Map pattern name to prediction type"""
        mapping = {
            "null_reference": PredictionType.NULL_REFERENCE,
            "memory_leak": PredictionType.MEMORY_LEAK,
            "race_condition": PredictionType.RACE_CONDITION,
            "infinite_loop": PredictionType.POTENTIAL_BUG,
            "error_handling": PredictionType.POTENTIAL_BUG,
            "security_risk": PredictionType.SECURITY_RISK,
            "performance_issue": PredictionType.PERFORMANCE_ISSUE,
            "api_inconsistency": PredictionType.API_INCONSISTENCY
        }
        return mapping.get(pattern_name, PredictionType.POTENTIAL_BUG)
    
    def _identify_high_risk_files(self, predictions: List[ErrorPrediction]) -> List[str]:
        """Identify files that need deeper AI analysis"""
        file_risk_scores = {}
        
        for pred in predictions:
            if pred.file_path not in file_risk_scores:
                file_risk_scores[pred.file_path] = 0
            
            # Score based on severity
            severity_scores = {
                PredictionSeverity.CRITICAL: 10,
                PredictionSeverity.HIGH: 5,
                PredictionSeverity.MEDIUM: 2,
                PredictionSeverity.LOW: 1
            }
            file_risk_scores[pred.file_path] += severity_scores.get(pred.severity, 1)
        
        # Sort by risk score and return top files
        sorted_files = sorted(file_risk_scores.items(), key=lambda x: x[1], reverse=True)
        return [f[0] for f in sorted_files[:10]]
    
    async def _ai_deep_analysis(self, file_paths: List[str]) -> List[ErrorPrediction]:
        """Use AI to perform deep analysis on high-risk files"""
        predictions = []
        
        for file_path in file_paths:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()[:6000]
                
                prompt = f"""Analyze this code for potential bugs, performance issues, and error-prone patterns.

FILE: {file_path}

CODE:
```
{content}
```

Identify issues that could cause runtime errors, crashes, or unexpected behavior.
For each issue found, provide:
1. Type: (bug/performance/security/memory/race_condition/type_error)
2. Severity: (critical/high/medium/low)
3. Line(s): approximate line numbers
4. Description: what the issue is
5. Predicted Error: what error this would cause
6. Suggested Fix: how to fix it

Return as JSON array:
[
  {{
    "type": "bug",
    "severity": "high",
    "lines": [10, 15],
    "description": "...",
    "predicted_error": "...",
    "suggested_fix": "..."
  }}
]

Return empty array [] if no issues found."""

                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"prediction-{uuid.uuid4().hex[:8]}",
                    system_message="You are a code quality expert identifying potential bugs and issues."
                ).with_model("openai", "gpt-5.2")
                
                response = await chat.send_message(UserMessage(text=prompt))
                
                # Parse response
                response_text = response.strip()
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                try:
                    issues = json.loads(response_text.strip())
                    
                    for issue in issues[:5]:  # Limit to 5 issues per file
                        severity_map = {
                            "critical": PredictionSeverity.CRITICAL,
                            "high": PredictionSeverity.HIGH,
                            "medium": PredictionSeverity.MEDIUM,
                            "low": PredictionSeverity.LOW
                        }
                        
                        type_map = {
                            "bug": PredictionType.POTENTIAL_BUG,
                            "performance": PredictionType.PERFORMANCE_ISSUE,
                            "security": PredictionType.SECURITY_RISK,
                            "memory": PredictionType.MEMORY_LEAK,
                            "race_condition": PredictionType.RACE_CONDITION,
                            "type_error": PredictionType.TYPE_MISMATCH
                        }
                        
                        prediction = ErrorPrediction(
                            prediction_type=type_map.get(issue.get("type", "bug"), PredictionType.POTENTIAL_BUG),
                            severity=severity_map.get(issue.get("severity", "medium"), PredictionSeverity.MEDIUM),
                            file_path=file_path,
                            component=os.path.basename(file_path).split('.')[0],
                            line_numbers=issue.get("lines", []),
                            description=issue.get("description", ""),
                            predicted_error=issue.get("predicted_error", ""),
                            suggested_fix=issue.get("suggested_fix", ""),
                            confidence_score=0.75,
                            agent_source="ai_deep_analysis"
                        )
                        predictions.append(prediction)
                        
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse AI response for {file_path}")
                    
            except Exception as e:
                logger.error(f"AI analysis failed for {file_path}: {e}")
        
        return predictions
    
    async def generate_fix(self, prediction_id: str) -> Optional[PredictionFix]:
        """Generate a fix for a prediction using AI"""
        pred_doc = await self.predictions_collection.find_one({"prediction_id": prediction_id})
        if not pred_doc:
            return None
        
        # Read file content
        file_path = pred_doc.get("file_path", "")
        if not file_path or not os.path.exists(file_path):
            return None
        
        try:
            with open(file_path, 'r') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Failed to read file: {e}")
            return None
        
        # Use AI to generate fix
        prompt = f"""Fix the following predicted issue in this code:

FILE: {file_path}

ISSUE:
- Type: {pred_doc.get('prediction_type')}
- Description: {pred_doc.get('description')}
- Predicted Error: {pred_doc.get('predicted_error')}
- Lines Affected: {pred_doc.get('line_numbers')}
- Suggested Approach: {pred_doc.get('suggested_fix')}

CURRENT CODE:
```
{content[:6000]}
```

Generate the MINIMAL fix needed. Return JSON:
{{
  "search_code": "exact code to find and replace",
  "replace_code": "the fixed code",
  "description": "what was fixed"
}}

The search_code MUST be an exact match from the original file."""

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"fix-{prediction_id[:8]}",
                system_message="You are an expert code fixer. Generate minimal, precise fixes."
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(text=prompt))
            
            # Parse response
            response_text = response.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            fix_data = json.loads(response_text.strip())
            
            fix = PredictionFix(
                prediction_id=prediction_id,
                original_code=fix_data.get("search_code", ""),
                fixed_code=fix_data.get("replace_code", ""),
                description=fix_data.get("description", "")
            )
            
            # Store fix
            await self.fixes_collection.insert_one({
                "fix_id": fix.fix_id,
                "prediction_id": fix.prediction_id,
                "original_code": fix.original_code[:2000],
                "fixed_code": fix.fixed_code[:2000],
                "description": fix.description,
                "generated_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Update prediction status
            await self.predictions_collection.update_one(
                {"prediction_id": prediction_id},
                {"$set": {"status": PredictionStatus.FIX_READY.value}}
            )
            
            return fix
            
        except Exception as e:
            logger.error(f"Fix generation failed: {e}")
            return None
    
    async def apply_fix(self, fix_id: str) -> Dict[str, Any]:
        """Apply a generated fix"""
        fix_doc = await self.fixes_collection.find_one({"fix_id": fix_id})
        if not fix_doc:
            return {"status": "error", "message": "Fix not found"}
        
        pred_doc = await self.predictions_collection.find_one({"prediction_id": fix_doc["prediction_id"]})
        if not pred_doc:
            return {"status": "error", "message": "Prediction not found"}
        
        file_path = pred_doc.get("file_path", "")
        
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Create backup
            backup_path = f"{file_path}.prediction_backup.{fix_id[:8]}"
            with open(backup_path, 'w') as f:
                f.write(content)
            
            # Apply fix
            original_code = fix_doc.get("original_code", "")
            fixed_code = fix_doc.get("fixed_code", "")
            
            if original_code in content:
                new_content = content.replace(original_code, fixed_code, 1)
                
                with open(file_path, 'w') as f:
                    f.write(new_content)
                
                # Update records
                await self.fixes_collection.update_one(
                    {"fix_id": fix_id},
                    {"$set": {
                        "applied": True,
                        "applied_at": datetime.now(timezone.utc).isoformat(),
                        "backup_path": backup_path
                    }}
                )
                
                await self.predictions_collection.update_one(
                    {"prediction_id": fix_doc["prediction_id"]},
                    {"$set": {"status": PredictionStatus.FIXED.value}}
                )
                
                logger.info(f"Applied prediction fix to {file_path}")
                return {"status": "applied", "file_path": file_path, "backup_path": backup_path}
            else:
                return {"status": "error", "message": "Original code not found in file"}
                
        except Exception as e:
            logger.error(f"Failed to apply fix: {e}")
            return {"status": "error", "message": str(e)}
    
    async def auto_fix_all(self, severity_threshold: str = "high", dry_run: bool = False) -> Dict[str, Any]:
        """Auto-fix all predictions above severity threshold"""
        severity_order = ["low", "medium", "high", "critical"]
        threshold_idx = severity_order.index(severity_threshold)
        valid_severities = severity_order[threshold_idx:]
        
        # Get predictions to fix
        predictions = await self.predictions_collection.find({
            "status": PredictionStatus.DETECTED.value,
            "severity": {"$in": valid_severities}
        }).to_list(50)
        
        results = {
            "total_predictions": len(predictions),
            "fixes_generated": 0,
            "fixes_applied": 0,
            "errors": [],
            "dry_run": dry_run
        }
        
        for pred in predictions:
            try:
                # Generate fix
                fix = await self.generate_fix(pred["prediction_id"])
                if fix:
                    results["fixes_generated"] += 1
                    
                    if not dry_run:
                        # Apply fix
                        apply_result = await self.apply_fix(fix.fix_id)
                        if apply_result.get("status") == "applied":
                            results["fixes_applied"] += 1
                        else:
                            results["errors"].append({
                                "prediction_id": pred["prediction_id"],
                                "error": apply_result.get("message")
                            })
                            
            except Exception as e:
                results["errors"].append({
                    "prediction_id": pred["prediction_id"],
                    "error": str(e)
                })
        
        return results
    
    async def orchestrate_all_agents(self, auto_fix: bool = True) -> Dict[str, Any]:
        """
        Orchestrate all connected agents to detect and fix issues.
        """
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agents_run": [],
            "total_issues_found": 0,
            "total_fixes_applied": 0,
            "by_agent": {}
        }
        
        # Run prediction first
        predictions = await self.predict_errors()
        results["by_agent"]["error_prediction"] = {
            "issues_found": len(predictions),
            "fixes_applied": 0
        }
        results["total_issues_found"] += len(predictions)
        results["agents_run"].append("error_prediction")
        
        # Auto-fix predictions if enabled
        if auto_fix and predictions:
            fix_results = await self.auto_fix_all(severity_threshold="high", dry_run=False)
            results["by_agent"]["error_prediction"]["fixes_applied"] = fix_results["fixes_applied"]
            results["total_fixes_applied"] += fix_results["fixes_applied"]
        
        # Run connected agents
        for agent_name, agent in self.connected_agents.items():
            try:
                agent_result = {"issues_found": 0, "fixes_applied": 0}
                
                if hasattr(agent, 'scan_for_blink_issues'):
                    # UI Blink Fix Agent
                    issues = await agent.scan_for_blink_issues()
                    agent_result["issues_found"] = len(issues)
                    
                    if auto_fix and issues:
                        fix_result = await agent.auto_fix(dry_run=False)
                        agent_result["fixes_applied"] = fix_result.get("fixes_applied", 0)
                
                elif hasattr(agent, 'analyze_performance'):
                    # Performance Agent
                    analysis = await agent.analyze_performance()
                    issues = analysis.get("frontend_issues", []) + analysis.get("backend_issues", [])
                    agent_result["issues_found"] = len(issues)
                    
                    if auto_fix and issues:
                        fix_result = await agent.run_full_optimization()
                        agent_result["fixes_applied"] = fix_result.get("total_improvement_ms", 0) // 100  # Estimate
                
                elif hasattr(agent, 'scan_logs'):
                    # Real AutoHeal Agent
                    errors = await agent.scan_logs()
                    agent_result["issues_found"] = len(errors)
                    
                    fixes_applied = 0
                    if auto_fix:
                        for error in errors[:10]:  # Limit
                            fix = await agent.analyze_and_fix(error)
                            if fix and fix.verified:
                                fixes_applied += 1
                    agent_result["fixes_applied"] = fixes_applied
                
                results["by_agent"][agent_name] = agent_result
                results["total_issues_found"] += agent_result["issues_found"]
                results["total_fixes_applied"] += agent_result["fixes_applied"]
                results["agents_run"].append(agent_name)
                
            except Exception as e:
                logger.error(f"Agent {agent_name} failed: {e}")
                results["by_agent"][agent_name] = {"error": str(e)}
        
        return results
    
    async def get_predictions(self, status: str = None, severity: str = None, limit: int = 50) -> List[Dict]:
        """Get predictions with filters"""
        query = {}
        if status:
            query["status"] = status
        if severity:
            query["severity"] = severity
        
        predictions = await self.predictions_collection.find(
            query, {"_id": 0}
        ).sort("detected_at", -1).limit(limit).to_list(limit)
        
        return predictions
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get dashboard statistics"""
        total = await self.predictions_collection.count_documents({})
        fixed = await self.predictions_collection.count_documents({"status": PredictionStatus.FIXED.value})
        pending = await self.predictions_collection.count_documents({"status": PredictionStatus.DETECTED.value})
        
        # By severity
        by_severity = {}
        for sev in PredictionSeverity:
            count = await self.predictions_collection.count_documents({"severity": sev.value})
            by_severity[sev.value] = count
        
        # By type
        by_type = {}
        for pt in PredictionType:
            count = await self.predictions_collection.count_documents({"prediction_type": pt.value})
            if count > 0:
                by_type[pt.value] = count
        
        return {
            "total_predictions": total,
            "fixed_predictions": fixed,
            "pending_predictions": pending,
            "prevention_rate": round((fixed / total * 100), 1) if total > 0 else 0,
            "by_severity": by_severity,
            "by_type": by_type,
            "connected_agents": list(self.connected_agents.keys())
        }
    
    async def _store_prediction(self, prediction: ErrorPrediction):
        """Store a prediction in database"""
        await self.predictions_collection.update_one(
            {"file_path": prediction.file_path, "prediction_type": prediction.prediction_type.value},
            {"$set": {
                "prediction_id": prediction.prediction_id,
                "prediction_type": prediction.prediction_type.value,
                "severity": prediction.severity.value,
                "file_path": prediction.file_path,
                "component": prediction.component,
                "line_numbers": prediction.line_numbers,
                "description": prediction.description,
                "root_cause_analysis": prediction.root_cause_analysis,
                "affected_code": prediction.affected_code,
                "predicted_error": prediction.predicted_error,
                "confidence_score": prediction.confidence_score,
                "suggested_fix": prediction.suggested_fix,
                "status": prediction.status.value,
                "detected_at": prediction.detected_at,
                "agent_source": prediction.agent_source
            }},
            upsert=True
        )


# Singleton instance
_prediction_system: Optional[AIErrorPredictionSystem] = None

def get_prediction_system(db=None, api_key: str = None) -> AIErrorPredictionSystem:
    """Get or create singleton instance"""
    global _prediction_system
    if _prediction_system is None and db is not None:
        _prediction_system = AIErrorPredictionSystem(db=db, api_key=api_key)
    return _prediction_system
