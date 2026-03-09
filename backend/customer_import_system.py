"""
Customer Bulk Upload + Smart AI Data Extraction System
Supports: PDF, Images, Excel, CSV, JSON, Camera Scanning, Web Scraping
AI Models: Gemini 3 Flash (OCR), GPT-5.2 (Field Mapping)
"""

import os
import io
import json
import csv
import base64
import uuid
import tempfile
import asyncio
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from enum import Enum
import logging
from pathlib import Path

# For file processing
import openpyxl
from PyPDF2 import PdfReader

# For web scraping
import httpx
from bs4 import BeautifulSoup

# AI Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# ============== MODELS ==============

class ImportSource(str, Enum):
    MANUAL_UPLOAD = "manual_upload"
    SMART_SCANNER = "smart_scanner"
    CAMERA_SCAN = "camera_scan"
    AI_EXTRACTOR = "ai_extractor"
    WEB_SCRAPER = "web_scraper"

class ImportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEW = "review"
    APPROVED = "approved"
    IMPORTED = "imported"
    FAILED = "failed"

class FileType(str, Enum):
    IMAGE = "image"
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    JSON = "json"
    WEB_PAGE = "web_page"

class ExtractedCustomer(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    company: Optional[str] = None
    gst_number: Optional[str] = None
    id_number: Optional[str] = None
    customer_type: str = "retail"
    confidence_scores: Dict[str, float] = {}
    raw_text: Optional[str] = None
    needs_review: bool = False
    review_notes: List[str] = []

class WebScraperConfig(BaseModel):
    url: str
    auth_type: str = "none"  # none, basic, cookie, session
    username: Optional[str] = None
    password: Optional[str] = None
    cookies: Optional[Dict[str, str]] = None
    headers: Optional[Dict[str, str]] = None

class ImportBatchCreate(BaseModel):
    source: ImportSource
    file_type: Optional[FileType] = None
    direct_import: bool = False  # If True, skip staging
    
class CustomerImportRequest(BaseModel):
    customer_ids: List[str]  # IDs from staging

# ============== CUSTOMER IMPORT SYSTEM ==============

class CustomerImportSystem:
    def __init__(self, db: AsyncIOMotorDatabase, emergent_api_key: str = None):
        self.db = db
        self.api_key = emergent_api_key or os.environ.get('EMERGENT_LLM_KEY')
        self.staging_collection = db.customer_import_staging
        self.batches_collection = db.customer_import_batches
        self.customers_collection = db.customers
        
        # AI extraction prompt
        self.extraction_prompt = """You are an expert data extraction AI. Analyze the provided document/image and extract ALL customer information you can find.

For each customer found, extract:
- name: Full name of the person or business
- phone: Phone number (any format, include country code if visible)
- email: Email address
- address: Full address
- company: Company/business name
- gst_number: GST/Tax ID number
- id_number: Any other ID numbers (PAN, Aadhar, etc.)

IMPORTANT RULES:
1. Extract ALL customers you find in the document
2. If a field is not found, set it to null
3. Provide confidence score (0.0 to 1.0) for each field you extract
4. Flag any field with confidence < 0.7 for review
5. If the document appears to be a list/table, extract each row as a separate customer

Return your response as a valid JSON object with this structure:
{
    "customers": [
        {
            "name": "extracted name or null",
            "phone": "extracted phone or null",
            "email": "extracted email or null",
            "address": "extracted address or null",
            "company": "extracted company or null",
            "gst_number": "extracted GST or null",
            "id_number": "extracted ID or null",
            "confidence_scores": {
                "name": 0.95,
                "phone": 0.8,
                ...
            },
            "needs_review": true/false,
            "review_notes": ["reason for review if any"]
        }
    ],
    "document_type": "invoice/contact_list/business_card/report/other",
    "total_extracted": number,
    "raw_text_summary": "brief summary of document content"
}

Only return valid JSON, no markdown or extra text."""

    # ============== FILE PROCESSING ==============

    async def process_image(self, image_data: bytes, mime_type: str) -> Dict[str, Any]:
        """Process image using Gemini Vision for OCR and extraction"""
        try:
            # Convert to base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Use Gemini for vision/OCR
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"ocr_{uuid.uuid4().hex[:8]}",
                system_message="You are an expert OCR and data extraction system."
            ).with_model("gemini", "gemini-3-flash-preview")
            
            # Create image content
            image_content = ImageContent(image_base64=image_base64)
            
            user_message = UserMessage(
                text=self.extraction_prompt,
                file_contents=[image_content]
            )
            
            response = await chat.send_message(user_message)
            
            # Parse JSON response
            try:
                # Clean response - remove markdown if present
                cleaned = response.strip()
                if cleaned.startswith('```'):
                    cleaned = cleaned.split('```')[1]
                    if cleaned.startswith('json'):
                        cleaned = cleaned[4:]
                cleaned = cleaned.strip()
                
                result = json.loads(cleaned)
                return {
                    "success": True,
                    "data": result,
                    "source": "gemini_vision"
                }
            except json.JSONDecodeError:
                # Try GPT for better parsing
                return await self._refine_with_gpt(response)
                
        except Exception as e:
            logger.error(f"Image processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    async def process_pdf(self, pdf_data: bytes) -> Dict[str, Any]:
        """Process PDF file - extract text and use AI for field mapping"""
        try:
            # Extract text from PDF
            pdf_file = io.BytesIO(pdf_data)
            reader = PdfReader(pdf_file)
            
            text_content = ""
            for page in reader.pages:
                text_content += page.extract_text() + "\n"
            
            if not text_content.strip():
                return {
                    "success": False,
                    "error": "PDF appears to be image-based. Please use Smart Scanner with image extraction.",
                    "data": None
                }
            
            # Use GPT for intelligent field extraction
            return await self._extract_with_gpt(text_content)
            
        except Exception as e:
            logger.error(f"PDF processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    async def process_excel(self, excel_data: bytes) -> Dict[str, Any]:
        """Process Excel file - map columns to customer fields"""
        try:
            excel_file = io.BytesIO(excel_data)
            workbook = openpyxl.load_workbook(excel_file, data_only=True)
            sheet = workbook.active
            
            # Get headers from first row
            headers = []
            for cell in sheet[1]:
                headers.append(str(cell.value).lower().strip() if cell.value else "")
            
            # Map common header variations
            field_mappings = {
                "name": ["name", "customer name", "full name", "customer", "party name", "party"],
                "phone": ["phone", "mobile", "contact", "phone number", "mobile number", "contact number", "tel"],
                "email": ["email", "email address", "e-mail", "mail"],
                "address": ["address", "full address", "location", "addr"],
                "company": ["company", "company name", "business", "organization", "org", "firm"],
                "gst_number": ["gst", "gstin", "gst number", "gst no", "tax id", "vat"],
                "id_number": ["pan", "aadhar", "id", "id number", "identification"]
            }
            
            # Find column indices for each field
            column_map = {}
            for field, variations in field_mappings.items():
                for i, header in enumerate(headers):
                    if any(var in header for var in variations):
                        column_map[field] = i
                        break
            
            # Extract customers from rows
            customers = []
            for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                if not any(row):  # Skip empty rows
                    continue
                    
                customer = {
                    "name": None,
                    "phone": None,
                    "email": None,
                    "address": None,
                    "company": None,
                    "gst_number": None,
                    "id_number": None,
                    "confidence_scores": {},
                    "needs_review": False,
                    "review_notes": []
                }
                
                for field, col_idx in column_map.items():
                    if col_idx < len(row) and row[col_idx]:
                        customer[field] = str(row[col_idx]).strip()
                        customer["confidence_scores"][field] = 1.0  # High confidence for direct mapping
                
                # Check if we have minimum data
                if customer["name"] or customer["phone"] or customer["email"]:
                    # Flag for review if missing key fields
                    if not customer["name"]:
                        customer["needs_review"] = True
                        customer["review_notes"].append("Name is missing")
                    customers.append(customer)
            
            return {
                "success": True,
                "data": {
                    "customers": customers,
                    "document_type": "excel_export",
                    "total_extracted": len(customers),
                    "column_mapping": column_map
                },
                "source": "excel_parser"
            }
            
        except Exception as e:
            logger.error(f"Excel processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    async def process_csv(self, csv_data: bytes) -> Dict[str, Any]:
        """Process CSV file"""
        try:
            # Detect encoding and parse
            content = csv_data.decode('utf-8-sig')  # Handle BOM
            reader = csv.DictReader(io.StringIO(content))
            
            field_mappings = {
                "name": ["name", "customer name", "full name", "customer", "party name"],
                "phone": ["phone", "mobile", "contact", "phone number", "mobile number"],
                "email": ["email", "email address", "e-mail"],
                "address": ["address", "full address", "location"],
                "company": ["company", "company name", "business", "organization"],
                "gst_number": ["gst", "gstin", "gst number", "tax id"],
                "id_number": ["pan", "aadhar", "id", "id number"]
            }
            
            # Map headers
            header_map = {}
            if reader.fieldnames:
                for field, variations in field_mappings.items():
                    for header in reader.fieldnames:
                        header_lower = header.lower().strip()
                        if any(var in header_lower for var in variations):
                            header_map[field] = header
                            break
            
            customers = []
            for row in reader:
                customer = {
                    "name": None,
                    "phone": None,
                    "email": None,
                    "address": None,
                    "company": None,
                    "gst_number": None,
                    "id_number": None,
                    "confidence_scores": {},
                    "needs_review": False,
                    "review_notes": []
                }
                
                for field, header in header_map.items():
                    if row.get(header):
                        customer[field] = str(row[header]).strip()
                        customer["confidence_scores"][field] = 1.0
                
                if customer["name"] or customer["phone"] or customer["email"]:
                    if not customer["name"]:
                        customer["needs_review"] = True
                        customer["review_notes"].append("Name is missing")
                    customers.append(customer)
            
            return {
                "success": True,
                "data": {
                    "customers": customers,
                    "document_type": "csv_export",
                    "total_extracted": len(customers),
                    "header_mapping": header_map
                },
                "source": "csv_parser"
            }
            
        except Exception as e:
            logger.error(f"CSV processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    async def process_json(self, json_data: bytes) -> Dict[str, Any]:
        """Process JSON file - supports various CRM export formats"""
        try:
            content = json.loads(json_data.decode('utf-8'))
            
            # Handle different JSON structures
            customers_data = []
            
            if isinstance(content, list):
                customers_data = content
            elif isinstance(content, dict):
                # Try common keys
                for key in ['customers', 'contacts', 'parties', 'data', 'records', 'items']:
                    if key in content and isinstance(content[key], list):
                        customers_data = content[key]
                        break
                if not customers_data:
                    customers_data = [content]
            
            field_mappings = {
                "name": ["name", "customer_name", "fullName", "full_name", "customerName", "party_name"],
                "phone": ["phone", "mobile", "contact", "phoneNumber", "phone_number", "mobileNumber"],
                "email": ["email", "emailAddress", "email_address", "mail"],
                "address": ["address", "fullAddress", "full_address", "location"],
                "company": ["company", "companyName", "company_name", "organization", "business"],
                "gst_number": ["gst", "gstin", "gstNumber", "gst_number", "taxId", "tax_id"],
                "id_number": ["pan", "aadhar", "idNumber", "id_number", "identification"]
            }
            
            customers = []
            for item in customers_data:
                if not isinstance(item, dict):
                    continue
                    
                customer = {
                    "name": None,
                    "phone": None,
                    "email": None,
                    "address": None,
                    "company": None,
                    "gst_number": None,
                    "id_number": None,
                    "confidence_scores": {},
                    "needs_review": False,
                    "review_notes": []
                }
                
                for field, variations in field_mappings.items():
                    for var in variations:
                        if var in item and item[var]:
                            customer[field] = str(item[var]).strip()
                            customer["confidence_scores"][field] = 1.0
                            break
                
                if customer["name"] or customer["phone"] or customer["email"]:
                    if not customer["name"]:
                        customer["needs_review"] = True
                        customer["review_notes"].append("Name is missing")
                    customers.append(customer)
            
            return {
                "success": True,
                "data": {
                    "customers": customers,
                    "document_type": "json_export",
                    "total_extracted": len(customers)
                },
                "source": "json_parser"
            }
            
        except Exception as e:
            logger.error(f"JSON processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    async def process_web_page(self, url: str, config: WebScraperConfig = None) -> Dict[str, Any]:
        """Scrape customer data from a web page URL"""
        try:
            # Prepare headers
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }
            
            if config and config.headers:
                headers.update(config.headers)
            
            # Prepare cookies
            cookies = {}
            if config and config.cookies:
                cookies = config.cookies
            
            # Fetch the page
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                # Handle authentication if provided
                if config and config.auth_type == "basic" and config.username and config.password:
                    auth = httpx.BasicAuth(config.username, config.password)
                    response = await client.get(url, headers=headers, cookies=cookies, auth=auth)
                else:
                    response = await client.get(url, headers=headers, cookies=cookies)
                
                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"Failed to fetch page: HTTP {response.status_code}",
                        "data": None
                    }
                
                html_content = response.text
            
            # Parse HTML
            soup = BeautifulSoup(html_content, 'lxml')
            
            # Try to find tables first
            customers = []
            tables = soup.find_all('table')
            
            for table in tables:
                rows = table.find_all('tr')
                if not rows:
                    continue
                
                # Try to get headers from first row
                header_row = rows[0]
                headers_cells = header_row.find_all(['th', 'td'])
                headers_text = [cell.get_text(strip=True).lower() for cell in headers_cells]
                
                # Map headers to fields
                field_mappings = {
                    "name": ["name", "party name", "customer", "party", "customer name", "full name"],
                    "phone": ["phone", "mobile", "contact", "phone number", "mobile no", "mob"],
                    "address": ["address", "location", "addr", "full address"],
                    "email": ["email", "e-mail", "mail"],
                    "company": ["company", "firm", "business"],
                    "gst_number": ["gst", "gstin", "gst no", "tax"],
                }
                
                column_map = {}
                for field, variations in field_mappings.items():
                    for idx, header in enumerate(headers_text):
                        if any(var in header for var in variations):
                            column_map[field] = idx
                            break
                
                # Extract data from rows
                for row in rows[1:]:  # Skip header row
                    cells = row.find_all(['td', 'th'])
                    if not cells:
                        continue
                    
                    cell_texts = [cell.get_text(strip=True) for cell in cells]
                    
                    customer = {
                        "name": None,
                        "phone": None,
                        "email": None,
                        "address": None,
                        "company": None,
                        "gst_number": None,
                        "id_number": None,
                        "confidence_scores": {},
                        "needs_review": False,
                        "review_notes": []
                    }
                    
                    for field, col_idx in column_map.items():
                        if col_idx < len(cell_texts) and cell_texts[col_idx]:
                            customer[field] = cell_texts[col_idx]
                            customer["confidence_scores"][field] = 0.9
                    
                    # Also try to extract phone numbers from any cell
                    if not customer["phone"]:
                        for text in cell_texts:
                            phone_match = re.search(r'[\+]?[\d\s\-]{10,}', text)
                            if phone_match:
                                customer["phone"] = phone_match.group().strip()
                                customer["confidence_scores"]["phone"] = 0.7
                                customer["needs_review"] = True
                                break
                    
                    if customer["name"] or customer["phone"]:
                        if not customer["name"]:
                            customer["needs_review"] = True
                            customer["review_notes"].append("Name extracted from table but uncertain")
                        customers.append(customer)
            
            # If no tables found or no customers extracted, try AI extraction
            if not customers:
                # Get visible text content
                for script in soup(["script", "style", "nav", "footer", "header"]):
                    script.decompose()
                
                text_content = soup.get_text(separator='\n', strip=True)
                
                # Use AI to extract customers
                return await self._extract_with_gpt(text_content[:10000])
            
            return {
                "success": True,
                "data": {
                    "customers": customers,
                    "document_type": "web_page",
                    "total_extracted": len(customers),
                    "source_url": url
                },
                "source": "web_scraper"
            }
            
        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "Request timed out. The page took too long to load.",
                "data": None
            }
        except Exception as e:
            logger.error(f"Web scraping error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    async def _extract_with_gpt(self, text_content: str) -> Dict[str, Any]:
        """Use GPT for intelligent field extraction from text"""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"extract_{uuid.uuid4().hex[:8]}",
                system_message="You are an expert data extraction system."
            ).with_model("openai", "gpt-5.2")
            
            prompt = f"""{self.extraction_prompt}

Document content:
{text_content[:8000]}"""  # Limit content length
            
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            # Parse JSON response
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('```')[1]
                if cleaned.startswith('json'):
                    cleaned = cleaned[4:]
            cleaned = cleaned.strip()
            
            result = json.loads(cleaned)
            return {
                "success": True,
                "data": result,
                "source": "gpt_extraction"
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error from GPT: {str(e)}")
            return {
                "success": False,
                "error": "AI returned invalid JSON format",
                "raw_response": response[:500] if 'response' in dir() else None,
                "data": None
            }
        except Exception as e:
            logger.error(f"GPT extraction error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    async def _refine_with_gpt(self, raw_text: str) -> Dict[str, Any]:
        """Refine OCR output with GPT for better field mapping"""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"refine_{uuid.uuid4().hex[:8]}",
                system_message="You are an expert at structuring extracted text into customer data."
            ).with_model("openai", "gpt-5.2")
            
            prompt = f"""The following text was extracted from a document via OCR. 
Please structure it into customer records.

{self.extraction_prompt}

OCR Output:
{raw_text[:8000]}"""
            
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('```')[1]
                if cleaned.startswith('json'):
                    cleaned = cleaned[4:]
            cleaned = cleaned.strip()
            
            result = json.loads(cleaned)
            return {
                "success": True,
                "data": result,
                "source": "gpt_refinement"
            }
            
        except Exception as e:
            logger.error(f"GPT refinement error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }

    # ============== BATCH MANAGEMENT ==============

    async def create_import_batch(
        self,
        tenant_id: str,
        user_id: str,
        source: ImportSource,
        file_data: bytes,
        file_type: FileType,
        filename: str,
        direct_import: bool = False
    ) -> Dict[str, Any]:
        """Create a new import batch and process the file"""
        
        batch_id = str(uuid.uuid4())
        
        # Create batch record
        batch = {
            "id": batch_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "source": source.value,
            "file_type": file_type.value,
            "filename": filename,
            "status": ImportStatus.PROCESSING.value,
            "direct_import": direct_import,
            "total_extracted": 0,
            "total_imported": 0,
            "total_failed": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await self.batches_collection.insert_one(batch)
        
        # Process file based on type
        result = None
        if file_type == FileType.IMAGE:
            # Detect mime type
            mime_type = "image/jpeg"
            if filename.lower().endswith('.png'):
                mime_type = "image/png"
            elif filename.lower().endswith('.webp'):
                mime_type = "image/webp"
            result = await self.process_image(file_data, mime_type)
        elif file_type == FileType.PDF:
            result = await self.process_pdf(file_data)
        elif file_type == FileType.EXCEL:
            result = await self.process_excel(file_data)
        elif file_type == FileType.CSV:
            result = await self.process_csv(file_data)
        elif file_type == FileType.JSON:
            result = await self.process_json(file_data)
        
        if not result or not result.get("success"):
            # Update batch as failed
            await self.batches_collection.update_one(
                {"id": batch_id},
                {"$set": {
                    "status": ImportStatus.FAILED.value,
                    "error": result.get("error") if result else "Unknown error",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            return {
                "success": False,
                "batch_id": batch_id,
                "error": result.get("error") if result else "Processing failed"
            }
        
        # Save extracted customers to staging
        customers = result.get("data", {}).get("customers", [])
        staging_records = []
        
        for idx, customer in enumerate(customers):
            staging_record = {
                "id": str(uuid.uuid4()),
                "batch_id": batch_id,
                "tenant_id": tenant_id,
                "index": idx,
                "name": customer.get("name"),
                "phone": customer.get("phone"),
                "email": customer.get("email"),
                "address": customer.get("address"),
                "company": customer.get("company"),
                "gst_number": customer.get("gst_number"),
                "id_number": customer.get("id_number"),
                "confidence_scores": customer.get("confidence_scores", {}),
                "needs_review": customer.get("needs_review", False),
                "review_notes": customer.get("review_notes", []),
                "status": ImportStatus.REVIEW.value if not direct_import else ImportStatus.PENDING.value,
                "created_at": datetime.now(timezone.utc)
            }
            staging_records.append(staging_record)
        
        if staging_records:
            await self.staging_collection.insert_many(staging_records)
        
        # Update batch
        status = ImportStatus.REVIEW.value
        if direct_import and staging_records:
            # Auto-import if direct_import is True
            imported_count = 0
            for record in staging_records:
                try:
                    await self._import_single_customer(tenant_id, record)
                    imported_count += 1
                except Exception as e:
                    logger.error(f"Direct import error: {str(e)}")
            
            status = ImportStatus.IMPORTED.value
            await self.batches_collection.update_one(
                {"id": batch_id},
                {"$set": {
                    "status": status,
                    "total_extracted": len(customers),
                    "total_imported": imported_count,
                    "total_failed": len(customers) - imported_count,
                    "document_type": result.get("data", {}).get("document_type"),
                    "extraction_source": result.get("source"),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        else:
            await self.batches_collection.update_one(
                {"id": batch_id},
                {"$set": {
                    "status": status,
                    "total_extracted": len(customers),
                    "document_type": result.get("data", {}).get("document_type"),
                    "extraction_source": result.get("source"),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        return {
            "success": True,
            "batch_id": batch_id,
            "total_extracted": len(customers),
            "needs_review": sum(1 for c in customers if c.get("needs_review")),
            "status": status,
            "source": result.get("source")
        }

    async def _import_single_customer(self, tenant_id: str, record: Dict[str, Any]) -> str:
        """Import a single customer from staging"""
        customer_doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "name": record.get("name") or "Unknown",
            "phone": record.get("phone"),
            "email": record.get("email"),
            "address": record.get("address"),
            "company": record.get("company"),
            "gst_number": record.get("gst_number"),
            "id_number": record.get("id_number"),
            "customer_type": "retail",
            "loyalty_enrolled": False,
            "loyalty_points": 0,
            "import_source": "bulk_import",
            "import_batch_id": record.get("batch_id"),
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.customers_collection.insert_one(customer_doc)
        
        # Update staging record
        await self.staging_collection.update_one(
            {"id": record["id"]},
            {"$set": {"status": ImportStatus.IMPORTED.value}}
        )
        
        return customer_doc["id"]

    async def get_batch(self, tenant_id: str, batch_id: str) -> Optional[Dict[str, Any]]:
        """Get import batch details"""
        batch = await self.batches_collection.find_one(
            {"id": batch_id, "tenant_id": tenant_id},
            {"_id": 0}
        )
        return batch

    async def get_batches(self, tenant_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get all import batches for tenant"""
        cursor = self.batches_collection.find(
            {"tenant_id": tenant_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit)
        
        batches = await cursor.to_list(length=limit)
        return batches

    async def get_staging_customers(
        self,
        tenant_id: str,
        batch_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get customers in staging for a batch"""
        query = {"tenant_id": tenant_id, "batch_id": batch_id}
        if status:
            query["status"] = status
        
        cursor = self.staging_collection.find(query, {"_id": 0}).sort("index", 1)
        records = await cursor.to_list(length=1000)
        return records

    async def update_staging_customer(
        self,
        tenant_id: str,
        staging_id: str,
        update_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a customer in staging"""
        allowed_fields = ["name", "phone", "email", "address", "company", "gst_number", "id_number", "needs_review", "review_notes"]
        update = {k: v for k, v in update_data.items() if k in allowed_fields}
        update["updated_at"] = datetime.now(timezone.utc)
        
        await self.staging_collection.update_one(
            {"id": staging_id, "tenant_id": tenant_id},
            {"$set": update}
        )
        
        record = await self.staging_collection.find_one(
            {"id": staging_id},
            {"_id": 0}
        )
        return record

    async def approve_and_import(
        self,
        tenant_id: str,
        batch_id: str,
        staging_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Approve staging records and import to customers"""
        query = {"tenant_id": tenant_id, "batch_id": batch_id, "status": ImportStatus.REVIEW.value}
        if staging_ids:
            query["id"] = {"$in": staging_ids}
        
        records = await self.staging_collection.find(query, {"_id": 0}).to_list(length=10000)
        
        imported = 0
        failed = 0
        
        for record in records:
            try:
                await self._import_single_customer(tenant_id, record)
                imported += 1
            except Exception as e:
                logger.error(f"Import error: {str(e)}")
                await self.staging_collection.update_one(
                    {"id": record["id"]},
                    {"$set": {"status": ImportStatus.FAILED.value, "error": str(e)}}
                )
                failed += 1
        
        # Update batch
        batch = await self.batches_collection.find_one({"id": batch_id})
        if batch:
            new_imported = batch.get("total_imported", 0) + imported
            new_failed = batch.get("total_failed", 0) + failed
            
            # Check if all done
            status = batch.get("status")
            if new_imported + new_failed >= batch.get("total_extracted", 0):
                status = ImportStatus.IMPORTED.value
            
            await self.batches_collection.update_one(
                {"id": batch_id},
                {"$set": {
                    "total_imported": new_imported,
                    "total_failed": new_failed,
                    "status": status,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        return {
            "success": True,
            "imported": imported,
            "failed": failed,
            "batch_id": batch_id
        }

    async def delete_staging_customer(self, tenant_id: str, staging_id: str) -> bool:
        """Delete a customer from staging"""
        result = await self.staging_collection.delete_one(
            {"id": staging_id, "tenant_id": tenant_id}
        )
        return result.deleted_count > 0

    async def delete_batch(self, tenant_id: str, batch_id: str) -> bool:
        """Delete an import batch and its staging records"""
        await self.staging_collection.delete_many(
            {"batch_id": batch_id, "tenant_id": tenant_id}
        )
        result = await self.batches_collection.delete_one(
            {"id": batch_id, "tenant_id": tenant_id}
        )
        return result.deleted_count > 0

    async def get_import_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get import statistics"""
        pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_extracted": {"$sum": "$total_extracted"},
                "total_imported": {"$sum": "$total_imported"}
            }}
        ]
        
        stats = {
            "total_batches": 0,
            "pending_review": 0,
            "total_extracted": 0,
            "total_imported": 0
        }
        
        async for doc in self.batches_collection.aggregate(pipeline):
            stats["total_batches"] += doc["count"]
            stats["total_extracted"] += doc.get("total_extracted", 0)
            stats["total_imported"] += doc.get("total_imported", 0)
            if doc["_id"] == ImportStatus.REVIEW.value:
                stats["pending_review"] = doc["count"]
        
        return stats
