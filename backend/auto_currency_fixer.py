"""
Auto Currency Symbol Fixer Agent V2
Automatically detects and fixes currencySymbol undefined/duplicate errors in React components
"""

import os
import re
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

class AutoCurrencyFixer:
    """
    Automatically scans and fixes React components that:
    1. Use currencySymbol without proper imports/hook usage
    2. Have duplicate currencySymbol declarations
    """
    
    def __init__(self, frontend_src_path: str = "/app/frontend/src"):
        self.frontend_src_path = Path(frontend_src_path)
        self.fixed_files: List[str] = []
        self.errors: List[Dict] = []
        
    def scan_for_issues(self) -> List[Dict]:
        """Scan all JS/JSX files for currencySymbol issues"""
        issues = []
        
        for js_file in self.frontend_src_path.rglob("*.js"):
            if "node_modules" in str(js_file) or ".backup" in str(js_file):
                continue
                
            try:
                content = js_file.read_text(encoding='utf-8')
                
                # Check if file uses currencySymbol
                if "currencySymbol" not in content:
                    continue
                
                # Skip CurrencyContext itself
                if "CurrencyContext" in str(js_file):
                    continue
                
                # Check for duplicate declarations
                currency_declarations = re.findall(
                    r"(?:const\s*\{[^}]*currencySymbol[^}]*\}\s*=\s*(?:useCurrency|getCurrencyInfo)\(\))|(?:const\s*\{\s*symbol:\s*currencySymbol\s*\})",
                    content
                )
                
                if len(currency_declarations) > 1:
                    issues.append({
                        "file": str(js_file),
                        "type": "duplicate_declaration",
                        "count": len(currency_declarations),
                        "message": f"Duplicate currencySymbol declarations found ({len(currency_declarations)})"
                    })
                    continue
                
                # Check if it's a context or hook (can't use other hooks)
                if "/contexts/" in str(js_file) or "/hooks/" in str(js_file):
                    # Check if currencySymbol is used without being defined
                    has_definition = bool(currency_declarations) or "const currencySymbol" in content
                    if not has_definition:
                        issues.append({
                            "file": str(js_file),
                            "type": "context_or_hook",
                            "message": "currencySymbol used in context/hook without definition"
                        })
                    continue
                
                # Check for proper import and hook usage
                has_import = "useCurrency" in content and ("from '../contexts/CurrencyContext'" in content or 
                             "from '../../contexts/CurrencyContext'" in content or
                             "from './contexts/CurrencyContext'" in content)
                has_hook_usage = bool(re.search(r"const\s*\{[^}]*currencySymbol[^}]*\}\s*=\s*useCurrency\(\)", content))
                
                if not has_import or not has_hook_usage:
                    issues.append({
                        "file": str(js_file),
                        "type": "missing_hook",
                        "has_import": has_import,
                        "has_hook_usage": has_hook_usage,
                        "message": f"currencySymbol used without {'import' if not has_import else 'hook usage'}"
                    })
                    
            except Exception as e:
                logger.error(f"Error scanning {js_file}: {e}")
                
        return issues
    
    def fix_duplicate_declarations(self, file_path: str) -> Tuple[bool, str]:
        """Fix duplicate currencySymbol declarations by consolidating them"""
        try:
            path = Path(file_path)
            content = path.read_text(encoding='utf-8')
            original_content = content
            
            # Pattern to find useCurrency hook usage with currencySymbol
            pattern1 = r"const\s*\{\s*currencySymbol\s*\}\s*=\s*useCurrency\(\);\s*\n?"
            pattern2 = r"const\s*\{\s*symbol:\s*currencySymbol\s*\}\s*=\s*getCurrencyInfo\(\);\s*\n?"
            
            # Remove standalone currencySymbol declarations
            content = re.sub(pattern1, "", content)
            content = re.sub(pattern2, "", content)
            
            # Now ensure there's one proper declaration in the combined useCurrency call
            # Find useCurrency declarations
            usecurrency_match = re.search(
                r"const\s*\{([^}]*)\}\s*=\s*useCurrency\(\);",
                content
            )
            
            if usecurrency_match:
                existing_props = usecurrency_match.group(1)
                if "currencySymbol" not in existing_props:
                    # Add currencySymbol to existing useCurrency
                    new_props = existing_props.strip()
                    if new_props and not new_props.endswith(','):
                        new_props += ", "
                    new_props += "currencySymbol"
                    content = content.replace(
                        usecurrency_match.group(0),
                        f"const {{ {new_props} }} = useCurrency();"
                    )
            
            if content != original_content:
                path.write_text(content, encoding='utf-8')
                return True, "Fixed duplicate currencySymbol declarations"
            
            return False, "No changes needed"
            
        except Exception as e:
            logger.error(f"Error fixing duplicates in {file_path}: {e}")
            return False, str(e)
    
    def fix_file(self, file_path: str, issue_type: str) -> Tuple[bool, str]:
        """Fix a single file based on issue type"""
        try:
            if issue_type == "duplicate_declaration":
                return self.fix_duplicate_declarations(file_path)
            
            path = Path(file_path)
            content = path.read_text(encoding='utf-8')
            original_content = content
            
            if issue_type == "context_or_hook":
                # Replace currencySymbol with hardcoded ₹ in contexts/hooks
                content = re.sub(r'\$\{currencySymbol\}', '₹', content)
                content = re.sub(r'\{currencySymbol\}', '₹', content)
                if content != original_content:
                    path.write_text(content, encoding='utf-8')
                    return True, "Replaced currencySymbol with hardcoded ₹ in context/hook"
                return False, "No changes needed"
            
            # Calculate relative import path
            relative_depth = len(path.relative_to(self.frontend_src_path).parts) - 1
            import_path = "../" * relative_depth + "contexts/CurrencyContext"
            
            # Check if useCurrency import exists
            has_usecurrency_import = "useCurrency" in content and "CurrencyContext" in content
            
            # Check if there's already a useCurrency hook call
            existing_hook = re.search(r"const\s*\{([^}]*)\}\s*=\s*useCurrency\(\);", content)
            
            if existing_hook:
                # Add currencySymbol to existing hook if not present
                existing_props = existing_hook.group(1)
                if "currencySymbol" not in existing_props:
                    new_props = existing_props.strip()
                    if new_props and not new_props.endswith(','):
                        new_props += ", "
                    new_props += "currencySymbol"
                    content = content.replace(
                        existing_hook.group(0),
                        f"const {{ {new_props} }} = useCurrency();"
                    )
            else:
                # Add import if needed
                if not has_usecurrency_import:
                    import_matches = list(re.finditer(r"^import .+;?\s*$", content, re.MULTILINE))
                    if import_matches:
                        last_import = import_matches[-1]
                        insert_pos = last_import.end()
                        import_statement = f"\nimport {{ useCurrency }} from '{import_path}';"
                        content = content[:insert_pos] + import_statement + content[insert_pos:]
                
                # Add hook usage after component function declaration
                patterns = [
                    r"(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{)",
                    r"(export\s+function\s+\w+\s*\([^)]*\)\s*\{)",
                    r"(function\s+\w+\s*\([^)]*\)\s*\{)",
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, content)
                    if match:
                        insert_pos = match.end()
                        hook_usage = "\n  const { currencySymbol } = useCurrency();"
                        content = content[:insert_pos] + hook_usage + content[insert_pos:]
                        break
            
            if content != original_content:
                path.write_text(content, encoding='utf-8')
                return True, "Added/fixed useCurrency hook usage"
            
            return False, "File already properly configured"
            
        except Exception as e:
            logger.error(f"Error fixing {file_path}: {e}")
            return False, str(e)
    
    def auto_fix_all(self) -> Dict:
        """Scan and automatically fix all issues"""
        issues = self.scan_for_issues()
        results = {
            "scanned_issues": len(issues),
            "fixed": [],
            "failed": [],
            "skipped": []
        }
        
        for issue in issues:
            file_path = issue["file"]
            issue_type = issue["type"]
            
            success, message = self.fix_file(file_path, issue_type)
            
            if success:
                results["fixed"].append({
                    "file": file_path,
                    "type": issue_type,
                    "message": message
                })
            else:
                if "already" in message.lower() or "no changes" in message.lower():
                    results["skipped"].append({
                        "file": file_path,
                        "message": message
                    })
                else:
                    results["failed"].append({
                        "file": file_path,
                        "error": message
                    })
        
        return results
    
    def verify_fixes(self) -> Dict:
        """Verify that all fixes were applied correctly by rescanning"""
        issues = self.scan_for_issues()
        return {
            "remaining_issues": len(issues),
            "issues": issues,
            "status": "clean" if len(issues) == 0 else "issues_remaining"
        }


# Create singleton instance
auto_fixer = AutoCurrencyFixer()


def scan_currency_issues():
    """API helper to scan for issues"""
    return auto_fixer.scan_for_issues()


def fix_currency_issues():
    """API helper to fix all issues"""
    return auto_fixer.auto_fix_all()


def verify_currency_fixes():
    """API helper to verify fixes"""
    return auto_fixer.verify_fixes()
