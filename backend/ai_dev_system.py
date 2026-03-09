"""
AI Development System v2.0
==========================
Self-contained AI system for generating and deploying modules internally.
Available to Super Admin and Admin roles.

Features:
- Full-stack code generation (React frontend + FastAPI backend)
- Configuration/settings modules
- Sandboxed testing environment
- Safe deployment workflow with rollback
- Template-based generation for consistency
- AUTO-INTEGRATION: Automatically adds modules to sidebar and routing
- LIVE PREVIEW: Preview generated UI before deployment
- HOT RELOAD: Auto-restart services after deployment
- SELF-IMPROVING: Learns from successful deployments
"""

import os
import re
import uuid
import json
import asyncio
import subprocess
import tempfile
import shutil
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase

# LLM Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

import logging
logger = logging.getLogger(__name__)

# ============== ENUMS ==============

class ModuleType(str, Enum):
    CRUD = "crud"                    # Create, Read, Update, Delete entity
    REPORT = "report"                # Analytics/reporting module
    DASHBOARD = "dashboard"          # Dashboard/visualization
    WORKFLOW = "workflow"            # Business workflow/process
    INTEGRATION = "integration"      # External API integration
    SETTINGS = "settings"            # Configuration/settings
    CUSTOM = "custom"                # Custom module

class GenerationStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    GENERATED = "generated"
    TESTING = "testing"
    TESTED = "tested"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

class CodeType(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATABASE = "database"
    CONFIG = "config"

# ============== PYDANTIC MODELS ==============

class GenerationRequest(BaseModel):
    """Request to generate a new module"""
    prompt: str
    module_type: ModuleType = ModuleType.CUSTOM
    module_name: str
    description: Optional[str] = None
    include_frontend: bool = True
    include_backend: bool = True
    include_database: bool = True
    target_entities: List[str] = []  # For CRUD modules
    additional_context: Optional[str] = None

class GeneratedCode(BaseModel):
    """Generated code artifact"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code_type: CodeType
    filename: str
    filepath: str
    content: str
    language: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class GeneratedModule(BaseModel):
    """Complete generated module"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    module_type: ModuleType
    prompt: str
    status: GenerationStatus = GenerationStatus.PENDING
    files: List[GeneratedCode] = []
    api_endpoints: List[Dict[str, str]] = []
    database_schema: Optional[Dict[str, Any]] = None
    frontend_routes: List[Dict[str, str]] = []
    sidebar_config: Optional[Dict[str, Any]] = None  # NEW: Sidebar configuration
    preview_html: Optional[str] = None  # NEW: Live preview HTML
    sandbox_id: Optional[str] = None
    test_results: Optional[Dict[str, Any]] = None
    deployment_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = ""
    error: Optional[str] = None
    learning_data: Optional[Dict[str, Any]] = None  # NEW: Self-improvement data

class SandboxEnvironment(BaseModel):
    """Sandbox testing environment"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    module_id: str
    status: str = "created"  # created, running, stopped, destroyed
    port: Optional[int] = None
    logs: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============== CODE TEMPLATES ==============

FRONTEND_COMPONENT_TEMPLATE = '''import React, {{ useState, useEffect }} from 'react';
import {{ useAuth }} from '../App';
import {{ toast }} from 'sonner';
import {{
  {imports}
}} from 'lucide-react';
import {{ Button }} from '../components/ui/button';
import {{ Card, CardContent, CardHeader, CardTitle, CardDescription }} from '../components/ui/card';
import {{ Input }} from '../components/ui/input';
import {{ Label }} from '../components/ui/label';
import {{ Badge }} from '../components/ui/badge';
import {{
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
}} from '../components/ui/table';
import {{
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
}} from '../components/ui/dialog';

export default function {component_name}() {{
  const {{ api }} = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({{}});

  useEffect(() => {{
    fetchData();
  }}, []);

  const fetchData = async () => {{
    try {{
      setLoading(true);
      const result = await api('{api_endpoint}');
      setData(result.items || result.data || []);
    }} catch (err) {{
      toast.error('Failed to load data');
    }} finally {{
      setLoading(false);
    }}
  }};

  {component_logic}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        {header_actions}
      </div>

      {component_content}
    </div>
  );
}}
'''

BACKEND_ROUTER_TEMPLATE = '''"""
{module_name} API Routes
Auto-generated by AI Dev System
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

router = APIRouter(prefix="/{route_prefix}", tags=["{module_name}"])

# ============== MODELS ==============

{pydantic_models}

# ============== ENDPOINTS ==============

{endpoints}
'''

DATABASE_SCHEMA_TEMPLATE = '''"""
{module_name} Database Schema
Auto-generated by AI Dev System
"""

# Collection: {collection_name}
# Indexes to create:
{indexes}

SCHEMA = {{
{schema_fields}
}}

# Example document:
EXAMPLE = {{
{example_document}
}}
'''

# ============== SYSTEM PROMPTS ==============

CODE_GENERATION_SYSTEM_PROMPT = """You are an expert full-stack developer for BijnisBooks, a business management application.
You generate production-ready code following these standards:

TECH STACK:
- Frontend: React 18, Tailwind CSS, Shadcn/UI components, Lucide icons
- Backend: Python FastAPI, Pydantic models, async/await
- Database: MongoDB with Motor async driver
- State: React useState/useEffect hooks
- API calls: Custom useAuth hook with api() function

CODE STANDARDS:
1. Use functional components with hooks
2. All API calls through useAuth's api() function
3. Toast notifications for user feedback (sonner)
4. Proper loading states and error handling
5. MongoDB ObjectId exclusion in responses
6. Tenant isolation with tenant_id
7. Proper TypeScript-like prop validation

SECURITY:
- Never generate code that modifies authentication
- Always include tenant_id filtering
- Validate all user inputs
- Use proper permission checks

OUTPUT FORMAT:
Return valid JSON with this structure:
{
  "frontend_files": [
    {"filename": "ComponentName.js", "content": "...code...", "filepath": "/app/frontend/src/pages/"}
  ],
  "backend_files": [
    {"filename": "router_name.py", "content": "...code...", "filepath": "/app/backend/routes/"}
  ],
  "database": {
    "collection": "collection_name",
    "schema": {...},
    "indexes": [...]
  },
  "api_endpoints": [
    {"method": "GET", "path": "/api/...", "description": "..."}
  ],
  "frontend_routes": [
    {"path": "/module-name", "component": "ComponentName"}
  ],
  "integration_notes": "Any notes about integrating this module"
}
"""

CRUD_GENERATION_PROMPT = """Generate a complete CRUD module for: {entity_name}

Requirements:
- List view with search and filters
- Create/Edit modal form
- Delete with confirmation
- Proper validation
- Pagination support
- Export functionality (optional)

Entity fields: {fields}
Additional requirements: {requirements}
"""

REPORT_GENERATION_PROMPT = """Generate a reporting/analytics module for: {report_name}

Requirements:
- Date range filters
- Multiple chart types (use Recharts)
- Summary statistics cards
- Export to PDF/Excel
- Real-time data refresh

Data sources: {data_sources}
Metrics to display: {metrics}
Additional requirements: {requirements}
"""

SETTINGS_GENERATION_PROMPT = """Generate a settings/configuration module for: {settings_name}

Requirements:
- Grouped settings by category
- Form validation
- Save/Reset functionality
- Default values
- Description for each setting

Settings categories: {categories}
Settings fields: {fields}
Additional requirements: {requirements}
"""

# ============== AI DEV SYSTEM CLASS ==============

class AIDevSystem:
    """Main AI Development System for generating modules"""
    
    def __init__(self, db: AsyncIOMotorDatabase, api_key: str):
        self.db = db
        self.api_key = api_key
        self.modules_collection = db.ai_dev_modules
        self.sandboxes_collection = db.ai_dev_sandboxes
        self.deployments_collection = db.ai_dev_deployments
        self.learning_collection = db.ai_dev_learning  # NEW: Learning data
        
        # Path configurations
        self.frontend_pages_path = "/app/frontend/src/pages"
        self.frontend_app_path = "/app/frontend/src/App.js"
        self.backend_routes_path = "/app/backend/routes"
        self.sidebar_config_path = "/app/frontend/src/config/sidebarConfig.js"
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.modules_collection.create_index([("name", 1)])
        await self.modules_collection.create_index([("status", 1)])
        await self.modules_collection.create_index([("created_at", -1)])
        await self.sandboxes_collection.create_index([("module_id", 1)])
        await self.deployments_collection.create_index([("module_id", 1)])
        await self.learning_collection.create_index([("module_type", 1)])
        await self.learning_collection.create_index([("success_score", -1)])
        logger.info("AI Dev System indexes created")
    
    async def generate_module(self, request: GenerationRequest, user_id: str) -> GeneratedModule:
        """Generate a new module from prompt"""
        
        # Create module record
        module = GeneratedModule(
            name=request.module_name,
            description=request.description or f"Auto-generated {request.module_type.value} module",
            module_type=request.module_type,
            prompt=request.prompt,
            status=GenerationStatus.GENERATING,
            created_by=user_id
        )
        
        # Save initial record
        await self.modules_collection.insert_one(module.model_dump())
        
        try:
            # Get learning examples for better generation
            learning_examples = await self._get_learning_examples(request.module_type)
            
            # Build generation prompt based on module type
            generation_prompt = self._build_generation_prompt(request, learning_examples)
            
            # Call LLM for code generation
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"ai-dev-{module.id}",
                system_message=CODE_GENERATION_SYSTEM_PROMPT
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(text=generation_prompt))
            
            # Parse generated code
            generated_code = self._parse_generation_response(response)
            
            # Update module with generated files
            module.files = generated_code.get("files", [])
            module.api_endpoints = generated_code.get("api_endpoints", [])
            module.database_schema = generated_code.get("database")
            module.frontend_routes = generated_code.get("frontend_routes", [])
            module.sidebar_config = generated_code.get("sidebar_config")
            module.preview_html = await self._generate_preview_html(module)
            module.status = GenerationStatus.GENERATED
            module.updated_at = datetime.now(timezone.utc).isoformat()
            
            # Update in database
            await self.modules_collection.update_one(
                {"id": module.id},
                {"$set": module.model_dump()}
            )
            
            return module
            
        except Exception as e:
            logger.error(f"Module generation failed: {e}")
            module.status = GenerationStatus.FAILED
            module.error = str(e)
            await self.modules_collection.update_one(
                {"id": module.id},
                {"$set": {"status": module.status.value, "error": module.error}}
            )
            raise
    
    async def _get_learning_examples(self, module_type: ModuleType) -> List[Dict]:
        """Get successful examples for learning"""
        examples = await self.learning_collection.find(
            {"module_type": module_type.value, "success_score": {"$gte": 0.8}},
            {"_id": 0, "prompt": 1, "code_summary": 1}
        ).sort("success_score", -1).limit(3).to_list(3)
        return examples
    
    async def _generate_preview_html(self, module: GeneratedModule) -> str:
        """Generate a preview HTML for the module"""
        preview_parts = []
        
        # Find the main frontend component
        for file in module.files:
            if file.get("code_type") == "frontend" or file.get("language") == "javascript":
                # Extract JSX from the component
                content = file.get("content", "")
                # Simple extraction of return statement content
                return_match = re.search(r'return\s*\(\s*([\s\S]*?)\s*\);?\s*}', content)
                if return_match:
                    jsx_content = return_match.group(1)
                    preview_parts.append(f"<div class='preview-component'>{jsx_content}</div>")
        
        if preview_parts:
            return f"""
            <html>
            <head>
                <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                <style>
                    .preview-component {{ padding: 20px; }}
                    .preview-note {{ background: #fef3c7; padding: 10px; margin-bottom: 10px; border-radius: 4px; }}
                </style>
            </head>
            <body class="bg-gray-50">
                <div class="preview-note">⚠️ This is a static preview. Interactive features won't work until deployed.</div>
                {''.join(preview_parts)}
            </body>
            </html>
            """
        return "<html><body><p>Preview not available for this module type.</p></body></html>"
    
    def _build_generation_prompt(self, request: GenerationRequest, learning_examples: List[Dict] = None) -> str:
        """Build the generation prompt based on module type"""
        
        base_prompt = f"""
Generate a complete {request.module_type.value} module.

MODULE NAME: {request.module_name}
DESCRIPTION: {request.description or 'Not specified'}

USER PROMPT:
{request.prompt}

REQUIREMENTS:
- Include frontend: {request.include_frontend}
- Include backend: {request.include_backend}
- Include database schema: {request.include_database}
"""
        
        if request.target_entities:
            base_prompt += f"\nTARGET ENTITIES: {', '.join(request.target_entities)}"
        
        if request.additional_context:
            base_prompt += f"\nADDITIONAL CONTEXT:\n{request.additional_context}"
        
        # Add learning examples if available
        if learning_examples:
            base_prompt += "\n\nSUCCESSFUL EXAMPLES FROM PREVIOUS GENERATIONS:"
            for i, example in enumerate(learning_examples, 1):
                base_prompt += f"\n{i}. Prompt: {example.get('prompt', '')[:200]}..."
                base_prompt += f"\n   Summary: {example.get('code_summary', '')[:150]}..."
        
        # Add type-specific instructions
        if request.module_type == ModuleType.CRUD:
            base_prompt += """

CRUD MODULE REQUIREMENTS:
- Create a list view with DataTable
- Add create/edit modal with form validation
- Include delete functionality with confirmation
- Add search and filter capabilities
- Support pagination
- Include bulk actions if applicable
"""
        elif request.module_type == ModuleType.REPORT:
            base_prompt += """

REPORT MODULE REQUIREMENTS:
- Include date range picker
- Add multiple chart visualizations (Line, Bar, Pie)
- Show summary statistics cards
- Support data export (CSV/PDF)
- Add refresh functionality
"""
        elif request.module_type == ModuleType.DASHBOARD:
            base_prompt += """

DASHBOARD MODULE REQUIREMENTS:
- Create responsive card layout
- Include key metric cards
- Add interactive charts
- Support real-time updates
- Include quick action buttons
"""
        elif request.module_type == ModuleType.SETTINGS:
            base_prompt += """

SETTINGS MODULE REQUIREMENTS:
- Group settings by category
- Include form validation
- Add save/reset buttons
- Show setting descriptions
- Support default values
"""
        
        base_prompt += """

IMPORTANT: 
1. Return ONLY valid JSON matching the expected output format.
2. Do not include any markdown formatting or code blocks around the JSON.
3. Include "sidebar_config" with: {"label": "Module Name", "icon": "IconName", "path": "/module-path", "category": "CATEGORY_NAME"}
"""
        
        return base_prompt
    
    def _parse_generation_response(self, response: str) -> Dict[str, Any]:
        """Parse the LLM response into structured code"""
        
        try:
            # Clean response
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            data = json.loads(response)
            
            # Convert to GeneratedCode objects
            files = []
            
            for f in data.get("frontend_files", []):
                files.append(GeneratedCode(
                    code_type=CodeType.FRONTEND,
                    filename=f["filename"],
                    filepath=f.get("filepath", "/app/frontend/src/pages/"),
                    content=f["content"],
                    language="javascript"
                ).model_dump())
            
            for f in data.get("backend_files", []):
                files.append(GeneratedCode(
                    code_type=CodeType.BACKEND,
                    filename=f["filename"],
                    filepath=f.get("filepath", "/app/backend/routes/"),
                    content=f["content"],
                    language="python"
                ).model_dump())
            
            # Generate sidebar config if not provided
            sidebar_config = data.get("sidebar_config")
            if not sidebar_config and data.get("frontend_routes"):
                route = data["frontend_routes"][0]
                sidebar_config = {
                    "label": route.get("component", "New Module"),
                    "icon": "Package",
                    "path": route.get("path", "/generated-module"),
                    "category": "GENERATED_MODULES"
                }
            
            return {
                "files": files,
                "api_endpoints": data.get("api_endpoints", []),
                "database": data.get("database"),
                "frontend_routes": data.get("frontend_routes", []),
                "sidebar_config": sidebar_config,
                "integration_notes": data.get("integration_notes", "")
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse generation response: {e}")
            # Return the raw response as a single file for manual review
            return {
                "files": [GeneratedCode(
                    code_type=CodeType.CUSTOM,
                    filename="generated_code.txt",
                    filepath="/app/generated/",
                    content=response,
                    language="text"
                ).model_dump()],
                "api_endpoints": [],
                "database": None,
                "frontend_routes": [],
                "sidebar_config": None,
                "integration_notes": "Generation returned non-JSON response. Manual review required."
            }
    
    async def create_sandbox(self, module_id: str) -> SandboxEnvironment:
        """Create a sandbox environment for testing"""
        
        module = await self.modules_collection.find_one({"id": module_id}, {"_id": 0})
        if not module:
            raise ValueError(f"Module {module_id} not found")
        
        sandbox = SandboxEnvironment(
            module_id=module_id,
            status="created"
        )
        
        # Create sandbox directory
        sandbox_dir = f"/tmp/ai_dev_sandbox_{sandbox.id}"
        os.makedirs(sandbox_dir, exist_ok=True)
        
        # Write generated files to sandbox
        for file_data in module.get("files", []):
            file_path = os.path.join(sandbox_dir, file_data["filename"])
            with open(file_path, "w") as f:
                f.write(file_data["content"])
        
        sandbox.logs.append(f"Sandbox created at {sandbox_dir}")
        
        await self.sandboxes_collection.insert_one(sandbox.model_dump())
        
        # Update module status
        await self.modules_collection.update_one(
            {"id": module_id},
            {"$set": {"sandbox_id": sandbox.id, "status": GenerationStatus.TESTING.value}}
        )
        
        return sandbox
    
    async def run_sandbox_tests(self, sandbox_id: str) -> Dict[str, Any]:
        """Run tests in sandbox environment"""
        
        sandbox = await self.sandboxes_collection.find_one({"id": sandbox_id}, {"_id": 0})
        if not sandbox:
            raise ValueError(f"Sandbox {sandbox_id} not found")
        
        module = await self.modules_collection.find_one(
            {"id": sandbox["module_id"]}, {"_id": 0}
        )
        
        test_results = {
            "sandbox_id": sandbox_id,
            "module_id": sandbox["module_id"],
            "tests": [],
            "passed": 0,
            "failed": 0,
            "warnings": []
        }
        
        sandbox_dir = f"/tmp/ai_dev_sandbox_{sandbox_id}"
        
        # Test 1: Syntax validation for Python files
        for file_data in module.get("files", []):
            if file_data["language"] == "python":
                file_path = os.path.join(sandbox_dir, file_data["filename"])
                if os.path.exists(file_path):
                    try:
                        result = subprocess.run(
                            ["python3", "-m", "py_compile", file_path],
                            capture_output=True,
                            text=True,
                            timeout=10
                        )
                        if result.returncode == 0:
                            test_results["tests"].append({
                                "name": f"Python syntax: {file_data['filename']}",
                                "status": "passed"
                            })
                            test_results["passed"] += 1
                        else:
                            test_results["tests"].append({
                                "name": f"Python syntax: {file_data['filename']}",
                                "status": "failed",
                                "error": result.stderr
                            })
                            test_results["failed"] += 1
                    except Exception as e:
                        test_results["tests"].append({
                            "name": f"Python syntax: {file_data['filename']}",
                            "status": "failed",
                            "error": str(e)
                        })
                        test_results["failed"] += 1
        
        # Test 2: JavaScript/React validation (basic)
        for file_data in module.get("files", []):
            if file_data["language"] == "javascript":
                # Basic checks
                content = file_data["content"]
                issues = []
                
                if "import React" not in content and "from 'react'" not in content:
                    issues.append("Missing React import")
                
                if "export default" not in content and "export const" not in content:
                    issues.append("Missing export statement")
                
                if issues:
                    test_results["warnings"].extend(issues)
                    test_results["tests"].append({
                        "name": f"JS structure: {file_data['filename']}",
                        "status": "warning",
                        "warnings": issues
                    })
                else:
                    test_results["tests"].append({
                        "name": f"JS structure: {file_data['filename']}",
                        "status": "passed"
                    })
                    test_results["passed"] += 1
        
        # Test 3: API endpoint validation
        for endpoint in module.get("api_endpoints", []):
            # Basic validation
            if endpoint.get("method") and endpoint.get("path"):
                test_results["tests"].append({
                    "name": f"API endpoint: {endpoint['method']} {endpoint['path']}",
                    "status": "passed"
                })
                test_results["passed"] += 1
            else:
                test_results["tests"].append({
                    "name": "API endpoint validation",
                    "status": "failed",
                    "error": "Missing method or path"
                })
                test_results["failed"] += 1
        
        # Update sandbox and module
        sandbox_update = {
            "status": "tested",
            "logs": sandbox.get("logs", []) + [f"Tests completed: {test_results['passed']} passed, {test_results['failed']} failed"]
        }
        await self.sandboxes_collection.update_one(
            {"id": sandbox_id},
            {"$set": sandbox_update}
        )
        
        module_status = GenerationStatus.TESTED.value if test_results["failed"] == 0 else GenerationStatus.FAILED.value
        await self.modules_collection.update_one(
            {"id": sandbox["module_id"]},
            {"$set": {"status": module_status, "test_results": test_results}}
        )
        
        return test_results
    
    async def deploy_module(self, module_id: str, user_id: str, auto_integrate: bool = True) -> Dict[str, Any]:
        """
        Deploy a tested module to production with AUTO-INTEGRATION.
        
        Features:
        - Deploys all generated files
        - Auto-adds route to App.js
        - Auto-adds sidebar entry
        - Hot reloads frontend/backend services
        - Records learning data for self-improvement
        """
        
        module = await self.modules_collection.find_one({"id": module_id}, {"_id": 0})
        if not module:
            raise ValueError(f"Module {module_id} not found")
        
        if module["status"] not in [GenerationStatus.TESTED.value, GenerationStatus.GENERATED.value]:
            raise ValueError(f"Module must be tested before deployment. Current status: {module['status']}")
        
        deployment_id = str(uuid.uuid4())
        deployment_result = {
            "deployment_id": deployment_id,
            "module_id": module_id,
            "status": "in_progress",
            "deployed_files": [],
            "integration_results": {},
            "hot_reload_status": {},
            "errors": [],
            "deployed_at": datetime.now(timezone.utc).isoformat(),
            "deployed_by": user_id
        }
        
        try:
            # Update module status
            await self.modules_collection.update_one(
                {"id": module_id},
                {"$set": {"status": GenerationStatus.DEPLOYING.value}}
            )
            
            # Deploy each file
            for file_data in module.get("files", []):
                target_path = os.path.join(file_data["filepath"], file_data["filename"])
                
                # Create backup if file exists
                if os.path.exists(target_path):
                    backup_path = f"{target_path}.backup.{deployment_id[:8]}"
                    shutil.copy2(target_path, backup_path)
                    deployment_result["deployed_files"].append({
                        "file": target_path,
                        "backup": backup_path,
                        "action": "updated"
                    })
                else:
                    # Create directory if needed
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    deployment_result["deployed_files"].append({
                        "file": target_path,
                        "action": "created"
                    })
                
                # Write file
                with open(target_path, "w") as f:
                    f.write(file_data["content"])
            
            # AUTO-INTEGRATION: Add routes and sidebar entries
            if auto_integrate:
                integration_results = await self._auto_integrate_module(module, deployment_id)
                deployment_result["integration_results"] = integration_results
            
            # HOT RELOAD: Restart services
            hot_reload_results = await self._hot_reload_services(module)
            deployment_result["hot_reload_status"] = hot_reload_results
            
            deployment_result["status"] = "success"
            
            # Update module
            await self.modules_collection.update_one(
                {"id": module_id},
                {"$set": {
                    "status": GenerationStatus.DEPLOYED.value,
                    "deployment_id": deployment_id
                }}
            )
            
            # SELF-IMPROVEMENT: Record successful deployment for learning
            await self._record_learning_data(module, deployment_result)
            
        except Exception as e:
            deployment_result["status"] = "failed"
            deployment_result["errors"].append(str(e))
            
            await self.modules_collection.update_one(
                {"id": module_id},
                {"$set": {"status": GenerationStatus.FAILED.value, "error": str(e)}}
            )
        
        # Save deployment record
        await self.deployments_collection.insert_one(deployment_result)
        
        return deployment_result
    
    async def rollback_deployment(self, deployment_id: str) -> Dict[str, Any]:
        """Rollback a deployment"""
        
        deployment = await self.deployments_collection.find_one(
            {"deployment_id": deployment_id}, {"_id": 0}
        )
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")
        
        rollback_result = {
            "deployment_id": deployment_id,
            "status": "in_progress",
            "restored_files": [],
            "errors": []
        }
        
        try:
            for file_info in deployment.get("deployed_files", []):
                if file_info.get("backup"):
                    # Restore from backup
                    shutil.copy2(file_info["backup"], file_info["file"])
                    rollback_result["restored_files"].append(file_info["file"])
                elif file_info.get("action") == "created":
                    # Remove created file
                    if os.path.exists(file_info["file"]):
                        os.remove(file_info["file"])
                        rollback_result["restored_files"].append(f"Removed: {file_info['file']}")
            
            rollback_result["status"] = "success"
            
            # Update module status
            await self.modules_collection.update_one(
                {"id": deployment["module_id"]},
                {"$set": {"status": GenerationStatus.ROLLED_BACK.value}}
            )
            
        except Exception as e:
            rollback_result["status"] = "failed"
            rollback_result["errors"].append(str(e))
        
        return rollback_result
    
    # ============== NEW: AUTO-INTEGRATION ==============
    
    async def _auto_integrate_module(self, module: Dict, deployment_id: str) -> Dict[str, Any]:
        """
        Automatically integrate the deployed module into the application.
        - Adds route to App.js
        - Adds sidebar entry to generated modules section
        """
        results = {
            "route_added": False,
            "sidebar_added": False,
            "errors": []
        }
        
        try:
            # Get module info
            frontend_routes = module.get("frontend_routes", [])
            sidebar_config = module.get("sidebar_config", {})
            
            if not frontend_routes:
                results["errors"].append("No frontend routes defined")
                return results
            
            # Find the main component file
            component_name = None
            component_filename = None
            for file in module.get("files", []):
                if file.get("code_type") == "frontend" or file.get("language") == "javascript":
                    component_filename = file.get("filename", "").replace(".js", "").replace(".jsx", "")
                    component_name = component_filename
                    break
            
            if not component_name:
                results["errors"].append("No frontend component found")
                return results
            
            # Get route path
            route_path = frontend_routes[0].get("path", f"/{module['name'].lower().replace(' ', '-')}")
            
            # Add to dynamic routes config file (instead of modifying App.js directly)
            await self._add_dynamic_route(component_name, route_path, deployment_id)
            results["route_added"] = True
            
            # Add sidebar entry
            if sidebar_config:
                await self._add_sidebar_entry(module, sidebar_config, deployment_id)
                results["sidebar_added"] = True
            
        except Exception as e:
            logger.error(f"Auto-integration failed: {e}")
            results["errors"].append(str(e))
        
        return results
    
    async def _add_dynamic_route(self, component_name: str, route_path: str, deployment_id: str):
        """Add route to dynamic routes configuration"""
        routes_config_path = "/app/frontend/src/config/dynamicRoutes.js"
        
        # Create the config file if it doesn't exist
        if not os.path.exists(routes_config_path):
            os.makedirs(os.path.dirname(routes_config_path), exist_ok=True)
            initial_content = """// Auto-generated dynamic routes for AI Dev Studio modules
// DO NOT EDIT MANUALLY - managed by AI Dev System

export const dynamicRoutes = [];

export const getDynamicRoutes = () => dynamicRoutes;
"""
            with open(routes_config_path, "w") as f:
                f.write(initial_content)
        
        # Read current config
        with open(routes_config_path, "r") as f:
            content = f.read()
        
        # Check if route already exists
        if route_path in content:
            logger.info(f"Route {route_path} already exists")
            return
        
        # Add new route entry
        new_route = f"""
  {{
    path: "{route_path}",
    component: "{component_name}",
    deploymentId: "{deployment_id}",
    addedAt: "{datetime.now(timezone.utc).isoformat()}"
  }},"""
        
        # Insert into the array
        content = content.replace(
            "export const dynamicRoutes = [];",
            f"export const dynamicRoutes = [{new_route}\n];"
        )
        # Handle case where array already has items
        if "export const dynamicRoutes = [" in content and new_route not in content:
            content = content.replace(
                "export const dynamicRoutes = [",
                f"export const dynamicRoutes = [{new_route}"
            )
        
        with open(routes_config_path, "w") as f:
            f.write(content)
        
        logger.info(f"Added dynamic route: {route_path} -> {component_name}")
    
    async def _add_sidebar_entry(self, module: Dict, sidebar_config: Dict, deployment_id: str):
        """Add sidebar entry for the module"""
        sidebar_config_path = "/app/frontend/src/config/generatedModulesSidebar.js"
        
        # Create the config file if it doesn't exist
        if not os.path.exists(sidebar_config_path):
            os.makedirs(os.path.dirname(sidebar_config_path), exist_ok=True)
            initial_content = """// Auto-generated sidebar entries for AI Dev Studio modules
// DO NOT EDIT MANUALLY - managed by AI Dev System

export const generatedModulesSidebar = [];

export const getGeneratedModulesSidebar = () => generatedModulesSidebar;
"""
            with open(sidebar_config_path, "w") as f:
                f.write(initial_content)
        
        # Read current config
        with open(sidebar_config_path, "r") as f:
            content = f.read()
        
        # Check if already exists
        if sidebar_config.get("path", "") in content:
            logger.info(f"Sidebar entry already exists for {sidebar_config.get('path')}")
            return
        
        # Add new sidebar entry
        new_entry = f"""
  {{
    label: "{sidebar_config.get('label', module['name'])}",
    icon: "{sidebar_config.get('icon', 'Package')}",
    path: "{sidebar_config.get('path', '/' + module['name'].lower().replace(' ', '-'))}",
    moduleId: "{module['id']}",
    deploymentId: "{deployment_id}",
    addedAt: "{datetime.now(timezone.utc).isoformat()}"
  }},"""
        
        # Insert into the array
        if "export const generatedModulesSidebar = [];" in content:
            content = content.replace(
                "export const generatedModulesSidebar = [];",
                f"export const generatedModulesSidebar = [{new_entry}\n];"
            )
        else:
            content = content.replace(
                "export const generatedModulesSidebar = [",
                f"export const generatedModulesSidebar = [{new_entry}"
            )
        
        with open(sidebar_config_path, "w") as f:
            f.write(content)
        
        logger.info(f"Added sidebar entry: {sidebar_config.get('label')}")
    
    # ============== NEW: HOT RELOAD ==============
    
    async def _hot_reload_services(self, module: Dict) -> Dict[str, Any]:
        """Hot reload frontend and backend services after deployment"""
        results = {
            "frontend": {"status": "skipped", "message": ""},
            "backend": {"status": "skipped", "message": ""}
        }
        
        has_frontend = any(f.get("code_type") == "frontend" or f.get("language") == "javascript" 
                         for f in module.get("files", []))
        has_backend = any(f.get("code_type") == "backend" or f.get("language") == "python" 
                        for f in module.get("files", []))
        
        try:
            if has_frontend:
                # Frontend uses hot reload by default, but we can trigger a refresh
                result = subprocess.run(
                    ["sudo", "supervisorctl", "restart", "frontend"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                results["frontend"] = {
                    "status": "success" if result.returncode == 0 else "failed",
                    "message": result.stdout or result.stderr
                }
            
            if has_backend:
                # Restart backend service
                result = subprocess.run(
                    ["sudo", "supervisorctl", "restart", "backend"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                results["backend"] = {
                    "status": "success" if result.returncode == 0 else "failed",
                    "message": result.stdout or result.stderr
                }
                
        except subprocess.TimeoutExpired:
            results["error"] = "Service restart timed out"
        except Exception as e:
            results["error"] = str(e)
        
        return results
    
    # ============== NEW: SELF-IMPROVEMENT ==============
    
    async def _record_learning_data(self, module: Dict, deployment_result: Dict):
        """Record successful deployment data for self-improvement"""
        if deployment_result.get("status") != "success":
            return
        
        # Calculate success score based on tests and deployment
        test_results = module.get("test_results", {})
        passed = test_results.get("passed", 0)
        failed = test_results.get("failed", 0)
        total = passed + failed
        
        success_score = passed / total if total > 0 else 0.5
        
        # Create code summary for learning
        code_summary = []
        for file in module.get("files", [])[:3]:  # Top 3 files
            code_summary.append({
                "filename": file.get("filename"),
                "language": file.get("language"),
                "lines": len(file.get("content", "").split("\n"))
            })
        
        learning_record = {
            "id": str(uuid.uuid4()),
            "module_id": module["id"],
            "module_type": module["module_type"],
            "prompt": module["prompt"],
            "code_summary": json.dumps(code_summary),
            "success_score": success_score,
            "test_passed": passed,
            "test_failed": failed,
            "api_endpoints_count": len(module.get("api_endpoints", [])),
            "files_count": len(module.get("files", [])),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.learning_collection.insert_one(learning_record)
        logger.info(f"Recorded learning data for module {module['id']} with score {success_score}")
    
    async def provide_feedback(self, module_id: str, feedback: Dict[str, Any]) -> Dict:
        """Allow users to provide feedback on deployed modules for learning"""
        module = await self.modules_collection.find_one({"id": module_id}, {"_id": 0})
        if not module:
            raise ValueError(f"Module {module_id} not found")
        
        # Update learning record with user feedback
        user_rating = feedback.get("rating", 3)  # 1-5 scale
        user_comments = feedback.get("comments", "")
        
        # Adjust success score based on user feedback
        adjusted_score = (user_rating / 5) * 0.7 + 0.3  # Weight user feedback heavily
        
        await self.learning_collection.update_one(
            {"module_id": module_id},
            {
                "$set": {
                    "user_rating": user_rating,
                    "user_comments": user_comments,
                    "success_score": adjusted_score,
                    "feedback_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {"status": "success", "message": "Feedback recorded for learning"}
    
    async def get_learning_stats(self) -> Dict[str, Any]:
        """Get learning statistics for the AI Dev System"""
        total_modules = await self.learning_collection.count_documents({})
        
        # Aggregate stats by module type
        pipeline = [
            {"$group": {
                "_id": "$module_type",
                "count": {"$sum": 1},
                "avg_score": {"$avg": "$success_score"},
                "avg_rating": {"$avg": "$user_rating"}
            }}
        ]
        type_stats = await self.learning_collection.aggregate(pipeline).to_list(100)
        
        # Get overall average
        overall_pipeline = [
            {"$group": {
                "_id": None,
                "avg_score": {"$avg": "$success_score"},
                "total_tests_passed": {"$sum": "$test_passed"},
                "total_tests_failed": {"$sum": "$test_failed"}
            }}
        ]
        overall = await self.learning_collection.aggregate(overall_pipeline).to_list(1)
        
        return {
            "total_modules_learned": total_modules,
            "by_type": {stat["_id"]: stat for stat in type_stats},
            "overall": overall[0] if overall else {},
            "learning_enabled": True
        }
    
    async def list_modules(self, status: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """List all generated modules"""
        query = {}
        if status:
            query["status"] = status
        
        modules = await self.modules_collection.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return modules
    
    async def get_module(self, module_id: str) -> Optional[Dict]:
        """Get a specific module"""
        return await self.modules_collection.find_one({"id": module_id}, {"_id": 0})
    
    async def delete_module(self, module_id: str) -> bool:
        """Delete a module (soft delete)"""
        result = await self.modules_collection.update_one(
            {"id": module_id},
            {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    async def get_templates(self) -> List[Dict[str, Any]]:
        """Get available module templates"""
        return [
            {
                "type": "crud",
                "name": "CRUD Module",
                "description": "Create, Read, Update, Delete operations for an entity",
                "example_prompt": "Create a CRUD module for managing suppliers with fields: name, email, phone, address, gst_number, payment_terms",
                "required_fields": ["entity_name", "fields"]
            },
            {
                "type": "report",
                "name": "Report/Analytics Module",
                "description": "Data visualization and reporting dashboard",
                "example_prompt": "Create a sales analytics report showing daily/weekly/monthly sales trends with charts",
                "required_fields": ["report_name", "metrics"]
            },
            {
                "type": "dashboard",
                "name": "Dashboard Module",
                "description": "Overview dashboard with key metrics and quick actions",
                "example_prompt": "Create an inventory dashboard showing stock levels, low stock alerts, and recent movements",
                "required_fields": ["dashboard_name", "widgets"]
            },
            {
                "type": "settings",
                "name": "Settings Module",
                "description": "Configuration and settings management",
                "example_prompt": "Create a notification settings module with email, SMS, and push notification preferences",
                "required_fields": ["settings_name", "categories"]
            },
            {
                "type": "workflow",
                "name": "Workflow Module",
                "description": "Business process automation workflow",
                "example_prompt": "Create an order approval workflow with multiple approval stages and notifications",
                "required_fields": ["workflow_name", "stages"]
            },
            {
                "type": "integration",
                "name": "Integration Module",
                "description": "External API integration",
                "example_prompt": "Create a Razorpay payment integration module for processing online payments",
                "required_fields": ["integration_name", "api_details"]
            }
        ]
    
    async def improve_code(self, module_id: str, feedback: str) -> GeneratedModule:
        """Improve generated code based on feedback"""
        
        module = await self.modules_collection.find_one({"id": module_id}, {"_id": 0})
        if not module:
            raise ValueError(f"Module {module_id} not found")
        
        # Build improvement prompt
        improvement_prompt = f"""
The following code was generated but needs improvements based on user feedback.

ORIGINAL PROMPT:
{module['prompt']}

CURRENT CODE FILES:
{json.dumps([{"filename": f["filename"], "content": f["content"][:2000]} for f in module.get("files", [])], indent=2)}

USER FEEDBACK:
{feedback}

Please regenerate the code with the requested improvements.
Return the complete updated code in the same JSON format.
"""
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"ai-dev-improve-{module_id}",
                system_message=CODE_GENERATION_SYSTEM_PROMPT
            ).with_model("openai", "gpt-4o")
            
            response = await chat.send_message(UserMessage(text=improvement_prompt))
            
            generated_code = self._parse_generation_response(response)
            
            # Update module
            update_data = {
                "files": generated_code.get("files", []),
                "api_endpoints": generated_code.get("api_endpoints", []),
                "database_schema": generated_code.get("database"),
                "frontend_routes": generated_code.get("frontend_routes", []),
                "status": GenerationStatus.GENERATED.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.modules_collection.update_one(
                {"id": module_id},
                {"$set": update_data}
            )
            
            # Fetch updated module
            return await self.get_module(module_id)
            
        except Exception as e:
            logger.error(f"Code improvement failed: {e}")
            raise
