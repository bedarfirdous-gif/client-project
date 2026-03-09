"""
Optimized Receipt Printing & Barcode Service
============================================
High-performance printing service for:
1. Thermal receipt printers (ESC/POS)
2. Network printers
3. Barcode label printing
4. PDF generation

Author: BijnisBooks
Version: 2.0.0
"""

import os
import io
import base64
import socket
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import qrcode
from PIL import Image
import barcode
from barcode.writer import ImageWriter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PrintService")


class PrinterType(Enum):
    """Supported printer types"""
    THERMAL_USB = "thermal_usb"
    THERMAL_NETWORK = "thermal_network"
    THERMAL_BLUETOOTH = "thermal_bluetooth"
    STANDARD = "standard"
    PDF = "pdf"


class PaperSize(Enum):
    """Paper size options"""
    THERMAL_58MM = (58, 0)  # 58mm width, continuous
    THERMAL_80MM = (80, 0)  # 80mm width, continuous
    A4 = (210, 297)
    A5 = (148, 210)
    LETTER = (216, 279)
    LABEL_38X25 = (38, 25)
    LABEL_50X25 = (50, 25)
    LABEL_50X30 = (50, 30)


@dataclass
class PrinterConfig:
    """Printer configuration"""
    printer_type: PrinterType = PrinterType.THERMAL_NETWORK
    ip_address: str = ""
    port: int = 9100
    paper_size: PaperSize = PaperSize.THERMAL_80MM
    timeout: int = 10
    encoding: str = "utf-8"
    cut_paper: bool = True
    open_drawer: bool = False


@dataclass
class ReceiptData:
    """Receipt/Invoice data structure"""
    invoice_number: str
    store_name: str
    store_address: str = ""
    store_phone: str = ""
    store_gstin: str = ""
    customer_name: str = "Walk-in Customer"
    customer_phone: str = ""
    items: List[Dict] = field(default_factory=list)
    subtotal: float = 0
    discount_amount: float = 0
    voucher_discount: float = 0
    loyalty_points_value: float = 0
    tax_amount: float = 0
    total_amount: float = 0
    payment_mode: str = "Cash"
    amount_paid: float = 0
    change_amount: float = 0
    currency_symbol: str = "₹"
    date: str = ""
    time: str = ""
    cashier_name: str = ""
    terms_and_conditions: str = ""
    return_policy: str = ""
    footer_text: str = "Thank you for shopping!"
    qr_code_data: str = ""


# ESC/POS Command Constants
class ESC_POS:
    """ESC/POS printer command codes"""
    # Initialize
    INIT = b'\x1b\x40'
    
    # Text formatting
    BOLD_ON = b'\x1b\x45\x01'
    BOLD_OFF = b'\x1b\x45\x00'
    UNDERLINE_ON = b'\x1b\x2d\x01'
    UNDERLINE_OFF = b'\x1b\x2d\x00'
    DOUBLE_HEIGHT_ON = b'\x1b\x21\x10'
    DOUBLE_WIDTH_ON = b'\x1b\x21\x20'
    DOUBLE_SIZE_ON = b'\x1b\x21\x30'
    NORMAL_SIZE = b'\x1b\x21\x00'
    
    # Alignment
    ALIGN_LEFT = b'\x1b\x61\x00'
    ALIGN_CENTER = b'\x1b\x61\x01'
    ALIGN_RIGHT = b'\x1b\x61\x02'
    
    # Paper handling
    CUT_PAPER = b'\x1d\x56\x00'
    PARTIAL_CUT = b'\x1d\x56\x01'
    FEED_LINES = lambda n: b'\x1b\x64' + bytes([n])
    
    # Cash drawer
    OPEN_DRAWER = b'\x1b\x70\x00\x19\xfa'
    
    # Line spacing
    DEFAULT_LINE_SPACING = b'\x1b\x32'
    SET_LINE_SPACING = lambda n: b'\x1b\x33' + bytes([n])
    
    # Character set
    CHARSET_USA = b'\x1b\x52\x00'
    
    # Barcode
    BARCODE_HEIGHT = lambda h: b'\x1d\x68' + bytes([h])
    BARCODE_WIDTH = lambda w: b'\x1d\x77' + bytes([w])
    BARCODE_TEXT_BELOW = b'\x1d\x48\x02'
    BARCODE_CODE128 = b'\x1d\x6b\x49'
    
    # QR Code
    QR_MODEL = b'\x1d\x28\x6b\x04\x00\x31\x41\x32\x00'
    QR_SIZE = lambda s: b'\x1d\x28\x6b\x03\x00\x31\x43' + bytes([s])
    QR_ERROR_CORRECTION = b'\x1d\x28\x6b\x03\x00\x31\x45\x31'
    QR_STORE_DATA = lambda data: b'\x1d\x28\x6b' + bytes([len(data) + 3, 0]) + b'\x31\x50\x30' + data.encode()
    QR_PRINT = b'\x1d\x28\x6b\x03\x00\x31\x51\x30'


class ThermalPrinter:
    """
    High-performance thermal printer driver with ESC/POS support.
    """
    
    def __init__(self, config: PrinterConfig):
        self.config = config
        self.buffer = bytearray()
        self.line_width = 48 if config.paper_size == PaperSize.THERMAL_80MM else 32
    
    def _add(self, data: Union[bytes, str]):
        """Add data to print buffer"""
        if isinstance(data, str):
            self.buffer.extend(data.encode(self.config.encoding, errors='replace'))
        else:
            self.buffer.extend(data)
    
    def initialize(self):
        """Initialize printer"""
        self._add(ESC_POS.INIT)
        self._add(ESC_POS.CHARSET_USA)
        self._add(ESC_POS.DEFAULT_LINE_SPACING)
        return self
    
    def align_center(self):
        self._add(ESC_POS.ALIGN_CENTER)
        return self
    
    def align_left(self):
        self._add(ESC_POS.ALIGN_LEFT)
        return self
    
    def align_right(self):
        self._add(ESC_POS.ALIGN_RIGHT)
        return self
    
    def bold(self, on: bool = True):
        self._add(ESC_POS.BOLD_ON if on else ESC_POS.BOLD_OFF)
        return self
    
    def double_size(self, on: bool = True):
        self._add(ESC_POS.DOUBLE_SIZE_ON if on else ESC_POS.NORMAL_SIZE)
        return self
    
    def underline(self, on: bool = True):
        self._add(ESC_POS.UNDERLINE_ON if on else ESC_POS.UNDERLINE_OFF)
        return self
    
    def text(self, content: str):
        """Print text"""
        self._add(content)
        return self
    
    def line(self, content: str = ""):
        """Print line with newline"""
        self._add(content + "\n")
        return self
    
    def newline(self, count: int = 1):
        """Print empty lines"""
        self._add("\n" * count)
        return self
    
    def feed(self, lines: int = 3):
        """Feed paper"""
        self._add(ESC_POS.FEED_LINES(lines))
        return self
    
    def separator(self, char: str = "-"):
        """Print separator line"""
        self._add(char * self.line_width + "\n")
        return self
    
    def dotted_line(self):
        """Print dotted separator"""
        self.separator(".")
        return self
    
    def dashed_line(self):
        """Print dashed separator"""
        self.separator("-")
        return self
    
    def two_column(self, left: str, right: str, fill: str = " "):
        """Print two-column layout"""
        total_len = self.line_width
        left_len = len(left)
        right_len = len(right)
        fill_len = total_len - left_len - right_len
        
        if fill_len < 1:
            # Truncate if too long
            left = left[:total_len - right_len - 1]
            fill_len = 1
        
        self._add(left + fill * fill_len + right + "\n")
        return self
    
    def three_column(self, left: str, center: str, right: str):
        """Print three-column layout"""
        col_width = self.line_width // 3
        formatted = f"{left:<{col_width}}{center:^{col_width}}{right:>{col_width}}"
        self._add(formatted[:self.line_width] + "\n")
        return self
    
    def print_qr(self, data: str, size: int = 6):
        """Print QR code"""
        self._add(ESC_POS.QR_MODEL)
        self._add(ESC_POS.QR_SIZE(size))
        self._add(ESC_POS.QR_ERROR_CORRECTION)
        self._add(ESC_POS.QR_STORE_DATA(data))
        self._add(ESC_POS.QR_PRINT)
        return self
    
    def print_barcode(self, data: str, height: int = 50):
        """Print barcode"""
        self._add(ESC_POS.BARCODE_HEIGHT(height))
        self._add(ESC_POS.BARCODE_WIDTH(2))
        self._add(ESC_POS.BARCODE_TEXT_BELOW)
        self._add(ESC_POS.BARCODE_CODE128)
        self._add(bytes([len(data)]))
        self._add(data)
        return self
    
    def cut(self, partial: bool = False):
        """Cut paper"""
        self._add(ESC_POS.PARTIAL_CUT if partial else ESC_POS.CUT_PAPER)
        return self
    
    def open_drawer(self):
        """Open cash drawer"""
        self._add(ESC_POS.OPEN_DRAWER)
        return self
    
    def get_buffer(self) -> bytes:
        """Get print buffer"""
        return bytes(self.buffer)
    
    def clear(self):
        """Clear print buffer"""
        self.buffer = bytearray()
        return self
    
    async def send_to_printer(self) -> Dict[str, Any]:
        """Send buffer to network printer"""
        try:
            if self.config.printer_type == PrinterType.THERMAL_NETWORK:
                return await self._send_network()
            else:
                return {"success": False, "error": "Unsupported printer type"}
        except Exception as e:
            logger.error(f"Print error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _send_network(self) -> Dict[str, Any]:
        """Send to network printer"""
        try:
            loop = asyncio.get_event_loop()
            
            def send_sync():
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(self.config.timeout)
                sock.connect((self.config.ip_address, self.config.port))
                sock.sendall(self.get_buffer())
                sock.close()
            
            await loop.run_in_executor(None, send_sync)
            return {"success": True, "message": "Print job sent successfully"}
            
        except socket.timeout:
            return {"success": False, "error": "Printer connection timeout"}
        except ConnectionRefusedError:
            return {"success": False, "error": "Printer connection refused"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ReceiptPrinter:
    """
    High-level receipt printing with template support.
    """
    
    def __init__(self, config: PrinterConfig):
        self.config = config
        self.printer = ThermalPrinter(config)
    
    def format_receipt(self, data: ReceiptData) -> ThermalPrinter:
        """Format a complete receipt"""
        p = self.printer.initialize()
        
        # Header
        p.align_center()
        p.double_size().bold().line(data.store_name).bold(False).double_size(False)
        
        if data.store_address:
            p.line(data.store_address)
        if data.store_phone:
            p.line(f"Tel: {data.store_phone}")
        if data.store_gstin:
            p.line(f"GSTIN: {data.store_gstin}")
        
        p.dashed_line()
        
        # Invoice info
        p.align_left()
        p.bold().line("TAX INVOICE").bold(False)
        p.two_column("Invoice:", data.invoice_number)
        p.two_column("Date:", data.date or datetime.now().strftime("%d/%m/%Y"))
        p.two_column("Time:", data.time or datetime.now().strftime("%H:%M"))
        
        if data.customer_name != "Walk-in Customer":
            p.two_column("Customer:", data.customer_name)
        if data.customer_phone:
            p.two_column("Phone:", data.customer_phone)
        
        p.dashed_line()
        
        # Items header
        p.bold()
        p.three_column("Item", "Qty", "Amount")
        p.bold(False)
        p.dashed_line()
        
        # Items
        for item in data.items:
            name = item.get("item_name", item.get("name", "Item"))[:20]
            qty = str(item.get("quantity", 1))
            amount = f"{data.currency_symbol}{item.get('rate', 0) * item.get('quantity', 1):.2f}"
            p.three_column(name, qty, amount)
            
            # Show unit price if different from total
            if item.get("quantity", 1) > 1:
                p.line(f"  @ {data.currency_symbol}{item.get('rate', 0):.2f} each")
        
        p.dashed_line()
        
        # Totals
        p.two_column("Subtotal:", f"{data.currency_symbol}{data.subtotal:.2f}")
        
        if data.discount_amount > 0:
            p.two_column("Discount:", f"-{data.currency_symbol}{data.discount_amount:.2f}")
        
        if data.voucher_discount > 0:
            p.two_column("Voucher:", f"-{data.currency_symbol}{data.voucher_discount:.2f}")
        
        if data.loyalty_points_value > 0:
            p.two_column("Loyalty:", f"-{data.currency_symbol}{data.loyalty_points_value:.2f}")
        
        if data.tax_amount > 0:
            p.two_column("Tax:", f"+{data.currency_symbol}{data.tax_amount:.2f}")
        
        p.dashed_line()
        p.bold().double_size()
        p.two_column("TOTAL:", f"{data.currency_symbol}{data.total_amount:.2f}")
        p.double_size(False).bold(False)
        p.dashed_line()
        
        # Payment
        p.two_column("Payment:", data.payment_mode)
        if data.amount_paid > 0:
            p.two_column("Paid:", f"{data.currency_symbol}{data.amount_paid:.2f}")
        if data.change_amount > 0:
            p.two_column("Change:", f"{data.currency_symbol}{data.change_amount:.2f}")
        
        # QR Code (if data provided)
        if data.qr_code_data:
            p.newline()
            p.align_center()
            p.print_qr(data.qr_code_data, size=5)
        
        # Terms & Footer
        if data.terms_and_conditions or data.return_policy:
            p.newline()
            p.dashed_line()
            if data.terms_and_conditions:
                p.line("Terms: " + data.terms_and_conditions[:50])
            if data.return_policy:
                p.line("Returns: " + data.return_policy[:50])
        
        # Footer
        p.newline()
        p.align_center()
        p.line(data.footer_text)
        if data.cashier_name:
            p.line(f"Served by: {data.cashier_name}")
        
        # Feed and cut
        p.feed(4)
        if self.config.cut_paper:
            p.cut()
        if self.config.open_drawer:
            p.open_drawer()
        
        return p
    
    async def print_receipt(self, data: ReceiptData) -> Dict[str, Any]:
        """Print a complete receipt"""
        self.format_receipt(data)
        result = await self.printer.send_to_printer()
        self.printer.clear()
        return result


class BarcodeGenerator:
    """
    Optimized barcode generator with multiple format support.
    """
    
    SUPPORTED_FORMATS = [
        'code128', 'code39', 'ean13', 'ean8', 'upca', 'isbn13', 'isbn10', 'itf', 'pzn'
    ]
    
    @staticmethod
    def generate_barcode(
        data: str,
        format: str = "code128",
        width: int = 200,
        height: int = 50,
        include_text: bool = True
    ) -> Optional[str]:
        """
        Generate barcode as base64 PNG.
        
        Returns base64 encoded PNG string.
        """
        try:
            format_lower = format.lower()
            if format_lower not in BarcodeGenerator.SUPPORTED_FORMATS:
                format_lower = 'code128'
            
            # Get barcode class
            barcode_class = barcode.get_barcode_class(format_lower)
            
            # Create barcode with ImageWriter
            writer = ImageWriter()
            bc = barcode_class(data, writer=writer)
            
            # Generate to bytes buffer
            buffer = io.BytesIO()
            bc.write(buffer, options={
                'module_width': 0.3,
                'module_height': height / 10,
                'text_distance': 3,
                'font_size': 10,
                'write_text': include_text,
                'quiet_zone': 2
            })
            
            # Get image and resize if needed
            buffer.seek(0)
            img = Image.open(buffer)
            
            if img.width != width:
                ratio = width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((width, new_height), Image.Resampling.LANCZOS)
            
            # Convert to base64
            output = io.BytesIO()
            img.save(output, format='PNG', optimize=True)
            output.seek(0)
            
            return base64.b64encode(output.read()).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Barcode generation error: {e}")
            return None
    
    @staticmethod
    def generate_qr(
        data: str,
        size: int = 200,
        error_correction: str = "M"
    ) -> Optional[str]:
        """
        Generate QR code as base64 PNG.
        """
        try:
            error_levels = {
                'L': qrcode.constants.ERROR_CORRECT_L,
                'M': qrcode.constants.ERROR_CORRECT_M,
                'Q': qrcode.constants.ERROR_CORRECT_Q,
                'H': qrcode.constants.ERROR_CORRECT_H
            }
            
            qr = qrcode.QRCode(
                version=None,  # Auto-size
                error_correction=error_levels.get(error_correction, qrcode.constants.ERROR_CORRECT_M),
                box_size=10,
                border=2
            )
            qr.add_data(data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            img = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG', optimize=True)
            buffer.seek(0)
            
            return base64.b64encode(buffer.read()).decode('utf-8')
            
        except Exception as e:
            logger.error(f"QR code generation error: {e}")
            return None
    
    @staticmethod
    def generate_batch(
        items: List[Dict],
        format: str = "code128"
    ) -> List[Dict]:
        """
        Generate barcodes for multiple items efficiently.
        
        Args:
            items: List of {sku: str, name: str, price: float}
        
        Returns:
            List of {sku, name, price, barcode_base64}
        """
        results = []
        
        for item in items:
            sku = item.get('sku', item.get('variant_id', ''))
            if not sku:
                continue
            
            barcode_data = BarcodeGenerator.generate_barcode(sku, format)
            
            results.append({
                **item,
                'barcode_base64': barcode_data
            })
        
        return results


# Singleton instances
_receipt_printer: Optional[ReceiptPrinter] = None
_barcode_generator = BarcodeGenerator()


def get_receipt_printer(config: PrinterConfig = None) -> ReceiptPrinter:
    """Get or create receipt printer instance"""
    global _receipt_printer
    if _receipt_printer is None or config is not None:
        _receipt_printer = ReceiptPrinter(config or PrinterConfig())
    return _receipt_printer


def get_barcode_generator() -> BarcodeGenerator:
    """Get barcode generator instance"""
    return _barcode_generator
