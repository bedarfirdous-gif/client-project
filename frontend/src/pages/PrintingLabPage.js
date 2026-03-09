import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Printer, 
  QrCode, 
  Barcode, 
  Settings, 
  Check, 
  X, 
  RefreshCw,
  Download,
  Copy,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../App';

// Barcode formats
const BARCODE_FORMATS = [
  { value: 'code128', label: 'Code 128 (Default)' },
  { value: 'code39', label: 'Code 39' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'ean8', label: 'EAN-8' },
  { value: 'upca', label: 'UPC-A' },
  { value: 'itf', label: 'ITF' }
];

// Label sizes
const LABEL_SIZES = [
  { value: '38x25', label: '38mm x 25mm' },
  { value: '50x25', label: '50mm x 25mm' },
  { value: '50x30', label: '50mm x 30mm' },
  { value: '60x40', label: '60mm x 40mm' }
];

export default function PrintingLabPage() {
  const { api } = useAuth();
  
  // Printer settings
  const [printerIp, setPrinterIp] = useState('');
  const [printerPort, setPrinterPort] = useState(9100);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Barcode settings
  const [barcodeData, setBarcodeData] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState('code128');
  const [barcodeWidth, setBarcodeWidth] = useState(200);
  const [barcodeHeight, setBarcodeHeight] = useState(50);
  const [includeText, setIncludeText] = useState(true);
  const [generatedBarcode, setGeneratedBarcode] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // QR settings
  const [qrData, setQrData] = useState('');
  const [qrSize, setQrSize] = useState(200);
  const [errorCorrection, setErrorCorrection] = useState('M');
  const [generatedQR, setGeneratedQR] = useState('');
  
  // Batch generation
  const [batchItems, setBatchItems] = useState('');
  const [batchResults, setBatchResults] = useState([]);
  const [batchGenerating, setBatchGenerating] = useState(false);
  
  // Receipt preview
  const receiptRef = useRef(null);

  // Test printer connection
  const testPrinterConnection = async () => {
    if (!printerIp) {
      toast.error('Please enter printer IP address');
      return;
    }
    
    setTesting(true);
    try {
      const result = await api(`/api/printer/test-connection?ip=${printerIp}&port=${printerPort}`);
      if (result.success) {
        setPrinterConnected(true);
        toast.success('Printer connected successfully');
      } else {
        setPrinterConnected(false);
        toast.error(result.message || 'Failed to connect to printer');
      }
    } catch (error) {
      setPrinterConnected(false);
      toast.error('Failed to connect: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  // Generate barcode
  const generateBarcode = async () => {
    if (!barcodeData.trim()) {
      toast.error('Please enter barcode data');
      return;
    }
    
    setGenerating(true);
    try {
      const result = await api('/api/barcode/generate', {
        method: 'POST',
        body: JSON.stringify({
          data: barcodeData,
          format: barcodeFormat,
          width: barcodeWidth,
          height: barcodeHeight,
          include_text: includeText
        })
      });
      
      if (result.success) {
        setGeneratedBarcode(result.barcode);
        toast.success('Barcode generated successfully');
      } else {
        toast.error('Failed to generate barcode');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // Generate QR code
  const generateQRCode = async () => {
    if (!qrData.trim()) {
      toast.error('Please enter QR data');
      return;
    }
    
    setGenerating(true);
    try {
      const result = await api('/api/barcode/qr', {
        method: 'POST',
        body: JSON.stringify({
          data: qrData,
          size: qrSize,
          error_correction: errorCorrection
        })
      });
      
      if (result.success) {
        setGeneratedQR(result.qr_code);
        toast.success('QR code generated successfully');
      } else {
        toast.error('Failed to generate QR code');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // Generate batch barcodes
  const generateBatch = async () => {
    if (!batchItems.trim()) {
      toast.error('Please enter SKUs (one per line)');
      return;
    }
    
    const items = batchItems.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(sku => ({ sku }));
    
    if (items.length === 0) {
      toast.error('No valid SKUs found');
      return;
    }
    
    setBatchGenerating(true);
    try {
      const result = await api('/api/barcode/batch', {
        method: 'POST',
        body: JSON.stringify({
          items,
          format: barcodeFormat
        })
      });
      
      if (result.success) {
        setBatchResults(result.items);
        toast.success(`Generated ${result.count} barcodes`);
      } else {
        toast.error('Failed to generate barcodes');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setBatchGenerating(false);
    }
  };

  // Download barcode
  const downloadBarcode = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename || 'barcode.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy barcode to clipboard
  const copyToClipboard = async (dataUrl) => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  // Print barcode labels
  const printLabels = () => {
    const printWindow = window.open('', '_blank');
    const labels = batchResults.length > 0 ? batchResults : 
      (generatedBarcode ? [{ sku: barcodeData, barcode_base64: generatedBarcode.replace('data:image/png;base64,', '') }] : []);
    
    if (labels.length === 0) {
      toast.error('No barcodes to print');
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }
            .label-grid { display: flex; flex-wrap: wrap; gap: 5px; }
            .label { 
              border: 1px solid #ddd; 
              padding: 5px; 
              text-align: center;
              page-break-inside: avoid;
            }
            .label img { max-width: 100%; height: auto; }
            .label .sku { font-size: 10px; margin-top: 2px; }
            @media print {
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="label-grid">
            ${labels.map(item => `
              <div class="label">
                <img loading="lazy" src="data:image/png;base64,${item.barcode_base64}" alt="${item.sku}" />
                <div class="sku">${item.sku}</div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="p-6 space-y-6" data-testid="printing-lab-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Printing Lab</h1>
          <p className="text-muted-foreground">Receipt printing, barcode & QR code generation</p>
        </div>
        <Badge variant={printerConnected ? 'default' : 'secondary'} className="flex items-center gap-2">
          {printerConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {printerConnected ? 'Printer Connected' : 'No Printer'}
        </Badge>
      </div>

      <Tabs defaultValue="barcode" className="space-y-4">
        <TabsList>
          <TabsTrigger value="barcode" className="flex items-center gap-2">
            <Barcode className="w-4 h-4" />
            Barcode
          </TabsTrigger>
          <TabsTrigger value="qr" className="flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            QR Code
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Batch Labels
          </TabsTrigger>
          <TabsTrigger value="printer" className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Printer Setup
          </TabsTrigger>
        </TabsList>

        {/* Barcode Generation */}
        <TabsContent value="barcode" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Barcode</CardTitle>
                <CardDescription>Create barcodes for products, inventory items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Barcode Data (SKU/Code)</Label>
                  <Input 
                    placeholder="Enter SKU or code..."
                    value={barcodeData}
                    onChange={(e) => setBarcodeData(e.target.value)}
                    data-testid="barcode-data-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={barcodeFormat} onValueChange={setBarcodeFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BARCODE_FORMATS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Width (px)</Label>
                    <Input 
                      type="number"
                      value={barcodeWidth}
                      onChange={(e) => setBarcodeWidth(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (px)</Label>
                    <Input 
                      type="number"
                      value={barcodeHeight}
                      onChange={(e) => setBarcodeHeight(parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Include Text</Label>
                  <Switch checked={includeText} onCheckedChange={setIncludeText} />
                </div>
                
                <Button 
                  onClick={generateBarcode} 
                  disabled={generating || !barcodeData}
                  className="w-full"
                  data-testid="generate-barcode-btn"
                >
                  {generating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Barcode className="w-4 h-4 mr-2" />}
                  Generate Barcode
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                {generatedBarcode ? (
                  <div className="space-y-4">
                    <img loading="lazy" 
                      src={generatedBarcode} 
                      alt="Generated Barcode" 
                      className="max-w-full border rounded-lg"
                      data-testid="barcode-preview"
                    />
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={() => downloadBarcode(generatedBarcode, `${barcodeData}.png`)}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedBarcode)}>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={printLabels}>
                        <Printer className="w-4 h-4 mr-1" />
                        Print
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Barcode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>Enter barcode data and click generate</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* QR Code Generation */}
        <TabsContent value="qr" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate QR Code</CardTitle>
                <CardDescription>Create QR codes for URLs, payment links, product info</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>QR Data (URL/Text)</Label>
                  <Textarea 
                    placeholder="Enter URL, text, or data..."
                    value={qrData}
                    onChange={(e) => setQrData(e.target.value)}
                    rows={3}
                    data-testid="qr-data-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Size (px)</Label>
                  <Input 
                    type="number"
                    value={qrSize}
                    onChange={(e) => setQrSize(parseInt(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Error Correction</Label>
                  <Select value={errorCorrection} onValueChange={setErrorCorrection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Low (7%)</SelectItem>
                      <SelectItem value="M">Medium (15%)</SelectItem>
                      <SelectItem value="Q">Quartile (25%)</SelectItem>
                      <SelectItem value="H">High (30%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={generateQRCode} 
                  disabled={generating || !qrData}
                  className="w-full"
                  data-testid="generate-qr-btn"
                >
                  {generating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  Generate QR Code
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                {generatedQR ? (
                  <div className="space-y-4">
                    <img loading="lazy" 
                      src={generatedQR} 
                      alt="Generated QR Code" 
                      className="max-w-full border rounded-lg"
                      data-testid="qr-preview"
                    />
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={() => downloadBarcode(generatedQR, 'qrcode.png')}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedQR)}>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>Enter data and click generate</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Batch Label Generation */}
        <TabsContent value="batch" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Label Generation</CardTitle>
                <CardDescription>Generate multiple barcodes at once</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SKUs (one per line)</Label>
                  <Textarea 
                    placeholder="SKU001&#10;SKU002&#10;SKU003..."
                    value={batchItems}
                    onChange={(e) => setBatchItems(e.target.value)}
                    rows={8}
                    data-testid="batch-skus-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Barcode Format</Label>
                  <Select value={barcodeFormat} onValueChange={setBarcodeFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BARCODE_FORMATS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={generateBatch} 
                  disabled={batchGenerating || !batchItems.trim()}
                  className="w-full"
                  data-testid="generate-batch-btn"
                >
                  {batchGenerating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                  Generate Batch
                </Button>
                
                {batchResults.length > 0 && (
                  <Button onClick={printLabels} variant="outline" className="w-full">
                    <Printer className="w-4 h-4 mr-2" />
                    Print All Labels ({batchResults.length})
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated Labels</CardTitle>
                <CardDescription>{batchResults.length} labels</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {batchResults.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {batchResults.map((item, idx) => (
                        <div key={idx} className="border rounded-lg p-2 text-center">
                          <img loading="lazy" 
                            src={`data:image/png;base64,${item.barcode_base64}`} 
                            alt={item.sku}
                            className="max-w-full"
                          />
                          <p className="text-xs mt-1 font-mono">{item.sku}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Barcode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>No labels generated yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Printer Setup */}
        <TabsContent value="printer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Printer Setup</CardTitle>
              <CardDescription>Configure thermal printer connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Printer IP Address</Label>
                  <Input 
                    placeholder="192.168.1.100"
                    value={printerIp}
                    onChange={(e) => setPrinterIp(e.target.value)}
                    data-testid="printer-ip-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input 
                    type="number"
                    value={printerPort}
                    onChange={(e) => setPrinterPort(parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button 
                    onClick={testPrinterConnection} 
                    disabled={testing}
                    className="w-full"
                    data-testid="test-printer-btn"
                  >
                    {testing ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : printerConnected ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Wifi className="w-4 h-4 mr-2" />
                    )}
                    {testing ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Connection Status</h4>
                <div className="flex items-center gap-2">
                  {printerConnected ? (
                    <>
                      <Badge variant="default" className="bg-green-500">Connected</Badge>
                      <span className="text-sm text-muted-foreground">Ready to print</span>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary">Not Connected</Badge>
                      <span className="text-sm text-muted-foreground">Enter printer IP and test connection</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Supported Printers</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Thermal printers with ESC/POS support (58mm, 80mm)</li>
                  <li>• Network printers (TCP/IP port 9100)</li>
                  <li>• USB printers connected via print server</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
