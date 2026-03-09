import React, { useState, useEffect, useCallback } from 'react';
import { 
  Printer, Wifi, Usb, Settings, Check, X, RefreshCw, 
  AlertCircle, Zap, TestTube, Cable
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { useCurrency } from '../contexts/CurrencyContext';

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: `${ESC}@`, // Initialize printer
  CUT: `${GS}V\x41\x03`, // Full cut with feed
  PARTIAL_CUT: `${GS}V\x42\x03`, // Partial cut
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  DOUBLE_SIZE: `${ESC}!\x30`,
  NORMAL_SIZE: `${ESC}!\x00`,
  FEED_LINE: '\n',
  FEED_LINES: (n) => `${ESC}d${String.fromCharCode(n)}`,
  BEEP: `${ESC}B\x03\x02`, // Beep 3 times
  CASH_DRAWER: `${ESC}p\x00\x19\xFA`, // Open cash drawer
};

// Printer Configuration
const DEFAULT_CONFIG = {
  type: 'usb', // 'usb', 'network', 'bluetooth'
  ip: '',
  port: 9100,
  characterWidth: 48, // Characters per line (48 for 80mm, 32 for 58mm)
  encoding: 'utf8',
  autoCut: true,
  openDrawer: false,
  beepOnPrint: true
};

export default function ThermalPrinter({ 
  isOpen, 
  onClose, 
  receiptData = null,
  onPrintSuccess = () => {} 
}) {
  const { currencySymbol } = useCurrency();
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('thermalPrinterConfig');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [printerStatus, setPrinterStatus] = useState('disconnected');
  const [item, setItem] = useState(false); // connected, disconnected, printing

  // Avoid first-render flash:
  // - `null` means "definitely no device connected" (after we've initialized).
  // - `undefined` means "not yet initialized" so UI can avoid rendering branches like `if (!usbDevice)` prematurely.
  // `printerStatus` remains the single source of truth for UI state.
  const [usbDevice, setUsbDevice] = useState(undefined);
  const [isUsbDeviceReady, setIsUsbDeviceReady] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);

  // Mark USB device state as initialized after first mount.
  // If no device was connected, we settle to `null` to keep existing checks working.
  useEffect(() => {
    setIsUsbDeviceReady(true);
    setUsbDevice(prev => (prev === undefined ? null : prev));
  }, []);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem('thermalPrinterConfig', JSON.stringify(config));
  }, [config]);

  // Connect to USB Printer
  const connectUSB = useCallback(async () => {
    if (!navigator.usb) {
      toast.error('WebUSB not supported in this browser');
      return false;
    }

    try {
      const device = await navigator.usb.requestDevice({
        filters: [
          { classCode: 7 }, // Printer class
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
          { vendorId: 0x0416 }, // Winbond (many thermal printers)
        ]
      });

      await device.open();
      
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      
      await device.claimInterface(0);
      
      setUsbDevice(device);
      setPrinterStatus('connected');
      toast.success('USB Printer connected!');
      return true;
    } catch (err) {
      console.error('USB connection failed:', err);
      if (err.name !== 'NotFoundError') {
        toast.error('Failed to connect to USB printer');
      }
      return false;
    }
  }, []);

  // Send data to USB Printer
  const sendToUSB = useCallback(async (data) => {
    if (!usbDevice) {
      throw new Error('USB printer not connected');
    }

    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    
    await usbDevice.transferOut(1, encoded);
  }, [usbDevice]);

  // Send data to Network Printer
  const sendToNetwork = useCallback(async (data) => {
    if (!config.ip) {
      throw new Error('Printer IP address not configured');
    }

    // Use backend proxy for network printing
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/printer/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        ip: config.ip,
        port: config.port,
        data: data
      })
    });

    if (!response.ok) {
      throw new Error('Network print failed');
    }

    return true;
  }, [config.ip, config.port]);

  // Generate ESC/POS receipt data
  const generateReceiptData = useCallback((receipt) => {
    if (!receipt) return '';
    
    const width = config.characterWidth;
    const line = '-'.repeat(width);
    const doubleLine = '='.repeat(width);
    
    const padText = (left, right) => {
      const space = width - left.length - right.length;
      return left + ' '.repeat(Math.max(1, space)) + right;
    };

    const centerText = (text) => {
      const padding = Math.floor((width - text.length) / 2);
      return ' '.repeat(Math.max(0, padding)) + text;
    };

    let data = COMMANDS.INIT;
    
    // Header
    data += COMMANDS.ALIGN_CENTER;
    data += COMMANDS.DOUBLE_SIZE;
    data += (receipt.storeName || 'BIJNISBOOKS') + '\n';
    data += COMMANDS.NORMAL_SIZE;
    data += (receipt.storeAddress || '') + '\n';
    data += (receipt.storePhone ? `Tel: ${receipt.storePhone}` : '') + '\n';
    data += COMMANDS.FEED_LINE;
    
    // Invoice details
    data += COMMANDS.ALIGN_LEFT;
    data += doubleLine + '\n';
    data += COMMANDS.BOLD_ON;
    data += centerText('TAX INVOICE') + '\n';
    data += COMMANDS.BOLD_OFF;
    data += doubleLine + '\n';
    data += `Invoice: ${receipt.invoiceNumber || 'N/A'}\n`;
    data += `Date: ${receipt.date || new Date().toLocaleString()}\n`;
    if (receipt.customerName) {
      data += `Customer: ${receipt.customerName}\n`;
    }
    if (receipt.customerPhone) {
      data += `Phone: ${receipt.customerPhone}\n`;
    }
    data += line + '\n';
    
    // Items header
    data += COMMANDS.BOLD_ON;
    data += padText('Item', 'Amount') + '\n';
    data += COMMANDS.BOLD_OFF;
    data += line + '\n';
    
    // Items
    if (receipt.items && receipt.items.length > 0) {
      receipt.items.forEach(item => {
        const name = item.name.substring(0, width - 15);
        const qty = `${item.quantity} x ${currencySymbol}${item.price}`;
        const total = `${currencySymbol}${(item.quantity * item.price).toLocaleString()}`;
        
        data += name + '\n';
        data += padText(`  ${qty}`, total) + '\n';
      });
    }
    
    data += line + '\n';
    
    // Totals
    data += padText('Subtotal:', `${currencySymbol}${(receipt.subtotal || 0).toLocaleString()}`) + '\n';
    
    if (receipt.discount > 0) {
      data += padText('Discount:', `-${currencySymbol}${receipt.discount.toLocaleString()}`) + '\n';
    }
    
    if (receipt.gstAmount > 0) {
      const gstRate = receipt.gstRate || 5;
      const cgst = receipt.gstAmount / 2;
      const sgst = receipt.gstAmount / 2;
      data += padText(`CGST (${gstRate/2}%):`, `${currencySymbol}${cgst.toFixed(2)}`) + '\n';
      data += padText(`SGST (${gstRate/2}%):`, `${currencySymbol}${sgst.toFixed(2)}`) + '\n';
    }
    
    data += doubleLine + '\n';
    data += COMMANDS.BOLD_ON;
    data += COMMANDS.DOUBLE_HEIGHT;
    data += padText('TOTAL:', `${currencySymbol}${(receipt.total || 0).toLocaleString()}`) + '\n';
    data += COMMANDS.NORMAL_SIZE;
    data += COMMANDS.BOLD_OFF;
    data += doubleLine + '\n';
    
    // Payment method
    data += padText('Payment:', receipt.paymentMethod || 'Cash') + '\n';
    
    if (receipt.amountPaid) {
      data += padText('Paid:', `${currencySymbol}${receipt.amountPaid.toLocaleString()}`) + '\n';
    }
    if (receipt.change > 0) {
      data += padText('Change:', `${currencySymbol}${receipt.change.toLocaleString()}`) + '\n';
    }
    
    data += COMMANDS.FEED_LINE;
    
    // Footer
    data += COMMANDS.ALIGN_CENTER;
    data += line + '\n';
    data += 'Thank you for shopping with us!\n';
    data += receipt.footerText || 'Visit again soon.\n';
    
    if (receipt.gstNumber) {
      data += `GSTIN: ${receipt.gstNumber}\n`;
    }
    
    data += COMMANDS.FEED_LINE;
    data += COMMANDS.FEED_LINE;
    
    // Beep and cut
    if (config.beepOnPrint) {
      data += COMMANDS.BEEP;
    }
    
    if (config.openDrawer) {
      data += COMMANDS.CASH_DRAWER;
    }
    
    if (config.autoCut) {
      data += COMMANDS.CUT;
    }
    
    return data;
  }, [config]);

  // Print receipt
  const printReceipt = useCallback(async (receipt = receiptData) => {
    if (!receipt) {
      toast.error('No receipt data to print');
      return;
    }

    setPrinterStatus('printing');
    
    try {
      const data = generateReceiptData(receipt);
      
      if (config.type === 'usb') {
        if (!usbDevice) {
          const connected = await connectUSB();
          if (!connected) return;
        }
        await sendToUSB(data);
      } else if (config.type === 'network') {
        await sendToNetwork(data);
      }
      
      setPrinterStatus('connected');
      toast.success('Receipt printed successfully!');
      onPrintSuccess();
    } catch (err) {
      console.error('Print failed:', err);
      setPrinterStatus('disconnected');
      toast.error(`Print failed: ${err.message}`);
    }
  }, [receiptData, config.type, usbDevice, generateReceiptData, connectUSB, sendToUSB, sendToNetwork, onPrintSuccess]);

  // Test print
  const testPrint = async () => {
    setTestPrinting(true);
    const testReceipt = {
      storeName: 'BIJNISBOOKS',
      storeAddress: 'Test Store Address',
      storePhone: '1234567890',
      invoiceNumber: 'TEST-001',
      date: new Date().toLocaleString(),
      items: [
        { name: 'Test Item 1', quantity: 2, price: 100 },
        { name: 'Test Item 2', quantity: 1, price: 250 }
      ],
      subtotal: 450,
      discount: 0,
      gstAmount: 45,
      total: 495,
      paymentMethod: 'Cash',
      amountPaid: 500,
      change: 5,
      footerText: 'This is a test print'
    };
    
    await printReceipt(testReceipt);
    setTestPrinting(false);
  };

  // Open cash drawer
  const openCashDrawer = async () => {
    try {
      if (config.type === 'usb' && usbDevice) {
        await sendToUSB(COMMANDS.CASH_DRAWER);
        toast.success('Cash drawer opened');
      } else if (config.type === 'network') {
        await sendToNetwork(COMMANDS.CASH_DRAWER);
        toast.success('Cash drawer opened');
      } else {
        toast.error('Connect to printer first');
      }
    } catch (err) {
      toast.error('Failed to open cash drawer');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Thermal Printer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status */}
            <div className={`p-4 rounded-lg border ${
              printerStatus === 'connected' 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : printerStatus === 'printing'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    printerStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                    printerStatus === 'printing' ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-400'
                  }`} />
                  <span className="font-medium capitalize">{printerStatus}</span>
                </div>
                <span className="text-sm text-muted-foreground capitalize">
                  {config.type} Printer
                </span>
              </div>
              {config.type === 'network' && config.ip && (
                <p className="text-sm text-muted-foreground mt-2">
                  {config.ip}:{config.port}
                </p>
              )}
            </div>

            {/* Connection Type */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setConfig(c => ({ ...c, type: 'usb' }))}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                  config.type === 'usb' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Usb className="w-5 h-5" />
                <span className="text-xs">USB</span>
              </button>
              <button
                onClick={() => setConfig(c => ({ ...c, type: 'network' }))}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                  config.type === 'network' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Wifi className="w-5 h-5" />
                <span className="text-xs">Network</span>
              </button>
              <button
                onClick={() => setConfig(c => ({ ...c, type: 'bluetooth' }))}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                  config.type === 'bluetooth' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Cable className="w-5 h-5" />
                <span className="text-xs">Bluetooth</span>
              </button>
            </div>

            {/* Network Settings */}
            {config.type === 'network' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Printer IP Address</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.ip}
                    onChange={(e) => setConfig(c => ({ ...c, ip: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background"
                  />
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => setConfig(c => ({ ...c, port: parseInt(e.target.value) || 9100 }))}
                    placeholder="9100"
                    className="w-20 px-3 py-2 rounded-md border border-border bg-background"
                  />
                </div>
              </div>
            )}

            {/* Paper Width */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Paper Width</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfig(c => ({ ...c, characterWidth: 32 }))}
                  className={`flex-1 py-2 rounded-md border-2 ${
                    config.characterWidth === 32 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border'
                  }`}
                >
                  58mm
                </button>
                <button
                  onClick={() => setConfig(c => ({ ...c, characterWidth: 48 }))}
                  className={`flex-1 py-2 rounded-md border-2 ${
                    config.characterWidth === 48 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border'
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoCut}
                  onChange={(e) => setConfig(c => ({ ...c, autoCut: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Auto-cut paper after print</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.openDrawer}
                  onChange={(e) => setConfig(c => ({ ...c, openDrawer: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Open cash drawer after print</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.beepOnPrint}
                  onChange={(e) => setConfig(c => ({ ...c, beepOnPrint: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Beep on successful print</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {config.type === 'usb' && (
                <Button 
                  variant="outline" 
                  onClick={connectUSB}
                  disabled={printerStatus === 'connected'}
                  className="flex-1"
                >
                  <Usb className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={testPrint}
                disabled={testPrinting || (config.type === 'usb' && !usbDevice && printerStatus !== 'connected')}
                className="flex-1"
              >
                {testPrinting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                Test Print
              </Button>
            </div>

            {receiptData && (
              <Button 
                onClick={() => printReceipt()}
                disabled={printerStatus === 'printing'}
                className="w-full"
              >
                {printerStatus === 'printing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Receipt
                  </>
                )}
              </Button>
            )}

            <Button variant="ghost" onClick={openCashDrawer} className="w-full">
              <Zap className="w-4 h-4 mr-2" />
              Open Cash Drawer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export utility function for direct printing
export const printThermalReceipt = async (receiptData) => {
  const config = JSON.parse(localStorage.getItem('thermalPrinterConfig') || '{}');
  
  if (!config.type) {
    toast.error('Please configure thermal printer first');
    return false;
  }

  // This would need WebUSB or network connection
  // For now, show a toast
  toast.info('Opening print dialog...', {
    description: 'Configure printer in Settings'
  });
  
  return true;
};
