"""
UI Blink Fix Agent - Autonomous UI Performance Healing
======================================================
An AI agent that automatically detects and fixes UI blinking/flickering issues.

Common causes of UI blinking:
1. Multiple cascading loading states
2. Authentication state changes causing re-renders
3. Improper React state management
4. CSS transitions without proper timing
5. Data fetching without proper caching
6. Component remounting on navigation

Author: UI Blink Fix Agent
Version: 1.0.0
"""

import os
import re
import json
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase

# LLM Integration for intelligent fixes
from emergentintegrations.llm.chat import LlmChat, UserMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("UIBlinkFixAgent")


class BlinkType(Enum):
    """Types of UI blinking issues"""
    LOADING_CASCADE = "loading_cascade"  # Multiple loading states causing flicker
    AUTH_RERENDER = "auth_rerender"  # Auth state changes causing full rerender
    STATE_FLASH = "state_flash"  # Improper state initialization
    CSS_TRANSITION = "css_transition"  # Missing or improper CSS transitions
    DATA_REFETCH = "data_refetch"  # Unnecessary data refetching
    COMPONENT_REMOUNT = "component_remount"  # Unnecessary component remounting
    SUSPENSE_FALLBACK = "suspense_fallback"  # React Suspense fallback flashing
    HYDRATION_MISMATCH = "hydration_mismatch"  # SSR hydration issues


class FixSeverity(Enum):
    """Severity of the fix required"""
    MINOR = "minor"  # Simple CSS or state fix
    MODERATE = "moderate"  # Component refactoring needed
    MAJOR = "major"  # Architecture changes needed


class FixStatus(Enum):
    """Status of a fix"""
    DETECTED = "detected"
    ANALYZING = "analyzing"
    FIX_GENERATED = "fix_generated"
    APPLIED = "applied"
    VALIDATED = "validated"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


@dataclass
class BlinkIssue:
    """Represents a detected blinking issue"""
    issue_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    blink_type: BlinkType = BlinkType.LOADING_CASCADE
    severity: FixSeverity = FixSeverity.MINOR
    file_path: str = ""
    component_name: str = ""
    line_numbers: List[int] = field(default_factory=list)
    description: str = ""
    root_cause: str = ""
    affected_code: str = ""
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_reported: bool = False


@dataclass
class BlinkFix:
    """Represents a fix for a blinking issue"""
    fix_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    issue_id: str = ""
    status: FixStatus = FixStatus.DETECTED
    fix_description: str = ""
    original_code: str = ""
    fixed_code: str = ""
    file_path: str = ""
    applied_at: Optional[str] = None
    validated_at: Optional[str] = None
    rollback_available: bool = True
    backup_path: Optional[str] = None


# Common blink fix patterns
BLINK_FIX_PATTERNS = {
    BlinkType.LOADING_CASCADE: {
        "description": "Multiple loading states causing cascading renders",
        "detection_patterns": [
            r"loading\s*&&\s*loading\s*&&",
            r"\[loading\d?,\s*loading\d?\]",
            r"isLoading\s*\|\|\s*isAuthLoading\s*\|\|\s*isDataLoading",
            r"if\s*\(\s*loading\s*\)\s*return.*if\s*\(\s*\w*loading",
        ],
        "fix_strategy": "consolidate_loading_states",
    },
    BlinkType.AUTH_RERENDER: {
        "description": "Authentication state changes causing full component rerender",
        "detection_patterns": [
            r"useEffect\(\s*\(\)\s*=>\s*\{[^}]*setUser",
            r"const\s*\{\s*user\s*\}\s*=\s*useAuth\(\)",
            r"isAuthenticated\s*\?\s*<[^>]+>\s*:\s*<Navigate",
        ],
        "fix_strategy": "stabilize_auth_state",
    },
    BlinkType.STATE_FLASH: {
        "description": "Improper state initialization causing visual flash",
        "detection_patterns": [
            r"useState\(\s*null\s*\)",
            r"useState\(\s*undefined\s*\)",
            r"useState\(\s*\[\s*\]\s*\).*\.map\(",
            r"data\s*\?\?\s*\[\]",
        ],
        "fix_strategy": "proper_initial_state",
    },
    BlinkType.CSS_TRANSITION: {
        "description": "Missing CSS transitions causing abrupt changes",
        "detection_patterns": [
            r"opacity:\s*[01](?!.*transition)",
            r"visibility:\s*(?:visible|hidden)(?!.*transition)",
            r"display:\s*(?:none|block)(?!.*animation)",
        ],
        "fix_strategy": "add_smooth_transitions",
    },
    BlinkType.COMPONENT_REMOUNT: {
        "description": "Unnecessary component remounting on state change",
        "detection_patterns": [
            r"key=\{[^}]*Date\.now\(\)",
            r"key=\{[^}]*Math\.random\(\)",
            r"key=\{[^}]*JSON\.stringify",
        ],
        "fix_strategy": "stabilize_component_keys",
    },
}


# Pre-built fix templates
FIX_TEMPLATES = {
    "consolidate_loading_states": '''
// BEFORE: Multiple loading checks causing flicker
// if (loading1) return <Loader />;
// if (loading2) return <Loader />;
// if (loading3) return <Loader />;

// AFTER: Consolidated loading state
const isLoading = loading1 || loading2 || loading3;
const [showContent, setShowContent] = useState(false);

useEffect(() => {
  if (!isLoading) {
    // Small delay to prevent flash
    const timer = setTimeout(() => setShowContent(true), 50);
    return () => clearTimeout(timer);
  }
  setShowContent(false);
}, [isLoading]);

if (!showContent) {
  return <Loader />;
}
''',
    "stabilize_auth_state": '''
// BEFORE: Auth state causing re-renders
// const { user } = useAuth();
// if (!user) return <Navigate to="/login" />;

// AFTER: Stable auth with loading state
const { user, isLoading: authLoading, isInitialized } = useAuth();

// Don't render anything until auth is initialized
if (!isInitialized || authLoading) {
  return null; // or a skeleton loader
}

if (!user) {
  return <Navigate to="/login" replace />;
}
''',
    "proper_initial_state": '''
// BEFORE: Null initial state causing flash
// const [data, setData] = useState(null);
// return data && data.map(...)

// AFTER: Proper initial state with loading indicator
const [data, setData] = useState([]);
const [isLoaded, setIsLoaded] = useState(false);

useEffect(() => {
  fetchData().then(result => {
    setData(result);
    setIsLoaded(true);
  });
}, []);

if (!isLoaded) {
  return <Skeleton />;
}
''',
    "add_smooth_transitions": '''
/* BEFORE: Abrupt visibility change */
/* .element { opacity: 0; } */
/* .element.visible { opacity: 1; } */

/* AFTER: Smooth transition */
.element {
  opacity: 0;
  transition: opacity 150ms ease-in-out;
}
.element.visible {
  opacity: 1;
}

/* For content that needs to be hidden but not cause reflow */
.fade-container {
  min-height: 100px; /* Prevent layout shift */
}
''',
    "stabilize_component_keys": '''
// BEFORE: Unstable keys causing remounts
// {items.map(item => <Item key={Math.random()} />)}

// AFTER: Stable keys from data
// Use unique IDs from your data
{items.map(item => <Item key={item.id} />)}

// Or generate stable keys if no ID exists
{items.map((item, index) => <Item key={`item-${item.name}-${index}`} />)}
''',
}


class UIBlinkFixAgent:
    """
    AI Agent for automatically detecting and fixing UI blinking issues.
    
    Capabilities:
    1. Scan frontend code for common blinking patterns
    2. Analyze React component lifecycle issues
    3. Generate targeted fixes using AI
    4. Apply fixes with backup and rollback
    5. Validate fixes don't break functionality
    6. Learn from successful fixes
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, api_key: str):
        self.db = db
        self.api_key = api_key
        self.issues_collection = db.ui_blink_issues
        self.fixes_collection = db.ui_blink_fixes
        self.learning_collection = db.ui_blink_learning
        
        # Frontend paths
        self.frontend_src = "/app/frontend/src"
        self.pages_path = f"{self.frontend_src}/pages"
        self.components_path = f"{self.frontend_src}/components"
        
        logger.info("UI Blink Fix Agent initialized")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.issues_collection.create_index([("detected_at", -1)])
        await self.issues_collection.create_index([("blink_type", 1)])
        await self.issues_collection.create_index([("file_path", 1)])
        await self.fixes_collection.create_index([("issue_id", 1)])
        await self.fixes_collection.create_index([("status", 1)])
        await self.learning_collection.create_index([("pattern_type", 1)])
        logger.info("UI Blink Fix Agent indexes created")
    
    async def scan_for_blink_issues(self, target_path: str = None) -> List[BlinkIssue]:
        """
        Scan frontend code for potential blinking issues.
        
        Args:
            target_path: Specific file or directory to scan (defaults to all frontend)
        
        Returns:
            List of detected BlinkIssue objects
        """
        issues = []
        scan_paths = []
        
        if target_path:
            scan_paths.append(target_path)
        else:
            scan_paths = [self.pages_path, self.components_path]
        
        for base_path in scan_paths:
            if not os.path.exists(base_path):
                continue
                
            for root, dirs, files in os.walk(base_path):
                # Skip node_modules and test files
                dirs[:] = [d for d in dirs if d not in ['node_modules', '__tests__', 'test']]
                
                for file in files:
                    if file.endswith(('.js', '.jsx', '.tsx', '.ts')):
                        file_path = os.path.join(root, file)
                        file_issues = await self._scan_file(file_path)
                        issues.extend(file_issues)
        
        # Save detected issues to database
        for issue in issues:
            await self.issues_collection.update_one(
                {"file_path": issue.file_path, "blink_type": issue.blink_type.value},
                {"$set": {
                    "issue_id": issue.issue_id,
                    "blink_type": issue.blink_type.value,
                    "severity": issue.severity.value,
                    "file_path": issue.file_path,
                    "component_name": issue.component_name,
                    "line_numbers": issue.line_numbers,
                    "description": issue.description,
                    "root_cause": issue.root_cause,
                    "affected_code": issue.affected_code[:500],  # Truncate
                    "detected_at": issue.detected_at,
                    "status": "detected"
                }},
                upsert=True
            )
        
        logger.info(f"Scan complete: Found {len(issues)} potential blink issues")
        return issues
    
    async def _scan_file(self, file_path: str) -> List[BlinkIssue]:
        """Scan a single file for blink patterns"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            logger.error(f"Failed to read {file_path}: {e}")
            return issues
        
        # Extract component name from file
        component_name = os.path.basename(file_path).replace('.js', '').replace('.jsx', '').replace('.tsx', '')
        
        # Check each blink type pattern
        for blink_type, config in BLINK_FIX_PATTERNS.items():
            for pattern in config["detection_patterns"]:
                matches = list(re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE))
                
                if matches:
                    # Find line numbers for matches
                    line_numbers = []
                    for match in matches:
                        start_pos = match.start()
                        line_num = content[:start_pos].count('\n') + 1
                        line_numbers.append(line_num)
                    
                    # Extract affected code snippet
                    if line_numbers:
                        first_line = max(0, line_numbers[0] - 3)
                        last_line = min(len(lines), line_numbers[-1] + 3)
                        affected_code = '\n'.join(lines[first_line:last_line])
                    else:
                        affected_code = ""
                    
                    issue = BlinkIssue(
                        blink_type=blink_type,
                        severity=self._determine_severity(blink_type, len(matches)),
                        file_path=file_path,
                        component_name=component_name,
                        line_numbers=line_numbers,
                        description=config["description"],
                        root_cause=f"Pattern '{pattern}' matched {len(matches)} times",
                        affected_code=affected_code
                    )
                    issues.append(issue)
                    break  # One issue per blink type per file
        
        return issues
    
    def _determine_severity(self, blink_type: BlinkType, match_count: int) -> FixSeverity:
        """Determine severity based on issue type and frequency"""
        # Critical types
        if blink_type in [BlinkType.AUTH_RERENDER, BlinkType.LOADING_CASCADE]:
            return FixSeverity.MAJOR if match_count > 2 else FixSeverity.MODERATE
        
        # Moderate types
        if blink_type in [BlinkType.STATE_FLASH, BlinkType.COMPONENT_REMOUNT]:
            return FixSeverity.MODERATE if match_count > 3 else FixSeverity.MINOR
        
        return FixSeverity.MINOR
    
    async def generate_fix(self, issue_id: str) -> BlinkFix:
        """
        Generate an AI-powered fix for a detected blink issue.
        
        Args:
            issue_id: ID of the issue to fix
        
        Returns:
            BlinkFix object with generated fix code
        """
        # Get issue from database
        issue_doc = await self.issues_collection.find_one({"issue_id": issue_id})
        if not issue_doc:
            raise ValueError(f"Issue {issue_id} not found")
        
        # Update status
        await self.issues_collection.update_one(
            {"issue_id": issue_id},
            {"$set": {"status": "analyzing"}}
        )
        
        # Read the full file content
        try:
            with open(issue_doc["file_path"], 'r', encoding='utf-8') as f:
                original_code = f.read()
        except Exception as e:
            raise ValueError(f"Cannot read file: {e}")
        
        # Get the fix template for this issue type
        blink_type = BlinkType(issue_doc["blink_type"])
        fix_strategy = BLINK_FIX_PATTERNS.get(blink_type, {}).get("fix_strategy", "")
        fix_template = FIX_TEMPLATES.get(fix_strategy, "")
        
        # Generate AI-powered fix
        fix_prompt = f"""You are a React/Frontend expert fixing UI blinking/flickering issues.

ISSUE DETAILS:
- Type: {issue_doc['blink_type']}
- File: {issue_doc['file_path']}
- Component: {issue_doc['component_name']}
- Description: {issue_doc['description']}
- Root Cause: {issue_doc['root_cause']}
- Affected Lines: {issue_doc['line_numbers']}

AFFECTED CODE:
```javascript
{issue_doc['affected_code']}
```

FIX PATTERN TO APPLY:
{fix_template}

FULL FILE CONTENT:
```javascript
{original_code[:8000]}
```

INSTRUCTIONS:
1. Analyze the blinking issue root cause
2. Generate the MINIMAL fix needed - don't rewrite the entire file
3. Focus on the specific lines causing the issue
4. Ensure the fix doesn't break existing functionality
5. Add comments explaining the fix

Return ONLY the fixed code section that needs to be replaced, in this JSON format:
{{
    "fix_description": "Brief description of what was fixed",
    "search_code": "The exact code to search for and replace",
    "replace_code": "The fixed code to insert",
    "additional_imports": "Any new imports needed (or empty string)"
}}

IMPORTANT: search_code must be an EXACT match from the original file."""

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"blink-fix-{issue_id}",
                system_message="You are a React expert specializing in UI performance optimization."
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(text=fix_prompt))
            
            # Parse response
            response_text = response.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            fix_data = json.loads(response_text)
            
        except Exception as e:
            logger.error(f"AI fix generation failed: {e}")
            # Fall back to template-based fix
            fix_data = {
                "fix_description": f"Apply {fix_strategy} pattern",
                "search_code": issue_doc['affected_code'],
                "replace_code": fix_template,
                "additional_imports": ""
            }
        
        # Create fix object
        fix = BlinkFix(
            issue_id=issue_id,
            status=FixStatus.FIX_GENERATED,
            fix_description=fix_data.get("fix_description", ""),
            original_code=fix_data.get("search_code", ""),
            fixed_code=fix_data.get("replace_code", ""),
            file_path=issue_doc["file_path"],
        )
        
        # Save to database
        await self.fixes_collection.insert_one({
            "fix_id": fix.fix_id,
            "issue_id": fix.issue_id,
            "status": fix.status.value,
            "fix_description": fix.fix_description,
            "original_code": fix.original_code[:2000],
            "fixed_code": fix.fixed_code[:2000],
            "file_path": fix.file_path,
            "additional_imports": fix_data.get("additional_imports", ""),
            "generated_at": datetime.now(timezone.utc).isoformat()
        })
        
        await self.issues_collection.update_one(
            {"issue_id": issue_id},
            {"$set": {"status": "fix_generated"}}
        )
        
        logger.info(f"Generated fix {fix.fix_id} for issue {issue_id}")
        return fix
    
    async def apply_fix(self, fix_id: str, auto_backup: bool = True) -> Dict[str, Any]:
        """
        Apply a generated fix to the codebase.
        
        Args:
            fix_id: ID of the fix to apply
            auto_backup: Whether to create a backup before applying
        
        Returns:
            Result dictionary with status and details
        """
        # Get fix from database
        fix_doc = await self.fixes_collection.find_one({"fix_id": fix_id})
        if not fix_doc:
            raise ValueError(f"Fix {fix_id} not found")
        
        file_path = fix_doc["file_path"]
        result = {
            "fix_id": fix_id,
            "status": "pending",
            "file_path": file_path,
            "backup_path": None,
            "error": None
        }
        
        try:
            # Read current file
            with open(file_path, 'r', encoding='utf-8') as f:
                current_content = f.read()
            
            # Create backup
            if auto_backup:
                backup_path = f"{file_path}.blink_backup.{fix_id[:8]}"
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(current_content)
                result["backup_path"] = backup_path
            
            # Apply the fix
            original_code = fix_doc["original_code"]
            fixed_code = fix_doc["fixed_code"]
            additional_imports = fix_doc.get("additional_imports", "")
            
            if original_code in current_content:
                new_content = current_content.replace(original_code, fixed_code, 1)
                
                # Add imports if needed
                if additional_imports:
                    # Find the last import statement
                    import_match = re.search(r'^import.*$', new_content, re.MULTILINE)
                    if import_match:
                        insert_pos = import_match.end()
                        new_content = new_content[:insert_pos] + f"\n{additional_imports}" + new_content[insert_pos:]
                
                # Write fixed content
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                result["status"] = "applied"
                
                # Update database
                await self.fixes_collection.update_one(
                    {"fix_id": fix_id},
                    {"$set": {
                        "status": FixStatus.APPLIED.value,
                        "applied_at": datetime.now(timezone.utc).isoformat(),
                        "backup_path": result["backup_path"]
                    }}
                )
                
                await self.issues_collection.update_one(
                    {"issue_id": fix_doc["issue_id"]},
                    {"$set": {"status": "fix_applied"}}
                )
                
                logger.info(f"Applied fix {fix_id} to {file_path}")
            else:
                result["status"] = "failed"
                result["error"] = "Original code not found in file - code may have changed"
                
                await self.fixes_collection.update_one(
                    {"fix_id": fix_id},
                    {"$set": {"status": FixStatus.FAILED.value, "error": result["error"]}}
                )
        
        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
            logger.error(f"Failed to apply fix {fix_id}: {e}")
        
        return result
    
    async def rollback_fix(self, fix_id: str) -> Dict[str, Any]:
        """Rollback an applied fix using the backup"""
        fix_doc = await self.fixes_collection.find_one({"fix_id": fix_id})
        if not fix_doc:
            raise ValueError(f"Fix {fix_id} not found")
        
        backup_path = fix_doc.get("backup_path")
        if not backup_path or not os.path.exists(backup_path):
            raise ValueError("No backup available for rollback")
        
        try:
            # Read backup
            with open(backup_path, 'r', encoding='utf-8') as f:
                backup_content = f.read()
            
            # Restore original file
            with open(fix_doc["file_path"], 'w', encoding='utf-8') as f:
                f.write(backup_content)
            
            # Update status
            await self.fixes_collection.update_one(
                {"fix_id": fix_id},
                {"$set": {"status": FixStatus.ROLLED_BACK.value}}
            )
            
            await self.issues_collection.update_one(
                {"issue_id": fix_doc["issue_id"]},
                {"$set": {"status": "rolled_back"}}
            )
            
            logger.info(f"Rolled back fix {fix_id}")
            return {"status": "rolled_back", "fix_id": fix_id}
        
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return {"status": "error", "error": str(e)}
    
    async def auto_fix_all(self, dry_run: bool = True) -> Dict[str, Any]:
        """
        Automatically scan and fix all detected blink issues.
        
        Args:
            dry_run: If True, only generates fixes without applying them
        
        Returns:
            Summary of all fixes attempted
        """
        summary = {
            "scanned_files": 0,
            "issues_found": 0,
            "fixes_generated": 0,
            "fixes_applied": 0,
            "errors": [],
            "dry_run": dry_run
        }
        
        # Scan for issues
        issues = await self.scan_for_blink_issues()
        summary["issues_found"] = len(issues)
        
        # Generate fixes for each issue
        for issue in issues:
            try:
                fix = await self.generate_fix(issue.issue_id)
                summary["fixes_generated"] += 1
                
                if not dry_run:
                    result = await self.apply_fix(fix.fix_id)
                    if result["status"] == "applied":
                        summary["fixes_applied"] += 1
                    else:
                        summary["errors"].append({
                            "issue_id": issue.issue_id,
                            "error": result.get("error", "Unknown error")
                        })
            except Exception as e:
                summary["errors"].append({
                    "issue_id": issue.issue_id,
                    "error": str(e)
                })
        
        return summary
    
    async def auto_fix(self, dry_run: bool = False) -> Dict[str, Any]:
        """Alias for auto_fix_all with dry_run=False by default for collaboration"""
        return await self.auto_fix_all(dry_run=dry_run)
    
    async def get_issues(self, status: str = None) -> List[Dict]:
        """Get all detected issues, optionally filtered by status"""
        query = {}
        if status:
            query["status"] = status
        
        issues = await self.issues_collection.find(query, {"_id": 0}).sort("detected_at", -1).to_list(100)
        return issues
    
    async def get_fixes(self, status: str = None) -> List[Dict]:
        """Get all fixes, optionally filtered by status"""
        query = {}
        if status:
            query["status"] = status
        
        fixes = await self.fixes_collection.find(query, {"_id": 0}).sort("generated_at", -1).to_list(100)
        return fixes
    
    async def report_blink_issue(self, file_path: str, description: str, user_id: str = None) -> BlinkIssue:
        """Allow users to report blink issues manually"""
        issue = BlinkIssue(
            blink_type=BlinkType.LOADING_CASCADE,  # Default, will be analyzed
            severity=FixSeverity.MODERATE,
            file_path=file_path,
            description=description,
            user_reported=True
        )
        
        await self.issues_collection.insert_one({
            "issue_id": issue.issue_id,
            "blink_type": issue.blink_type.value,
            "severity": issue.severity.value,
            "file_path": issue.file_path,
            "description": description,
            "user_reported": True,
            "reported_by": user_id,
            "detected_at": issue.detected_at,
            "status": "reported"
        })
        
        logger.info(f"User reported blink issue: {issue.issue_id}")
        return issue
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get statistics for the blink fix dashboard"""
        total_issues = await self.issues_collection.count_documents({})
        fixed_issues = await self.issues_collection.count_documents({"status": "fix_applied"})
        pending_issues = await self.issues_collection.count_documents({"status": {"$in": ["detected", "reported"]}})
        
        # Get issues by type
        pipeline = [
            {"$group": {"_id": "$blink_type", "count": {"$sum": 1}}}
        ]
        by_type = await self.issues_collection.aggregate(pipeline).to_list(20)
        
        # Get auto-mode config
        config = await self.get_auto_config()
        
        return {
            "total_issues": total_issues,
            "fixed_issues": fixed_issues,
            "pending_issues": pending_issues,
            "fix_rate": (fixed_issues / total_issues * 100) if total_issues > 0 else 0,
            "by_type": {item["_id"]: item["count"] for item in by_type},
            "auto_mode": config
        }
    
    async def get_auto_config(self) -> Dict[str, Any]:
        """Get auto-fix configuration"""
        config_collection = self.db.ui_blink_config
        config = await config_collection.find_one({"config_type": "auto_mode"}, {"_id": 0})
        return config or {
            "enabled": False,
            "auto_apply_safe_fixes": True,
            "webhook_enabled": False,
            "webhook_secret": "",
            "scan_on_change": True,
            "auto_rollback_on_error": True,
            "safe_severity_levels": ["minor"],
            "max_auto_fixes_per_run": 10,
            "notification_on_fix": True
        }
    
    async def update_auto_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update auto-fix configuration"""
        config_collection = self.db.ui_blink_config
        await config_collection.update_one(
            {"config_type": "auto_mode"},
            {"$set": {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return await self.get_auto_config()
    
    async def enable_auto_mode(self, enable: bool = True, apply_safe_only: bool = True) -> Dict[str, Any]:
        """
        Enable or disable fully automatic mode.
        
        In auto mode:
        - Scans run automatically on file changes (webhook)
        - Safe fixes (minor severity) are applied automatically
        - Non-safe fixes are queued for review
        - Auto-rollback on errors
        """
        return await self.update_auto_config({
            "enabled": enable,
            "auto_apply_safe_fixes": apply_safe_only,
            "scan_on_change": enable
        })
    
    async def handle_webhook_trigger(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle webhook trigger from code changes.
        Called when files are modified (e.g., git push, file save).
        
        Payload can contain:
        - files_changed: List of file paths that changed
        - commit_hash: Git commit hash
        - trigger_type: 'push', 'save', 'manual'
        """
        config = await self.get_auto_config()
        
        if not config.get("enabled"):
            return {
                "status": "skipped",
                "reason": "Auto mode is disabled",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        result = {
            "status": "processing",
            "trigger_type": payload.get("trigger_type", "manual"),
            "files_changed": payload.get("files_changed", []),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scan_results": None,
            "fixes_applied": [],
            "fixes_queued": []
        }
        
        try:
            # Filter to frontend files only
            frontend_files = [
                f for f in payload.get("files_changed", [])
                if f.startswith("/app/frontend/src") and f.endswith(('.js', '.jsx', '.tsx'))
            ]
            
            if not frontend_files:
                result["status"] = "skipped"
                result["reason"] = "No frontend files changed"
                return result
            
            # Scan changed files
            issues = []
            for file_path in frontend_files:
                file_issues = await self._scan_file(file_path)
                issues.extend(file_issues)
            
            result["scan_results"] = {
                "files_scanned": len(frontend_files),
                "issues_found": len(issues)
            }
            
            # Apply safe fixes automatically if enabled
            if config.get("auto_apply_safe_fixes") and issues:
                safe_severities = config.get("safe_severity_levels", ["minor"])
                max_fixes = config.get("max_auto_fixes_per_run", 10)
                
                fixes_applied = 0
                for issue in issues:
                    if fixes_applied >= max_fixes:
                        result["fixes_queued"].append(issue.issue_id)
                        continue
                    
                    if issue.severity.value in safe_severities:
                        try:
                            # Generate and apply fix
                            fix = await self.generate_fix(issue.issue_id)
                            apply_result = await self.apply_fix(fix.fix_id)
                            
                            if apply_result.get("status") == "applied":
                                result["fixes_applied"].append({
                                    "issue_id": issue.issue_id,
                                    "fix_id": fix.fix_id,
                                    "file": issue.file_path
                                })
                                fixes_applied += 1
                            else:
                                result["fixes_queued"].append(issue.issue_id)
                        except Exception as e:
                            logger.error(f"Auto-fix failed for {issue.issue_id}: {e}")
                            if config.get("auto_rollback_on_error"):
                                result["fixes_queued"].append(issue.issue_id)
                    else:
                        # Queue non-safe fixes for manual review
                        result["fixes_queued"].append(issue.issue_id)
            
            result["status"] = "completed"
            
            # Log webhook activity
            await self.db.ui_blink_webhook_logs.insert_one({
                "log_id": str(uuid.uuid4()),
                **result
            })
            
        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
            logger.error(f"Webhook handler error: {e}")
        
        return result
    
    async def get_webhook_logs(self, limit: int = 50) -> List[Dict]:
        """Get recent webhook trigger logs"""
        logs = await self.db.ui_blink_webhook_logs.find(
            {}, {"_id": 0}
        ).sort("timestamp", -1).to_list(limit)
        return logs
    
    async def run_scheduled_scan(self) -> Dict[str, Any]:
        """
        Run a scheduled full scan and apply safe fixes.
        This can be called by a cron job or scheduler.
        """
        config = await self.get_auto_config()
        
        if not config.get("enabled"):
            return {"status": "skipped", "reason": "Auto mode is disabled"}
        
        # Run full scan
        issues = await self.scan_for_blink_issues()
        
        result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scan_type": "scheduled",
            "issues_found": len(issues),
            "fixes_applied": 0,
            "fixes_queued": 0,
            "errors": []
        }
        
        if config.get("auto_apply_safe_fixes"):
            safe_severities = config.get("safe_severity_levels", ["minor"])
            max_fixes = config.get("max_auto_fixes_per_run", 10)
            
            for issue in issues[:max_fixes]:
                if issue.severity.value in safe_severities:
                    try:
                        fix = await self.generate_fix(issue.issue_id)
                        apply_result = await self.apply_fix(fix.fix_id)
                        if apply_result.get("status") == "applied":
                            result["fixes_applied"] += 1
                        else:
                            result["fixes_queued"] += 1
                    except Exception as e:
                        result["errors"].append({"issue_id": issue.issue_id, "error": str(e)})
                        result["fixes_queued"] += 1
                else:
                    result["fixes_queued"] += 1
        
        return result
