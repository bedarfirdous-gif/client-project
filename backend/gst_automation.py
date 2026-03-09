"""
GST Automation System - Complete GST Compliance & Filing
=========================================================
Comprehensive GST automation for Indian businesses including:
1. Automatic GST calculation on invoices
2. GSTR-1, GSTR-3B return generation
3. E-Invoice & E-Way Bill integration
4. ITC (Input Tax Credit) tracking
5. GST reconciliation and reports
6. Multi-state GST handling (IGST/CGST+SGST)

Author: GST Automation System
Version: 1.0.0
"""

import os
import json
import asyncio
import logging
import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase
from decimal import Decimal, ROUND_HALF_UP

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GSTAutomation")


class GSTReturnType(Enum):
    """Types of GST returns"""
    GSTR1 = "gstr1"  # Outward supplies
    GSTR2A = "gstr2a"  # Auto-populated inward supplies
    GSTR2B = "gstr2b"  # Auto-drafted ITC
    GSTR3B = "gstr3b"  # Summary return
    GSTR9 = "gstr9"  # Annual return


class TransactionType(Enum):
    """Types of GST transactions"""
    B2B = "b2b"  # Business to Business
    B2C_LARGE = "b2c_large"  # B2C > 2.5 Lakhs
    B2C_SMALL = "b2c_small"  # B2C < 2.5 Lakhs
    EXPORT = "export"  # Export with payment
    EXPORT_WO_PAY = "export_wo_pay"  # Export without payment
    NIL_RATED = "nil_rated"  # Nil rated supplies
    EXEMPT = "exempt"  # Exempt supplies


class ITCCategory(Enum):
    """ITC categories for GSTR-3B"""
    INPUTS = "inputs"
    CAPITAL_GOODS = "capital_goods"
    INPUT_SERVICES = "input_services"
    INWARD_SUPPLIES_ISD = "inward_supplies_isd"


class GSTState(Enum):
    """Indian state codes for GST"""
    JAMMU_KASHMIR = "01"
    HIMACHAL_PRADESH = "02"
    PUNJAB = "03"
    CHANDIGARH = "04"
    UTTARAKHAND = "05"
    HARYANA = "06"
    DELHI = "07"
    RAJASTHAN = "08"
    UTTAR_PRADESH = "09"
    BIHAR = "10"
    SIKKIM = "11"
    ARUNACHAL_PRADESH = "12"
    NAGALAND = "13"
    MANIPUR = "14"
    MIZORAM = "15"
    TRIPURA = "16"
    MEGHALAYA = "17"
    ASSAM = "18"
    WEST_BENGAL = "19"
    JHARKHAND = "20"
    ODISHA = "21"
    CHHATTISGARH = "22"
    MADHYA_PRADESH = "23"
    GUJARAT = "24"
    DADRA_NAGAR_HAVELI = "26"
    MAHARASHTRA = "27"
    KARNATAKA = "29"
    GOA = "30"
    LAKSHADWEEP = "31"
    KERALA = "32"
    TAMIL_NADU = "33"
    PUDUCHERRY = "34"
    ANDAMAN_NICOBAR = "35"
    TELANGANA = "36"
    ANDHRA_PRADESH = "37"


@dataclass
class GSTInvoiceItem:
    """Single line item for GST calculation"""
    item_id: str = ""
    description: str = ""
    hsn_code: str = ""
    quantity: float = 0
    unit_price: float = 0
    discount: float = 0
    taxable_value: float = 0
    gst_rate: float = 0
    cgst_rate: float = 0
    sgst_rate: float = 0
    igst_rate: float = 0
    cess_rate: float = 0
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    cess_amount: float = 0
    total_amount: float = 0


@dataclass
class GSTInvoice:
    """Complete GST Invoice"""
    invoice_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = ""
    invoice_date: str = field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    invoice_type: str = "regular"  # regular, credit_note, debit_note
    transaction_type: TransactionType = TransactionType.B2B
    
    # Seller details
    seller_gstin: str = ""
    seller_name: str = ""
    seller_address: str = ""
    seller_state_code: str = ""
    
    # Buyer details
    buyer_gstin: str = ""
    buyer_name: str = ""
    buyer_address: str = ""
    buyer_state_code: str = ""
    
    # Items and amounts
    items: List[GSTInvoiceItem] = field(default_factory=list)
    total_taxable_value: float = 0
    total_cgst: float = 0
    total_sgst: float = 0
    total_igst: float = 0
    total_cess: float = 0
    total_tax: float = 0
    total_amount: float = 0
    
    # E-invoice fields
    irn: str = ""  # Invoice Reference Number
    ack_number: str = ""
    ack_date: str = ""
    signed_qr: str = ""
    
    # E-way bill fields
    eway_bill_number: str = ""
    eway_bill_date: str = ""
    
    # Metadata
    place_of_supply: str = ""
    is_inter_state: bool = False
    reverse_charge: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class ITCEntry:
    """Input Tax Credit entry"""
    entry_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    invoice_id: str = ""
    invoice_number: str = ""
    invoice_date: str = ""
    supplier_gstin: str = ""
    supplier_name: str = ""
    category: ITCCategory = ITCCategory.INPUTS
    taxable_value: float = 0
    cgst: float = 0
    sgst: float = 0
    igst: float = 0
    cess: float = 0
    total_itc: float = 0
    is_eligible: bool = True
    reversal_reason: str = ""
    status: str = "available"  # available, utilized, reversed
    period: str = ""  # MMYYYY format


class GSTAutomationSystem:
    """
    Complete GST automation system for Indian businesses.
    
    Features:
    1. Automatic GST calculation based on HSN/SAC codes
    2. Inter-state vs Intra-state tax determination
    3. GSTR-1 return generation
    4. GSTR-3B summary return
    5. ITC tracking and reconciliation
    6. E-Invoice ready format
    7. GST compliance reports
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.invoices_collection = db.gst_invoices
        self.itc_collection = db.gst_itc
        self.returns_collection = db.gst_returns
        self.settings_collection = db.gst_settings
        self.reconciliation_collection = db.gst_reconciliation
        
        logger.info("GST Automation System initialized")
    
    async def init_indexes(self):
        """Initialize database indexes"""
        await self.invoices_collection.create_index([("invoice_date", -1)])
        await self.invoices_collection.create_index([("seller_gstin", 1)])
        await self.invoices_collection.create_index([("buyer_gstin", 1)])
        await self.invoices_collection.create_index([("invoice_number", 1)])
        await self.itc_collection.create_index([("period", 1)])
        await self.itc_collection.create_index([("supplier_gstin", 1)])
        await self.returns_collection.create_index([("period", 1)])
        await self.returns_collection.create_index([("return_type", 1)])
        logger.info("GST Automation indexes created")
    
    def get_state_from_gstin(self, gstin: str) -> str:
        """Extract state code from GSTIN"""
        if len(gstin) >= 2:
            return gstin[:2]
        return ""
    
    def is_inter_state_supply(self, seller_gstin: str, buyer_gstin: str, place_of_supply: str = "") -> bool:
        """Determine if supply is inter-state"""
        seller_state = self.get_state_from_gstin(seller_gstin)
        
        # If buyer has GSTIN, use buyer state
        if buyer_gstin and len(buyer_gstin) >= 2:
            buyer_state = self.get_state_from_gstin(buyer_gstin)
        elif place_of_supply:
            buyer_state = place_of_supply[:2] if len(place_of_supply) >= 2 else ""
        else:
            buyer_state = seller_state  # Default to same state
        
        return seller_state != buyer_state
    
    def calculate_gst(
        self,
        taxable_value: float,
        gst_rate: float,
        is_inter_state: bool,
        cess_rate: float = 0
    ) -> Dict[str, float]:
        """Calculate GST components"""
        gst_rate = Decimal(str(gst_rate))
        taxable_value = Decimal(str(taxable_value))
        cess_rate = Decimal(str(cess_rate))
        
        if is_inter_state:
            igst = (taxable_value * gst_rate / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            cgst = Decimal('0')
            sgst = Decimal('0')
        else:
            half_rate = gst_rate / 2
            cgst = (taxable_value * half_rate / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            sgst = (taxable_value * half_rate / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            igst = Decimal('0')
        
        cess = (taxable_value * cess_rate / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_tax = cgst + sgst + igst + cess
        
        return {
            "cgst_rate": float(gst_rate / 2) if not is_inter_state else 0,
            "sgst_rate": float(gst_rate / 2) if not is_inter_state else 0,
            "igst_rate": float(gst_rate) if is_inter_state else 0,
            "cess_rate": float(cess_rate),
            "cgst_amount": float(cgst),
            "sgst_amount": float(sgst),
            "igst_amount": float(igst),
            "cess_amount": float(cess),
            "total_tax": float(total_tax),
            "total_amount": float(taxable_value + total_tax)
        }
    
    async def calculate_invoice_gst(
        self,
        items: List[Dict],
        seller_gstin: str,
        buyer_gstin: str = "",
        place_of_supply: str = ""
    ) -> Dict[str, Any]:
        """Calculate GST for an entire invoice"""
        is_inter_state = self.is_inter_state_supply(seller_gstin, buyer_gstin, place_of_supply)
        
        calculated_items = []
        total_taxable = 0
        total_cgst = 0
        total_sgst = 0
        total_igst = 0
        total_cess = 0
        
        for item in items:
            taxable_value = item.get("quantity", 1) * item.get("unit_price", 0) - item.get("discount", 0)
            gst_rate = item.get("gst_rate", 18)
            cess_rate = item.get("cess_rate", 0)
            
            gst_calc = self.calculate_gst(taxable_value, gst_rate, is_inter_state, cess_rate)
            
            calculated_item = {
                **item,
                "taxable_value": taxable_value,
                **gst_calc
            }
            calculated_items.append(calculated_item)
            
            total_taxable += taxable_value
            total_cgst += gst_calc["cgst_amount"]
            total_sgst += gst_calc["sgst_amount"]
            total_igst += gst_calc["igst_amount"]
            total_cess += gst_calc["cess_amount"]
        
        total_tax = total_cgst + total_sgst + total_igst + total_cess
        
        return {
            "items": calculated_items,
            "is_inter_state": is_inter_state,
            "total_taxable_value": round(total_taxable, 2),
            "total_cgst": round(total_cgst, 2),
            "total_sgst": round(total_sgst, 2),
            "total_igst": round(total_igst, 2),
            "total_cess": round(total_cess, 2),
            "total_tax": round(total_tax, 2),
            "total_amount": round(total_taxable + total_tax, 2)
        }
    
    async def create_gst_invoice(self, invoice_data: Dict) -> GSTInvoice:
        """Create and save a GST compliant invoice"""
        # Calculate GST
        gst_calc = await self.calculate_invoice_gst(
            invoice_data.get("items", []),
            invoice_data.get("seller_gstin", ""),
            invoice_data.get("buyer_gstin", ""),
            invoice_data.get("place_of_supply", "")
        )
        
        # Determine transaction type
        buyer_gstin = invoice_data.get("buyer_gstin", "")
        total_amount = gst_calc["total_amount"]
        
        if buyer_gstin and len(buyer_gstin) == 15:
            transaction_type = TransactionType.B2B
        elif total_amount > 250000:
            transaction_type = TransactionType.B2C_LARGE
        else:
            transaction_type = TransactionType.B2C_SMALL
        
        invoice = GSTInvoice(
            invoice_number=invoice_data.get("invoice_number", ""),
            invoice_date=invoice_data.get("invoice_date", datetime.now().strftime("%Y-%m-%d")),
            invoice_type=invoice_data.get("invoice_type", "regular"),
            transaction_type=transaction_type,
            seller_gstin=invoice_data.get("seller_gstin", ""),
            seller_name=invoice_data.get("seller_name", ""),
            seller_address=invoice_data.get("seller_address", ""),
            seller_state_code=self.get_state_from_gstin(invoice_data.get("seller_gstin", "")),
            buyer_gstin=buyer_gstin,
            buyer_name=invoice_data.get("buyer_name", ""),
            buyer_address=invoice_data.get("buyer_address", ""),
            buyer_state_code=self.get_state_from_gstin(buyer_gstin) if buyer_gstin else "",
            total_taxable_value=gst_calc["total_taxable_value"],
            total_cgst=gst_calc["total_cgst"],
            total_sgst=gst_calc["total_sgst"],
            total_igst=gst_calc["total_igst"],
            total_cess=gst_calc["total_cess"],
            total_tax=gst_calc["total_tax"],
            total_amount=gst_calc["total_amount"],
            place_of_supply=invoice_data.get("place_of_supply", ""),
            is_inter_state=gst_calc["is_inter_state"],
            reverse_charge=invoice_data.get("reverse_charge", False)
        )
        
        # Convert items
        invoice.items = [
            GSTInvoiceItem(
                item_id=item.get("item_id", str(uuid.uuid4())),
                description=item.get("description", ""),
                hsn_code=item.get("hsn_code", ""),
                quantity=item.get("quantity", 0),
                unit_price=item.get("unit_price", 0),
                discount=item.get("discount", 0),
                taxable_value=item.get("taxable_value", 0),
                gst_rate=item.get("gst_rate", 0),
                cgst_rate=item.get("cgst_rate", 0),
                sgst_rate=item.get("sgst_rate", 0),
                igst_rate=item.get("igst_rate", 0),
                cess_rate=item.get("cess_rate", 0),
                cgst_amount=item.get("cgst_amount", 0),
                sgst_amount=item.get("sgst_amount", 0),
                igst_amount=item.get("igst_amount", 0),
                cess_amount=item.get("cess_amount", 0),
                total_amount=item.get("total_amount", 0)
            )
            for item in gst_calc["items"]
        ]
        
        # Save to database
        invoice_dict = {
            "invoice_id": invoice.invoice_id,
            "invoice_number": invoice.invoice_number,
            "invoice_date": invoice.invoice_date,
            "invoice_type": invoice.invoice_type,
            "transaction_type": invoice.transaction_type.value,
            "seller_gstin": invoice.seller_gstin,
            "seller_name": invoice.seller_name,
            "seller_state_code": invoice.seller_state_code,
            "buyer_gstin": invoice.buyer_gstin,
            "buyer_name": invoice.buyer_name,
            "buyer_state_code": invoice.buyer_state_code,
            "items": [item.__dict__ for item in invoice.items],
            "total_taxable_value": invoice.total_taxable_value,
            "total_cgst": invoice.total_cgst,
            "total_sgst": invoice.total_sgst,
            "total_igst": invoice.total_igst,
            "total_cess": invoice.total_cess,
            "total_tax": invoice.total_tax,
            "total_amount": invoice.total_amount,
            "place_of_supply": invoice.place_of_supply,
            "is_inter_state": invoice.is_inter_state,
            "reverse_charge": invoice.reverse_charge,
            "created_at": invoice.created_at
        }
        
        await self.invoices_collection.insert_one(invoice_dict)
        
        return invoice
    
    async def generate_gstr1(self, gstin: str, period: str) -> Dict[str, Any]:
        """Generate GSTR-1 return data"""
        # Period format: MMYYYY
        month = int(period[:2])
        year = int(period[2:])
        
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        
        # Fetch invoices
        invoices = await self.invoices_collection.find({
            "seller_gstin": gstin,
            "invoice_date": {"$gte": start_date, "$lt": end_date}
        }).to_list(10000)
        
        # Categorize by transaction type
        b2b = []
        b2cl = []  # B2C Large
        b2cs = {"intra": [], "inter": []}  # B2C Small aggregated by rate
        nil_exempt = []
        
        for inv in invoices:
            trans_type = inv.get("transaction_type", "")
            
            if trans_type == "b2b":
                b2b.append({
                    "ctin": inv.get("buyer_gstin"),
                    "inv": [{
                        "inum": inv.get("invoice_number"),
                        "idt": inv.get("invoice_date"),
                        "val": inv.get("total_amount"),
                        "pos": inv.get("place_of_supply", inv.get("buyer_state_code")),
                        "rchrg": "Y" if inv.get("reverse_charge") else "N",
                        "itms": [
                            {
                                "num": i + 1,
                                "itm_det": {
                                    "rt": item.get("gst_rate", 0),
                                    "txval": item.get("taxable_value", 0),
                                    "camt": item.get("cgst_amount", 0),
                                    "samt": item.get("sgst_amount", 0),
                                    "iamt": item.get("igst_amount", 0),
                                    "csamt": item.get("cess_amount", 0)
                                }
                            }
                            for i, item in enumerate(inv.get("items", []))
                        ]
                    }]
                })
            elif trans_type == "b2c_large":
                b2cl.append({
                    "pos": inv.get("place_of_supply", inv.get("buyer_state_code")),
                    "inv": [{
                        "inum": inv.get("invoice_number"),
                        "idt": inv.get("invoice_date"),
                        "val": inv.get("total_amount"),
                        "itms": [
                            {
                                "num": i + 1,
                                "itm_det": {
                                    "rt": item.get("gst_rate", 0),
                                    "txval": item.get("taxable_value", 0),
                                    "iamt": item.get("igst_amount", 0),
                                    "csamt": item.get("cess_amount", 0)
                                }
                            }
                            for i, item in enumerate(inv.get("items", []))
                        ]
                    }]
                })
        
        # Calculate totals
        total_taxable = sum(inv.get("total_taxable_value", 0) for inv in invoices)
        total_cgst = sum(inv.get("total_cgst", 0) for inv in invoices)
        total_sgst = sum(inv.get("total_sgst", 0) for inv in invoices)
        total_igst = sum(inv.get("total_igst", 0) for inv in invoices)
        total_cess = sum(inv.get("total_cess", 0) for inv in invoices)
        
        gstr1_data = {
            "gstin": gstin,
            "fp": period,  # Filing period
            "gt": total_taxable + total_cgst + total_sgst + total_igst + total_cess,  # Gross turnover
            "b2b": b2b,
            "b2cl": b2cl,
            "b2cs": b2cs,
            "nil": nil_exempt,
            "summary": {
                "total_invoices": len(invoices),
                "total_taxable_value": total_taxable,
                "total_cgst": total_cgst,
                "total_sgst": total_sgst,
                "total_igst": total_igst,
                "total_cess": total_cess,
                "total_tax": total_cgst + total_sgst + total_igst + total_cess
            }
        }
        
        # Save return
        await self.returns_collection.update_one(
            {"gstin": gstin, "period": period, "return_type": "gstr1"},
            {"$set": {
                **gstr1_data,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "status": "generated"
            }},
            upsert=True
        )
        
        return gstr1_data
    
    async def generate_gstr3b(self, gstin: str, period: str) -> Dict[str, Any]:
        """Generate GSTR-3B summary return"""
        # Get GSTR-1 data
        gstr1 = await self.returns_collection.find_one({
            "gstin": gstin,
            "period": period,
            "return_type": "gstr1"
        })
        
        # Get ITC data
        itc_entries = await self.itc_collection.find({
            "period": period,
            "status": "available"
        }).to_list(10000)
        
        # Calculate outward supplies from GSTR-1
        outward = gstr1.get("summary", {}) if gstr1 else {}
        
        # Calculate ITC
        itc_inputs = sum(e.get("total_itc", 0) for e in itc_entries if e.get("category") == "inputs")
        itc_capital = sum(e.get("total_itc", 0) for e in itc_entries if e.get("category") == "capital_goods")
        itc_services = sum(e.get("total_itc", 0) for e in itc_entries if e.get("category") == "input_services")
        
        total_itc_available = itc_inputs + itc_capital + itc_services
        
        # Calculate tax liability
        output_tax = outward.get("total_cgst", 0) + outward.get("total_sgst", 0) + outward.get("total_igst", 0)
        net_tax_payable = max(0, output_tax - total_itc_available)
        
        gstr3b_data = {
            "gstin": gstin,
            "ret_period": period,
            "sup_details": {
                "osup_det": {  # Outward taxable supplies
                    "txval": outward.get("total_taxable_value", 0),
                    "camt": outward.get("total_cgst", 0),
                    "samt": outward.get("total_sgst", 0),
                    "iamt": outward.get("total_igst", 0),
                    "csamt": outward.get("total_cess", 0)
                },
                "osup_nil_exmp": {  # Nil rated, exempted
                    "txval": 0
                },
                "isup_rev": {  # Inward supplies reverse charge
                    "txval": 0,
                    "camt": 0,
                    "samt": 0,
                    "iamt": 0
                }
            },
            "itc_elg": {
                "itc_avl": [
                    {"ty": "INPUTS", "iamt": itc_inputs, "camt": itc_inputs / 2, "samt": itc_inputs / 2, "csamt": 0},
                    {"ty": "CAPITAL GOODS", "iamt": itc_capital, "camt": itc_capital / 2, "samt": itc_capital / 2, "csamt": 0},
                    {"ty": "INPUT SERVICES", "iamt": itc_services, "camt": itc_services / 2, "samt": itc_services / 2, "csamt": 0}
                ],
                "itc_net": total_itc_available,
                "itc_inelg": []
            },
            "tax_pmt": {
                "tx_py": {  # Tax payable
                    "camt": max(0, outward.get("total_cgst", 0) - total_itc_available / 2),
                    "samt": max(0, outward.get("total_sgst", 0) - total_itc_available / 2),
                    "iamt": max(0, outward.get("total_igst", 0) - total_itc_available),
                    "csamt": outward.get("total_cess", 0)
                }
            },
            "summary": {
                "output_tax": output_tax,
                "itc_available": total_itc_available,
                "net_tax_payable": net_tax_payable,
                "total_invoices": outward.get("total_invoices", 0)
            }
        }
        
        # Save return
        await self.returns_collection.update_one(
            {"gstin": gstin, "period": period, "return_type": "gstr3b"},
            {"$set": {
                **gstr3b_data,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "status": "generated"
            }},
            upsert=True
        )
        
        return gstr3b_data
    
    async def record_itc(self, itc_data: Dict) -> ITCEntry:
        """Record Input Tax Credit from purchase invoice"""
        entry = ITCEntry(
            invoice_id=itc_data.get("invoice_id", ""),
            invoice_number=itc_data.get("invoice_number", ""),
            invoice_date=itc_data.get("invoice_date", ""),
            supplier_gstin=itc_data.get("supplier_gstin", ""),
            supplier_name=itc_data.get("supplier_name", ""),
            category=ITCCategory(itc_data.get("category", "inputs")),
            taxable_value=itc_data.get("taxable_value", 0),
            cgst=itc_data.get("cgst", 0),
            sgst=itc_data.get("sgst", 0),
            igst=itc_data.get("igst", 0),
            cess=itc_data.get("cess", 0),
            total_itc=itc_data.get("cgst", 0) + itc_data.get("sgst", 0) + itc_data.get("igst", 0) + itc_data.get("cess", 0),
            is_eligible=itc_data.get("is_eligible", True),
            period=itc_data.get("period", datetime.now().strftime("%m%Y"))
        )
        
        await self.itc_collection.insert_one({
            "entry_id": entry.entry_id,
            "invoice_id": entry.invoice_id,
            "invoice_number": entry.invoice_number,
            "invoice_date": entry.invoice_date,
            "supplier_gstin": entry.supplier_gstin,
            "supplier_name": entry.supplier_name,
            "category": entry.category.value,
            "taxable_value": entry.taxable_value,
            "cgst": entry.cgst,
            "sgst": entry.sgst,
            "igst": entry.igst,
            "cess": entry.cess,
            "total_itc": entry.total_itc,
            "is_eligible": entry.is_eligible,
            "status": entry.status,
            "period": entry.period,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return entry
    
    async def get_gst_summary(self, gstin: str, from_date: str, to_date: str) -> Dict[str, Any]:
        """Get GST summary for a period"""
        invoices = await self.invoices_collection.find({
            "seller_gstin": gstin,
            "invoice_date": {"$gte": from_date, "$lte": to_date}
        }).to_list(10000)
        
        # Aggregate by GST rate
        by_rate = {}
        for inv in invoices:
            for item in inv.get("items", []):
                rate = item.get("gst_rate", 0)
                if rate not in by_rate:
                    by_rate[rate] = {
                        "taxable_value": 0,
                        "cgst": 0,
                        "sgst": 0,
                        "igst": 0,
                        "cess": 0,
                        "invoice_count": 0
                    }
                by_rate[rate]["taxable_value"] += item.get("taxable_value", 0)
                by_rate[rate]["cgst"] += item.get("cgst_amount", 0)
                by_rate[rate]["sgst"] += item.get("sgst_amount", 0)
                by_rate[rate]["igst"] += item.get("igst_amount", 0)
                by_rate[rate]["cess"] += item.get("cess_amount", 0)
            by_rate[rate]["invoice_count"] += 1
        
        total_taxable = sum(inv.get("total_taxable_value", 0) for inv in invoices)
        total_tax = sum(inv.get("total_tax", 0) for inv in invoices)
        
        return {
            "gstin": gstin,
            "period": f"{from_date} to {to_date}",
            "total_invoices": len(invoices),
            "total_taxable_value": round(total_taxable, 2),
            "total_tax": round(total_tax, 2),
            "total_amount": round(total_taxable + total_tax, 2),
            "by_rate": {str(k): v for k, v in by_rate.items()}
        }
    
    async def get_returns(self, gstin: str, return_type: str = None) -> List[Dict]:
        """Get generated GST returns"""
        query = {"gstin": gstin}
        if return_type:
            query["return_type"] = return_type
        
        returns = await self.returns_collection.find(
            query, {"_id": 0}
        ).sort("period", -1).to_list(50)
        
        return returns
    
    async def get_itc_summary(self, period: str) -> Dict[str, Any]:
        """Get ITC summary for a period"""
        entries = await self.itc_collection.find({
            "period": period
        }).to_list(10000)
        
        available = [e for e in entries if e.get("status") == "available" and e.get("is_eligible")]
        utilized = [e for e in entries if e.get("status") == "utilized"]
        reversed_entries = [e for e in entries if e.get("status") == "reversed"]
        
        return {
            "period": period,
            "total_entries": len(entries),
            "available": {
                "count": len(available),
                "total": sum(e.get("total_itc", 0) for e in available)
            },
            "utilized": {
                "count": len(utilized),
                "total": sum(e.get("total_itc", 0) for e in utilized)
            },
            "reversed": {
                "count": len(reversed_entries),
                "total": sum(e.get("total_itc", 0) for e in reversed_entries)
            },
            "by_category": {
                "inputs": sum(e.get("total_itc", 0) for e in available if e.get("category") == "inputs"),
                "capital_goods": sum(e.get("total_itc", 0) for e in available if e.get("category") == "capital_goods"),
                "input_services": sum(e.get("total_itc", 0) for e in available if e.get("category") == "input_services")
            }
        }
    
    async def get_dashboard_stats(self, gstin: str) -> Dict[str, Any]:
        """Get GST automation dashboard statistics"""
        current_month = datetime.now().strftime("%m%Y")
        current_year = datetime.now().year
        
        # Current month invoices
        month_start = datetime.now().replace(day=1).strftime("%Y-%m-%d")
        
        month_invoices = await self.invoices_collection.count_documents({
            "seller_gstin": gstin,
            "invoice_date": {"$gte": month_start}
        })
        
        # Get tax collected this month
        pipeline = [
            {"$match": {"seller_gstin": gstin, "invoice_date": {"$gte": month_start}}},
            {"$group": {
                "_id": None,
                "total_taxable": {"$sum": "$total_taxable_value"},
                "total_tax": {"$sum": "$total_tax"},
                "total_amount": {"$sum": "$total_amount"}
            }}
        ]
        tax_result = await self.invoices_collection.aggregate(pipeline).to_list(1)
        tax_collected = tax_result[0] if tax_result else {"total_taxable": 0, "total_tax": 0, "total_amount": 0}
        
        # Get ITC available
        itc_summary = await self.get_itc_summary(current_month)
        
        # Get pending returns
        pending_returns = await self.returns_collection.count_documents({
            "gstin": gstin,
            "status": "generated"
        })
        
        return {
            "gstin": gstin,
            "current_month": current_month,
            "month_invoices": month_invoices,
            "tax_collected": {
                "taxable_value": tax_collected.get("total_taxable", 0),
                "total_tax": tax_collected.get("total_tax", 0),
                "total_amount": tax_collected.get("total_amount", 0)
            },
            "itc_available": itc_summary.get("available", {}).get("total", 0),
            "net_liability": max(0, tax_collected.get("total_tax", 0) - itc_summary.get("available", {}).get("total", 0)),
            "pending_returns": pending_returns,
            "compliance_status": "compliant" if pending_returns == 0 else "pending"
        }
    
    async def generate_e_invoice(self, invoice_id: str) -> Dict[str, Any]:
        """
        Generate E-Invoice with IRN and QR code for B2B invoices > Rs.50,000
        
        E-Invoice is mandatory for:
        - B2B transactions
        - Invoice value > Rs.50,000 (threshold as of 2024)
        
        Returns:
        - IRN (Invoice Reference Number)
        - Acknowledgement Number
        - QR Code data
        - Signed Invoice
        """
        invoice = await self.invoices_collection.find_one({"invoice_id": invoice_id})
        if not invoice:
            return {"error": "Invoice not found"}
        
        # Check eligibility
        is_b2b = invoice.get("buyer_gstin") and len(invoice.get("buyer_gstin", "")) == 15
        total_amount = invoice.get("total_amount", 0)
        
        if not is_b2b:
            return {"error": "E-Invoice not required for B2C transactions"}
        
        if total_amount < 50000:
            return {
                "warning": "E-Invoice optional for invoices below Rs.50,000",
                "can_generate": True
            }
        
        # Generate IRN (Invoice Reference Number)
        # In production, this would call the GST Portal API
        # For now, we generate a simulated IRN
        import hashlib
        import base64
        
        irn_input = f"{invoice.get('seller_gstin')}|{invoice.get('invoice_number')}|{invoice.get('invoice_date')}"
        irn_hash = hashlib.sha256(irn_input.encode()).hexdigest()[:64]
        irn = irn_hash.upper()
        
        # Generate Acknowledgement Number
        ack_number = str(uuid.uuid4().int)[:16]
        ack_date = datetime.now(timezone.utc).isoformat()
        
        # Generate QR Code data (JSON format as per GST specifications)
        qr_data = {
            "sellerGstin": invoice.get("seller_gstin"),
            "buyerGstin": invoice.get("buyer_gstin"),
            "docNo": invoice.get("invoice_number"),
            "docDt": invoice.get("invoice_date"),
            "totInvVal": invoice.get("total_amount"),
            "itemCnt": len(invoice.get("items", [])),
            "mainHsnCode": invoice.get("items", [{}])[0].get("hsn_code", "") if invoice.get("items") else "",
            "irn": irn,
            "ackNo": ack_number,
            "ackDt": ack_date
        }
        
        # Encode QR data (in production, this would be signed)
        qr_json = json.dumps(qr_data)
        signed_qr = base64.b64encode(qr_json.encode()).decode()
        
        # Update invoice with E-Invoice details
        await self.invoices_collection.update_one(
            {"invoice_id": invoice_id},
            {"$set": {
                "irn": irn,
                "ack_number": ack_number,
                "ack_date": ack_date,
                "signed_qr": signed_qr,
                "e_invoice_status": "generated",
                "e_invoice_generated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "invoice_id": invoice_id,
            "invoice_number": invoice.get("invoice_number"),
            "irn": irn,
            "ack_number": ack_number,
            "ack_date": ack_date,
            "qr_data": qr_data,
            "signed_qr": signed_qr,
            "status": "generated",
            "message": "E-Invoice generated successfully"
        }
    
    async def generate_e_invoices_batch(self, gstin: str, from_date: str = None) -> Dict[str, Any]:
        """
        Auto-generate E-Invoices for all eligible B2B invoices
        """
        if not from_date:
            from_date = datetime.now().replace(day=1).strftime("%Y-%m-%d")
        
        # Find eligible invoices (B2B, amount >= 50000, no IRN yet)
        eligible = await self.invoices_collection.find({
            "seller_gstin": gstin,
            "invoice_date": {"$gte": from_date},
            "buyer_gstin": {"$exists": True, "$ne": ""},
            "total_amount": {"$gte": 50000},
            "irn": {"$exists": False}
        }).to_list(1000)
        
        results = {
            "total_eligible": len(eligible),
            "generated": 0,
            "failed": 0,
            "invoices": []
        }
        
        for inv in eligible:
            try:
                result = await self.generate_e_invoice(inv["invoice_id"])
                if result.get("irn"):
                    results["generated"] += 1
                    results["invoices"].append({
                        "invoice_number": inv["invoice_number"],
                        "irn": result["irn"],
                        "status": "success"
                    })
                else:
                    results["failed"] += 1
                    results["invoices"].append({
                        "invoice_number": inv["invoice_number"],
                        "error": result.get("error", "Unknown error"),
                        "status": "failed"
                    })
            except Exception as e:
                results["failed"] += 1
                results["invoices"].append({
                    "invoice_number": inv.get("invoice_number"),
                    "error": str(e),
                    "status": "failed"
                })
        
        return results
    
    async def get_e_invoice_stats(self, gstin: str) -> Dict[str, Any]:
        """Get E-Invoice statistics"""
        # Total B2B invoices
        total_b2b = await self.invoices_collection.count_documents({
            "seller_gstin": gstin,
            "buyer_gstin": {"$exists": True, "$ne": ""}
        })
        
        # Eligible (>= 50000)
        eligible = await self.invoices_collection.count_documents({
            "seller_gstin": gstin,
            "buyer_gstin": {"$exists": True, "$ne": ""},
            "total_amount": {"$gte": 50000}
        })
        
        # Generated
        generated = await self.invoices_collection.count_documents({
            "seller_gstin": gstin,
            "irn": {"$exists": True, "$ne": ""}
        })
        
        # Pending
        pending = await self.invoices_collection.count_documents({
            "seller_gstin": gstin,
            "buyer_gstin": {"$exists": True, "$ne": ""},
            "total_amount": {"$gte": 50000},
            "irn": {"$exists": False}
        })
        
        return {
            "total_b2b_invoices": total_b2b,
            "eligible_for_einvoice": eligible,
            "einvoices_generated": generated,
            "pending_einvoices": pending,
            "compliance_percentage": (generated / eligible * 100) if eligible > 0 else 100
        }
