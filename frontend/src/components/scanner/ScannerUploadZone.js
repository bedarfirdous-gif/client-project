import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet, Camera, FileText, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function ScannerUploadZone({
  activeTab,
  file,
  setFile,
  loading,
  onProcessFile,
  documentType,
  setDocumentType
}) {
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }, [setFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const getAcceptedTypes = () => {
    switch (activeTab) {
      case 'excel':
        return '.xlsx,.xls,.csv';
      case 'invoice':
        return '.pdf,.jpg,.jpeg,.png,.webp';
      default:
        return '*';
    }
  };

  const getIcon = () => {
    switch (activeTab) {
      case 'excel':
        return <FileSpreadsheet className="w-16 h-16 text-green-500 mb-4" />;
      case 'invoice':
        return <FileText className="w-16 h-16 text-blue-500 mb-4" />;
      default:
        return <Upload className="w-16 h-16 text-muted-foreground mb-4" />;
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'excel':
        return 'Upload Excel/CSV File';
      case 'invoice':
        return 'Upload Invoice Document';
      default:
        return 'Upload File';
    }
  };

  const getDescription = () => {
    switch (activeTab) {
      case 'excel':
        return 'Supports .xlsx, .xls, and .csv files with product data';
      case 'invoice':
        return 'AI will extract items from purchase invoices (PDF, Images)';
      default:
        return 'Drag and drop or click to upload';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getTitle()}</CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Document Type Selection for Invoice */}
        {activeTab === 'invoice' && (
          <div className="mb-4">
            <Label>Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto Detect</SelectItem>
                <SelectItem value="purchase_invoice">Purchase Invoice</SelectItem>
                <SelectItem value="delivery_challan">Delivery Challan</SelectItem>
                <SelectItem value="quotation">Quotation</SelectItem>
                <SelectItem value="price_list">Price List</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <input
            type="file"
            accept={getAcceptedTypes()}
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            {getIcon()}
            
            {file ? (
              <div>
                <p className="font-medium text-lg">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drag & drop file here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            )}
          </label>
        </div>

        {/* Process Button */}
        {file && (
          <Button 
            className="w-full mt-4" 
            onClick={onProcessFile}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>Process File</>
            )}
          </Button>
        )}

        {/* Tips */}
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              {activeTab === 'excel' ? (
                <>
                  <p className="font-medium">Excel Format Tips:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>First row should contain column headers</li>
                    <li>Required columns: Name, SKU, Price</li>
                    <li>Optional: Category, Brand, Stock, Description</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-medium">Invoice Processing Tips:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Clear, high-resolution images work best</li>
                    <li>Ensure text is readable and not blurry</li>
                    <li>PDF invoices are preferred for accuracy</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
