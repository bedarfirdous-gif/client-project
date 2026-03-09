import React, { useState, useCallback } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Upload, FileSpreadsheet, Camera, Scan, Package, Check, X, 
  AlertCircle, FileText, Loader2, Sparkles, Plus, Download,
  Image as ImageIcon, Table, ArrowRight, RefreshCw, Barcode
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import BarcodeScanner from '../components/BarcodeScanner';

export default function SmartScannerPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [activeTab, setActiveTab] = useState('excel'); // 'excel' | 'invoice' | 'camera'

  // FIX: prevent visual flash from `null -> File` transitions driving conditional rendering.
  // Use a stable non-null sentinel object for "no file" and a dedicated boolean for UI conditions.
  // This keeps render branches consistent across the initial paint and subsequent updates.
  const NO_FILE = React.useMemo(() => ({}), []);
  const [file, setFile] = useState(NO_FILE);
  const [isFileSelected, setIsFileSelected] = useState(false);

  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedStore, setSelectedStore] = useState('');
  const [stores, setStores] = useState([]);

  // FIX: keep stats shape stable (no null) and track readiness separately to prevent UI pop-in.
  const [importStats, setImportStats] = useState({});
  const [hasImportStats, setHasImportStats] = useState(false);

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannedBarcodes, setScannedBarcodes] = useState([]);
  const [documentType, setDocumentType] = useState('auto');

  // Fetch stores on mount
  React.useEffect(() => {
    const fetchStores = async () => {
      try {
        const data = await api('/api/stores');
        setStores(data);
        if (data.length > 0) setSelectedStore(data[0].id);
      } catch (err) {
        console.error('Failed to fetch stores');
      }
    };
    fetchStores();
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewData([]);
      setImportStats(null);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setPreviewData([]);
      setImportStats(null);
    }
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const processExcel = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('store_id', selectedStore);

      const result = await api('/api/smart-scanner/excel', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set content-type for FormData
      });

      setPreviewData(result.items || []);
      setImportStats(result.stats);
      setShowPreview(true);
      toast.success(`Found ${result.items?.length || 0} items to import`);
    } catch (err) {
      toast.error(err.message || 'Failed to process file');
    } finally {
      setLoading(false);
    }
  };

  const processInvoice = async () => {
    if (!file) {
      toast.error('Please select a document');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('store_id', selectedStore);
      formData.append('document_type', documentType || 'auto');

      const result = await api('/api/smart-scanner/document', {
        method: 'POST',
        body: formData,
        headers: {},
      });

      setPreviewData(result.items || []);
      setImportStats(result.stats);
      setShowPreview(true);
      toast.success(`AI extracted ${result.items?.length || 0} items from invoice`);
    } catch (err) {
      toast.error(err.message || 'Failed to scan invoice');
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = async () => {
    if (previewData.length === 0) return;

    setLoading(true);
    try {
      const result = await api('/api/smart-scanner/import', {
        method: 'POST',
        body: JSON.stringify({
          items: previewData,
          store_id: selectedStore,
        }),
      });

      toast.success(`Successfully imported ${result.imported} items!`);
      setShowPreview(false);
      setFile(null);
      setPreviewData([]);
      setImportStats(null);
    } catch (err) {
      toast.error(err.message || 'Failed to import items');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['SKU', 'Name', 'Category', 'Brand', 'Size', 'Color', 'MRP', 'Selling Price', 'Cost Price', 'Quantity', 'Reorder Level', 'GST Rate'];
    const sampleData = [
      ['SKU001', 'Sample Product', 'Clothing', 'Brand A', 'M', 'Blue', '999', '899', '500', '100', '10', '18'],
      ['SKU002', 'Another Product', 'Footwear', 'Brand B', '42', 'Black', '1999', '1799', '1000', '50', '5', '18'],
    ];
    
    const csvContent = [headers, ...sampleData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const removePreviewItem = (index) => {
    setPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  const updatePreviewItem = (index, field, value) => {
    setPreviewData(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  return (
    <div className="space-y-6" data-testid="smart-scanner-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Smart Stock Scanner
          </h1>
          <p className="text-muted-foreground">AI-powered inventory management - Upload Excel or scan invoices</p>
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Store" />
          </SelectTrigger>
          <SelectContent>
            {stores.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tab Selection */}
      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all flex-1 ${
            activeTab === 'excel' 
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
              : 'border-border hover:border-green-300'
          }`}
        >
          <div className={`p-3 rounded-lg ${activeTab === 'excel' ? 'bg-green-500 text-white' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-semibold">Excel/CSV Upload</p>
            <p className="text-sm text-muted-foreground">Bulk import from spreadsheet</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('invoice')}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all flex-1 ${
            activeTab === 'invoice' 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-border hover:border-blue-300'
          }`}
        >
          <div className={`p-3 rounded-lg ${activeTab === 'invoice' ? 'bg-blue-500 text-white' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
            <Scan className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-semibold">Invoice Scanner</p>
            <p className="text-sm text-muted-foreground">AI extracts items from invoice images</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('camera')}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all flex-1 ${
            activeTab === 'camera' 
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
              : 'border-border hover:border-purple-300'
          }`}
        >
          <div className={`p-3 rounded-lg ${activeTab === 'camera' ? 'bg-purple-500 text-white' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'}`}>
            <Camera className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-semibold">Camera Scan</p>
            <p className="text-sm text-muted-foreground">Scan barcodes or product labels</p>
          </div>
        </button>
      </div>

      {/* Content Area */}
      <Card>
        <CardContent className="p-6">
          {activeTab === 'excel' && (
            <div className="space-y-6">
              {/* Download Template */}
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                <div>
                  <p className="font-medium">Need a template?</p>
                  <p className="text-sm text-muted-foreground">Download our Excel/CSV template with all required columns</p>
                </div>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>

              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  file ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border hover:border-green-300'
                }`}
              >
                {file ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <FileSpreadsheet className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={processExcel} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        Process File
                      </Button>
                      <Button variant="outline" onClick={() => setFile(null)}>
                        <X className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-accent rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">Drop your Excel/CSV file here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="excel-upload"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="excel-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Select File
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {/* Supported Formats */}
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span>Supported formats:</span>
                <span className="px-2 py-1 bg-accent rounded">.xlsx</span>
                <span className="px-2 py-1 bg-accent rounded">.xls</span>
                <span className="px-2 py-1 bg-accent rounded">.csv</span>
              </div>
            </div>
          )}

          {activeTab === 'invoice' && (
            <div className="space-y-6">
              {/* Document Type Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'auto', label: 'Auto Detect', icon: Sparkles, desc: 'AI will identify document type' },
                  { id: 'invoice', label: 'Invoice/Receipt', icon: FileText, desc: 'Printed invoices & receipts' },
                  { id: 'handwritten', label: 'Handwritten', icon: ImageIcon, desc: 'Handwritten notes & lists' },
                  { id: 'inventory_list', label: 'Inventory List', icon: Table, desc: 'Stock lists & catalogs' }
                ].map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setDocumentType && setDocumentType(type.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        (documentType || 'auto') === type.id 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-border hover:border-blue-300'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1 text-blue-600" />
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* AI Info */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-400">AI-Powered Universal Document Scanner</p>
                  <p className="text-sm text-blue-600 dark:text-blue-500">Upload any document - invoices, handwritten notes, Word docs, PDFs - our AI extracts product details automatically</p>
                </div>
              </div>

              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  file ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-border hover:border-blue-300'
                }`}
              >
                {file ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      <p className="text-xs text-blue-600 mt-1">Mode: {documentType === 'auto' ? 'Auto-detect' : documentType}</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={processInvoice} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scan className="w-4 h-4 mr-2" />}
                        Scan Document
                      </Button>
                      <Button variant="outline" onClick={() => setFile(null)}>
                        <X className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-accent rounded-full flex items-center justify-center">
                      <Scan className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">Upload any document</p>
                      <p className="text-sm text-muted-foreground">Images, PDFs, Word docs, or photos of handwritten notes</p>
                    </div>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.doc,.docx"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="invoice-upload"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="invoice-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Select Document
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {/* Supported Formats */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Supported:</span>
                <span className="px-2 py-1 bg-accent rounded">.jpg</span>
                <span className="px-2 py-1 bg-accent rounded">.png</span>
                <span className="px-2 py-1 bg-accent rounded">.pdf</span>
                <span className="px-2 py-1 bg-accent rounded">.docx</span>
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">Handwritten ✓</span>
              </div>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="space-y-6">
              {/* Scanned Barcodes */}
              {scannedBarcodes.length > 0 && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium flex items-center gap-2">
                      <Barcode className="w-5 h-5 text-purple-600" />
                      Scanned Barcodes ({scannedBarcodes.length})
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setScannedBarcodes([])}>
                      Clear All
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {scannedBarcodes.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded px-3 py-2 border">
                        <span className="font-mono text-sm truncate">{item.code}</span>
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">
                          ×{item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700" onClick={async () => {
                    // Look up items by barcode and add to preview
                    setLoading(true);
                    try {
                      const lookupResults = await api('/api/items/lookup-barcodes', {
                        method: 'POST',
                        body: JSON.stringify({ barcodes: scannedBarcodes.map(b => b.code) })
                      });
                      if (lookupResults.items?.length > 0) {
                        setPreviewData(lookupResults.items.map(item => ({
                          ...item,
                          quantity: scannedBarcodes.find(b => b.code === item.barcode)?.count || 1
                        })));
                        setShowPreview(true);
                        toast.success(`Found ${lookupResults.items.length} items`);
                      } else {
                        toast.info('No matching items found. Add them as new items.');
                        // Add as new items with just barcodes
                        setPreviewData(scannedBarcodes.map(b => ({
                          sku: '',
                          name: `Item - ${b.code}`,
                          barcode: b.code,
                          category: '',
                          mrp: 0,
                          selling_price: 0,
                          quantity: b.count
                        })));
                        setShowPreview(true);
                      }
                    } catch (err) {
                      // If API fails, add as new items
                      setPreviewData(scannedBarcodes.map(b => ({
                        sku: '',
                        name: `Item - ${b.code}`,
                        barcode: b.code,
                        category: '',
                        mrp: 0,
                        selling_price: 0,
                        quantity: b.count
                      })));
                      setShowPreview(true);
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <Check className="w-4 h-4 mr-2" />
                    Process Scanned Items
                  </Button>
                </div>
              )}

              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                  <Camera className="w-10 h-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Camera Scanner</h3>
                <p className="text-muted-foreground mb-6">Scan barcodes or QR codes directly with your camera</p>
                <Button 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => setShowBarcodeScanner(true)}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Open Camera Scanner
                </Button>
                <div className="mt-6 text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Supported formats:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <span className="px-2 py-1 bg-accent rounded">EAN-13</span>
                    <span className="px-2 py-1 bg-accent rounded">EAN-8</span>
                    <span className="px-2 py-1 bg-accent rounded">UPC-A</span>
                    <span className="px-2 py-1 bg-accent rounded">Code 128</span>
                    <span className="px-2 py-1 bg-accent rounded">QR Code</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table className="w-5 h-5" />
              Preview Import Data
              {importStats && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({previewData.length} items)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="bg-accent sticky top-0">
                <tr>
                  <th className="p-2 text-left">SKU</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-right">MRP</th>
                  <th className="p-2 text-right">Selling</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((item, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-accent/50">
                    <td className="p-2">
                      <Input 
                        value={item.sku || ''} 
                        onChange={(e) => updatePreviewItem(idx, 'sku', e.target.value)}
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        value={item.name || ''} 
                        onChange={(e) => updatePreviewItem(idx, 'name', e.target.value)}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2 text-muted-foreground">{item.category || '-'}</td>
                    <td className="p-2 text-right">{currencySymbol}{item.mrp || 0}</td>
                    <td className="p-2 text-right">{currencySymbol}{item.selling_price || 0}</td>
                    <td className="p-2 text-right">{item.quantity || 0}</td>
                    <td className="p-2 text-center">
                      <Button size="sm" variant="ghost" className="text-red-500 h-8 w-8 p-0" onClick={() => removePreviewItem(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import Stats */}
          {importStats && (
            <div className="grid grid-cols-4 gap-4 p-4 bg-accent/50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{importStats.valid || previewData.length}</p>
                <p className="text-xs text-muted-foreground">Valid Items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{importStats.new || previewData.length}</p>
                <p className="text-xs text-muted-foreground">New Items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{importStats.update || 0}</p>
                <p className="text-xs text-muted-foreground">Updates</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{importStats.errors || 0}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={loading || previewData.length === 0} className="bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Import {previewData.length} Items
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        title="Scan Product Barcodes"
        continuous={true}
        onScan={(data, result) => {
          if (result?.bulk) {
            // Bulk scan completed
            setScannedBarcodes(data);
          } else {
            // Single scan
            setScannedBarcodes(prev => {
              const exists = prev.find(item => item.code === data);
              if (exists) {
                return prev.map(item => 
                  item.code === data 
                    ? { ...item, count: item.count + 1 }
                    : item
                );
              }
              return [...prev, { code: data, count: 1 }];
            });
          }
        }}
      />
    </div>
  );
}
