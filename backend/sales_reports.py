"""
Sales Reports System - Payment-wise Reports with Export
=======================================================
Comprehensive sales reporting by payment type with export to Excel and Tally.

Features:
1. Cash Sales Reports
2. Credit Sales Reports
3. UPI/Bank Transfer/Card Sales Reports
4. Export to Excel (XLSX)
5. Export to Tally XML format
6. Date range filtering
7. Summary statistics

Author: Sales Reports System
Version: 1.0.0
"""

import os
import io
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import xlsxwriter
from xml.etree import ElementTree as ET
from xml.dom import minidom

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SalesReports")


class PaymentType:
    """Payment type constants"""
    CASH = "cash"
    CREDIT = "credit"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    CHEQUE = "cheque"
    MIXED = "mixed"


class SalesReportSystem:
    """
    Comprehensive sales reporting system with payment-wise reports.
    
    Features:
    - Payment type filtering (Cash, Credit, UPI, Bank, Card)
    - Date range filtering
    - Customer-wise breakdown
    - Export to Excel (XLSX)
    - Export to Tally XML format
    - Summary statistics
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.sales_collection = db.sales
        self.invoices_collection = db.invoices
        self.customers_collection = db.customers
        
        logger.info("Sales Report System initialized")
    
    async def get_sales_by_payment_type(
        self,
        tenant_id: str,
        payment_type: str,
        from_date: str,
        to_date: str,
        store_id: str = None
    ) -> Dict[str, Any]:
        """Get sales filtered by payment type"""
        
        query = {
            "tenant_id": tenant_id,
            "date": {"$gte": from_date, "$lte": to_date}
        }
        
        # Handle payment type filter
        if payment_type == PaymentType.CASH:
            query["payment_method"] = {"$in": ["cash", "Cash", "CASH"]}
        elif payment_type == PaymentType.CREDIT:
            query["$or"] = [
                {"payment_method": {"$in": ["credit", "Credit", "CREDIT"]}},
                {"is_credit_sale": True},
                {"credit_amount": {"$gt": 0}}
            ]
        elif payment_type == PaymentType.UPI:
            query["payment_method"] = {"$in": ["upi", "UPI", "Upi", "gpay", "phonepe", "paytm"]}
        elif payment_type == PaymentType.BANK_TRANSFER:
            query["payment_method"] = {"$in": ["bank", "bank_transfer", "neft", "rtgs", "imps", "Bank Transfer"]}
        elif payment_type == PaymentType.CARD:
            query["payment_method"] = {"$in": ["card", "Card", "debit_card", "credit_card", "Debit Card", "Credit Card"]}
        elif payment_type == PaymentType.CHEQUE:
            query["payment_method"] = {"$in": ["cheque", "Cheque", "CHEQUE", "check"]}
        
        if store_id:
            query["store_id"] = store_id
        
        # Fetch sales
        sales = await self.sales_collection.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
        
        # Calculate summary
        total_amount = sum(sale.get("total", sale.get("grand_total", 0)) for sale in sales)
        total_tax = sum(sale.get("tax_amount", sale.get("gst_amount", 0)) for sale in sales)
        total_discount = sum(sale.get("discount", sale.get("discount_amount", 0)) for sale in sales)
        
        # Group by date
        by_date = {}
        for sale in sales:
            date = sale.get("date", "")[:10]
            if date not in by_date:
                by_date[date] = {"count": 0, "amount": 0}
            by_date[date]["count"] += 1
            by_date[date]["amount"] += sale.get("total", sale.get("grand_total", 0))
        
        return {
            "payment_type": payment_type,
            "period": f"{from_date} to {to_date}",
            "total_sales": len(sales),
            "total_amount": round(total_amount, 2),
            "total_tax": round(total_tax, 2),
            "total_discount": round(total_discount, 2),
            "net_amount": round(total_amount - total_discount, 2),
            "by_date": by_date,
            "sales": sales[:100]  # Limit for API response
        }
    
    async def get_cash_sales_report(
        self,
        tenant_id: str,
        from_date: str,
        to_date: str,
        store_id: str = None
    ) -> Dict[str, Any]:
        """Get cash sales report"""
        return await self.get_sales_by_payment_type(
            tenant_id, PaymentType.CASH, from_date, to_date, store_id
        )
    
    async def get_credit_sales_report(
        self,
        tenant_id: str,
        from_date: str,
        to_date: str,
        store_id: str = None
    ) -> Dict[str, Any]:
        """Get credit sales report with outstanding amounts"""
        report = await self.get_sales_by_payment_type(
            tenant_id, PaymentType.CREDIT, from_date, to_date, store_id
        )
        
        # Add credit-specific details
        total_outstanding = 0
        total_collected = 0
        
        for sale in report.get("sales", []):
            outstanding = sale.get("outstanding_amount", sale.get("balance_due", 0))
            collected = sale.get("paid_amount", sale.get("amount_paid", 0))
            total_outstanding += outstanding
            total_collected += collected
        
        report["total_outstanding"] = round(total_outstanding, 2)
        report["total_collected"] = round(total_collected, 2)
        report["collection_rate"] = round((total_collected / report["total_amount"] * 100) if report["total_amount"] > 0 else 0, 2)
        
        return report
    
    async def get_digital_payments_report(
        self,
        tenant_id: str,
        from_date: str,
        to_date: str,
        payment_type: str = "all",  # upi, card, bank_transfer, all
        store_id: str = None
    ) -> Dict[str, Any]:
        """Get digital payments report (UPI, Card, Bank Transfer)"""
        
        if payment_type == "all":
            # Combine all digital payment types
            upi_report = await self.get_sales_by_payment_type(
                tenant_id, PaymentType.UPI, from_date, to_date, store_id
            )
            card_report = await self.get_sales_by_payment_type(
                tenant_id, PaymentType.CARD, from_date, to_date, store_id
            )
            bank_report = await self.get_sales_by_payment_type(
                tenant_id, PaymentType.BANK_TRANSFER, from_date, to_date, store_id
            )
            
            return {
                "payment_type": "digital_payments",
                "period": f"{from_date} to {to_date}",
                "summary": {
                    "upi": {
                        "count": upi_report["total_sales"],
                        "amount": upi_report["total_amount"]
                    },
                    "card": {
                        "count": card_report["total_sales"],
                        "amount": card_report["total_amount"]
                    },
                    "bank_transfer": {
                        "count": bank_report["total_sales"],
                        "amount": bank_report["total_amount"]
                    }
                },
                "total_sales": upi_report["total_sales"] + card_report["total_sales"] + bank_report["total_sales"],
                "total_amount": upi_report["total_amount"] + card_report["total_amount"] + bank_report["total_amount"],
                "upi_sales": upi_report.get("sales", [])[:30],
                "card_sales": card_report.get("sales", [])[:30],
                "bank_sales": bank_report.get("sales", [])[:30]
            }
        else:
            return await self.get_sales_by_payment_type(
                tenant_id, payment_type, from_date, to_date, store_id
            )
    
    async def get_all_sales_summary(
        self,
        tenant_id: str,
        from_date: str,
        to_date: str,
        store_id: str = None
    ) -> Dict[str, Any]:
        """Get summary of all sales by payment type"""
        
        cash = await self.get_cash_sales_report(tenant_id, from_date, to_date, store_id)
        credit = await self.get_credit_sales_report(tenant_id, from_date, to_date, store_id)
        upi = await self.get_sales_by_payment_type(tenant_id, PaymentType.UPI, from_date, to_date, store_id)
        card = await self.get_sales_by_payment_type(tenant_id, PaymentType.CARD, from_date, to_date, store_id)
        bank = await self.get_sales_by_payment_type(tenant_id, PaymentType.BANK_TRANSFER, from_date, to_date, store_id)
        cheque = await self.get_sales_by_payment_type(tenant_id, PaymentType.CHEQUE, from_date, to_date, store_id)
        
        total_sales = cash["total_sales"] + credit["total_sales"] + upi["total_sales"] + card["total_sales"] + bank["total_sales"] + cheque["total_sales"]
        total_amount = cash["total_amount"] + credit["total_amount"] + upi["total_amount"] + card["total_amount"] + bank["total_amount"] + cheque["total_amount"]
        
        return {
            "period": f"{from_date} to {to_date}",
            "total_sales": total_sales,
            "total_amount": round(total_amount, 2),
            "by_payment_type": {
                "cash": {
                    "count": cash["total_sales"],
                    "amount": cash["total_amount"],
                    "percentage": round((cash["total_amount"] / total_amount * 100) if total_amount > 0 else 0, 2)
                },
                "credit": {
                    "count": credit["total_sales"],
                    "amount": credit["total_amount"],
                    "outstanding": credit.get("total_outstanding", 0),
                    "percentage": round((credit["total_amount"] / total_amount * 100) if total_amount > 0 else 0, 2)
                },
                "upi": {
                    "count": upi["total_sales"],
                    "amount": upi["total_amount"],
                    "percentage": round((upi["total_amount"] / total_amount * 100) if total_amount > 0 else 0, 2)
                },
                "card": {
                    "count": card["total_sales"],
                    "amount": card["total_amount"],
                    "percentage": round((card["total_amount"] / total_amount * 100) if total_amount > 0 else 0, 2)
                },
                "bank_transfer": {
                    "count": bank["total_sales"],
                    "amount": bank["total_amount"],
                    "percentage": round((bank["total_amount"] / total_amount * 100) if total_amount > 0 else 0, 2)
                },
                "cheque": {
                    "count": cheque["total_sales"],
                    "amount": cheque["total_amount"],
                    "percentage": round((cheque["total_amount"] / total_amount * 100) if total_amount > 0 else 0, 2)
                }
            }
        }
    
    def generate_excel_report(
        self,
        sales_list: list,
        payment_type: str,
        from_date: str = "",
        to_date: str = "",
        payment_summary: Dict[str, Any] = None
    ) -> io.BytesIO:
        """Generate Excel file from sales list"""
        
        if payment_summary is None:
            payment_summary = {}
        
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        # Formats
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1,
            'align': 'center'
        })
        money_format = workbook.add_format({'num_format': '₹#,##0.00', 'border': 1})
        date_format = workbook.add_format({'num_format': 'dd-mm-yyyy', 'border': 1})
        cell_format = workbook.add_format({'border': 1})
        total_format = workbook.add_format({
            'bold': True,
            'bg_color': '#E2EFDA',
            'num_format': '₹#,##0.00',
            'border': 1
        })
        
        # Calculate totals from sales list
        total_amount = sum(s.get('total', s.get('grand_total', s.get('total_amount', 0))) for s in sales_list)
        total_tax = sum(s.get('tax_amount', s.get('gst_amount', 0)) for s in sales_list)
        total_discount = sum(s.get('discount', s.get('discount_amount', 0)) for s in sales_list)
        
        # Summary Sheet
        summary_sheet = workbook.add_worksheet('Summary')
        summary_sheet.set_column('A:A', 25)
        summary_sheet.set_column('B:B', 20)
        
        summary_sheet.write('A1', f'{payment_type.upper()} SALES REPORT', header_format)
        summary_sheet.merge_range('A1:B1', f'{payment_type.upper()} SALES REPORT', header_format)
        
        summary_sheet.write('A3', 'Period:', cell_format)
        summary_sheet.write('B3', f'{from_date} to {to_date}', cell_format)
        summary_sheet.write('A4', 'Total Sales:', cell_format)
        summary_sheet.write('B4', len(sales_list), cell_format)
        summary_sheet.write('A5', 'Total Amount:', cell_format)
        summary_sheet.write('B5', total_amount, money_format)
        summary_sheet.write('A6', 'Total Tax:', cell_format)
        summary_sheet.write('B6', total_tax, money_format)
        summary_sheet.write('A7', 'Total Discount:', cell_format)
        summary_sheet.write('B7', total_discount, money_format)
        summary_sheet.write('A8', 'Net Amount:', cell_format)
        summary_sheet.write('B8', total_amount - total_discount, total_format)
        
        # Payment type breakdown if available
        if payment_summary:
            row = 10
            summary_sheet.write(f'A{row}', 'Payment Type Breakdown:', header_format)
            summary_sheet.merge_range(f'A{row}:B{row}', 'Payment Type Breakdown:', header_format)
            row += 1
            for ptype, pdata in payment_summary.items():
                if isinstance(pdata, dict):
                    summary_sheet.write(f'A{row}', ptype.capitalize(), cell_format)
                    summary_sheet.write(f'B{row}', pdata.get('amount', 0), money_format)
                    row += 1
        
        # Details Sheet
        details_sheet = workbook.add_worksheet('Sales Details')
        
        # Headers
        headers = ['Date', 'Invoice No', 'Customer', 'Items', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment Method']
        
        for col, header in enumerate(headers):
            details_sheet.write(0, col, header, header_format)
            details_sheet.set_column(col, col, 15)
        
        # Data rows
        for row, sale in enumerate(sales_list, 1):
            sale_date = sale.get('date', sale.get('sale_date', sale.get('created_at', '')))
            if sale_date:
                sale_date = str(sale_date)[:10]
            details_sheet.write(row, 0, sale_date, cell_format)
            details_sheet.write(row, 1, sale.get('invoice_number', sale.get('id', '')), cell_format)
            details_sheet.write(row, 2, sale.get('customer_name', 'Walk-in'), cell_format)
            details_sheet.write(row, 3, len(sale.get('items', [])), cell_format)
            details_sheet.write(row, 4, sale.get('subtotal', 0), money_format)
            details_sheet.write(row, 5, sale.get('tax_amount', sale.get('gst_amount', 0)), money_format)
            details_sheet.write(row, 6, sale.get('discount', sale.get('discount_amount', 0)), money_format)
            details_sheet.write(row, 7, sale.get('total', sale.get('grand_total', sale.get('total_amount', 0))), money_format)
            details_sheet.write(row, 8, sale.get('payment_method', ''), cell_format)
        
        workbook.close()
        output.seek(0)
        return output
    
    def generate_tally_xml(
        self,
        sales_list: list,
        company_name: str = "BijnisBooks",
        from_date: str = "",
        to_date: str = ""
    ) -> str:
        """Generate Tally-compatible XML from sales list"""
        
        # Create root element
        envelope = ET.Element('ENVELOPE')
        
        # Header
        header = ET.SubElement(envelope, 'HEADER')
        tallyrequest = ET.SubElement(header, 'TALLYREQUEST')
        tallyrequest.text = 'Import Data'
        
        # Body
        body = ET.SubElement(envelope, 'BODY')
        importdata = ET.SubElement(body, 'IMPORTDATA')
        requestdesc = ET.SubElement(importdata, 'REQUESTDESC')
        
        reportname = ET.SubElement(requestdesc, 'REPORTNAME')
        reportname.text = 'Vouchers'
        
        staticvariables = ET.SubElement(requestdesc, 'STATICVARIABLES')
        svcurrentcompany = ET.SubElement(staticvariables, 'SVCURRENTCOMPANY')
        svcurrentcompany.text = company_name
        
        requestdata = ET.SubElement(importdata, 'REQUESTDATA')
        
        # Create vouchers for each sale
        for sale in sales_list:
            tallymessage = ET.SubElement(requestdata, 'TALLYMESSAGE', {'xmlns:UDF': 'TallyUDF'})
            
            voucher = ET.SubElement(tallymessage, 'VOUCHER', {
                'REMOTEID': str(sale.get('id', str(uuid.uuid4()))),
                'VCHTYPE': 'Sales',
                'ACTION': 'Create'
            })
            
            # Voucher details
            date_el = ET.SubElement(voucher, 'DATE')
            sale_date = sale.get('date', sale.get('sale_date', sale.get('created_at', '')))
            if sale_date:
                sale_date = str(sale_date)[:10].replace('-', '')
            date_el.text = sale_date or ''
            
            vouchertypename = ET.SubElement(voucher, 'VOUCHERTYPENAME')
            vouchertypename.text = 'Sales'
            
            vouchernumber = ET.SubElement(voucher, 'VOUCHERNUMBER')
            vouchernumber.text = str(sale.get('invoice_number', sale.get('id', '')))
            
            partyledgername = ET.SubElement(voucher, 'PARTYLEDGERNAME')
            partyledgername.text = sale.get('customer_name', 'Cash Sales')
            
            # Narration
            narration = ET.SubElement(voucher, 'NARRATION')
            payment_method = sale.get('payment_method', 'Cash')
            narration.text = f"{payment_method} Sale - {sale.get('invoice_number', '')}"
            
            # Inventory entries (items)
            for item in sale.get('items', []):
                inventry = ET.SubElement(voucher, 'INVENTORYENTRIES.LIST')
                
                stockitemname = ET.SubElement(inventry, 'STOCKITEMNAME')
                stockitemname.text = item.get('name', item.get('item_name', 'Item'))
                
                isdeemedpositive = ET.SubElement(inventry, 'ISDEEMEDPOSITIVE')
                isdeemedpositive.text = 'No'
                
                rate = ET.SubElement(inventry, 'RATE')
                rate.text = f"{item.get('price', item.get('rate', item.get('unit_price', 0)))}/Nos"
                
                amount = ET.SubElement(inventry, 'AMOUNT')
                item_total = item.get('total', item.get('amount', 0))
                if not item_total:
                    item_total = item.get('quantity', 1) * item.get('rate', item.get('price', 0))
                amount.text = str(item_total)
                
                actualqty = ET.SubElement(inventry, 'ACTUALQTY')
                actualqty.text = f"{item.get('quantity', 1)} Nos"
                
                billedqty = ET.SubElement(inventry, 'BILLEDQTY')
                billedqty.text = f"{item.get('quantity', 1)} Nos"
            
            # Ledger entries
            # Sales ledger (Credit)
            ledger_sales = ET.SubElement(voucher, 'LEDGERENTRIES.LIST')
            ledgername_sales = ET.SubElement(ledger_sales, 'LEDGERNAME')
            ledgername_sales.text = 'Sales Account'
            isdeemedpositive_sales = ET.SubElement(ledger_sales, 'ISDEEMEDPOSITIVE')
            isdeemedpositive_sales.text = 'No'
            amount_sales = ET.SubElement(ledger_sales, 'AMOUNT')
            sale_total = sale.get('subtotal', sale.get('total', sale.get('total_amount', 0)))
            amount_sales.text = str(-sale_total)
            
            # Tax ledger if applicable
            tax_amount = sale.get('tax_amount', sale.get('gst_amount', 0))
            if tax_amount and tax_amount > 0:
                ledger_tax = ET.SubElement(voucher, 'LEDGERENTRIES.LIST')
                ledgername_tax = ET.SubElement(ledger_tax, 'LEDGERNAME')
                ledgername_tax.text = 'Output GST'
                isdeemedpositive_tax = ET.SubElement(ledger_tax, 'ISDEEMEDPOSITIVE')
                isdeemedpositive_tax.text = 'No'
                amount_tax = ET.SubElement(ledger_tax, 'AMOUNT')
                amount_tax.text = str(-tax_amount)
            
            # Party ledger (Debit) - determine based on payment method
            ledger_party = ET.SubElement(voucher, 'LEDGERENTRIES.LIST')
            ledgername_party = ET.SubElement(ledger_party, 'LEDGERNAME')
            
            payment_method_lower = str(sale.get('payment_method', 'cash')).lower()
            if 'cash' in payment_method_lower:
                ledgername_party.text = 'Cash'
            elif 'credit' in payment_method_lower:
                ledgername_party.text = sale.get('customer_name', 'Sundry Debtors')
            elif any(x in payment_method_lower for x in ['upi', 'bank', 'neft', 'rtgs', 'imps']):
                ledgername_party.text = 'Bank Account'
            elif 'card' in payment_method_lower:
                ledgername_party.text = 'Card Payments'
            else:
                ledgername_party.text = 'Cash'
            
            isdeemedpositive_party = ET.SubElement(ledger_party, 'ISDEEMEDPOSITIVE')
            isdeemedpositive_party.text = 'Yes'
            amount_party = ET.SubElement(ledger_party, 'AMOUNT')
            grand_total = sale.get('total', sale.get('grand_total', sale.get('total_amount', 0)))
            amount_party.text = str(grand_total)
        
        # Convert to pretty XML string
        xml_str = ET.tostring(envelope, encoding='unicode')
        dom = minidom.parseString(xml_str)
        return dom.toprettyxml(indent="  ")
    
    async def export_report(
        self,
        tenant_id: str,
        report_type: str,
        from_date: str,
        to_date: str,
        export_format: str,  # 'excel' or 'tally'
        store_id: str = None,
        company_name: str = "BijnisBooks"
    ) -> Dict[str, Any]:
        """Export sales report to Excel or Tally format"""
        
        # Get report data
        if report_type == 'cash':
            report_data = await self.get_cash_sales_report(tenant_id, from_date, to_date, store_id)
        elif report_type == 'credit':
            report_data = await self.get_credit_sales_report(tenant_id, from_date, to_date, store_id)
        elif report_type == 'upi':
            report_data = await self.get_sales_by_payment_type(tenant_id, PaymentType.UPI, from_date, to_date, store_id)
        elif report_type == 'card':
            report_data = await self.get_sales_by_payment_type(tenant_id, PaymentType.CARD, from_date, to_date, store_id)
        elif report_type == 'bank_transfer':
            report_data = await self.get_sales_by_payment_type(tenant_id, PaymentType.BANK_TRANSFER, from_date, to_date, store_id)
        elif report_type == 'digital':
            report_data = await self.get_digital_payments_report(tenant_id, from_date, to_date, "all", store_id)
        else:
            report_data = await self.get_all_sales_summary(tenant_id, from_date, to_date, store_id)
        
        # Generate export
        if export_format == 'excel':
            file_data = self.generate_excel_report(report_data, report_type)
            filename = f"{report_type}_sales_report_{from_date}_to_{to_date}.xlsx"
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif export_format == 'tally':
            file_data = self.generate_tally_xml(report_data, report_type, company_name)
            filename = f"{report_type}_sales_tally_{from_date}_to_{to_date}.xml"
            content_type = "application/xml"
        else:
            return {"error": "Invalid export format. Use 'excel' or 'tally'"}
        
        return {
            "filename": filename,
            "content_type": content_type,
            "data": file_data,
            "report_summary": {
                "type": report_type,
                "period": f"{from_date} to {to_date}",
                "total_sales": report_data.get("total_sales", 0),
                "total_amount": report_data.get("total_amount", 0)
            }
        }
