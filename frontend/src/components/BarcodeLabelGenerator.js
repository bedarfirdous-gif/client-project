import React, { useState, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { 
  Barcode, Printer, Download, Settings, Plus, Minus, X, 
  Grid, Rows, Tag, Package, ChevronDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

import { useCurrency } from '../contexts/CurrencyContext';
// Label size presets (in mm)
const LABEL_SIZES = {
  small: { name: 'Small (38×25mm)', width: 38, height: 25 },
  medium: { name: 'Medium (50×25mm)', width: 50, height: 25 },
  large: { name: 'Large (50×30mm)', width: 50, height: 30 },
  jewelry: { name: 'Jewelry (22×10mm)', width: 22, height: 10 },
  shelf: { name: 'Shelf (70×30mm)', width: 70, height: 30 },
  custom: { name: 'Custom', width: 50, height: 25 }
};

// Paper sizes for printing
const PAPER_SIZES = {
  a4: { name: 'A4', width: 210, height: 297 },
  letter: { name: 'Letter', width: 216, height: 279 },
  a5: { name: 'A5', width: 148, height: 210 },
  label_roll: { name: 'Label Roll', width: 100, height: 0 } // Continuous
};

// Barcode types
const BARCODE_TYPES = {
  CODE128: 'Code 128 (Alphanumeric)',
  EAN13: 'EAN-13 (13 digits)',
  EAN8: 'EAN-8 (8 digits)',
  UPC: 'UPC-A (12 digits)',
  CODE39: 'Code 39 (Alphanumeric)',
  ITF14: 'ITF-14 (14 digits)',
  pharmacode: 'Pharmacode'
};

export default function BarcodeLabelGenerator({ isOpen, onClose, items = [], onPrint, storeName = 'Your Store' }) {
  const { currencySymbol } = useCurrency();
  const [selectedItems, setSelectedItems] = useState([]);
  const [timeout, setTimeout] = useState(false);
  const [labelSize, setLabelSize] = useState('medium');
  const [customWidth, setCustomWidth] = useState(50);
  const [customHeight, setCustomHeight] = useState(25);
  const [paperSize, setPaperSize] = useState('a4');
  const [barcodeType, setBarcodeType] = useState('CODE128');
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [showSize, setShowSize] = useState(true);
  const [showColor, setShowColor] = useState(true);
  const [copies, setCopies] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const previewRef = useRef(null);

  // Initialize selected items from props
  useEffect(() => {
    if (items.length > 0) {
      const itemIds = items.map(item => item.id || item.sku);
      const initialCopies = {};
      items.forEach(item => {
        initialCopies[item.id || item.sku] = 1;
      });
      setSelectedItems(prev => prev.length === 0 ? itemIds : prev);
      setCopies(prev => Object.keys(prev).length === 0 ? initialCopies : prev);
    }
  }, [items]);

  // Get actual label dimensions
  const getLabelDimensions = () => {
    if (labelSize === 'custom') {
      return { width: customWidth, height: customHeight };
    }
    return LABEL_SIZES[labelSize];
  };

  // Generate barcode SVG
  const generateBarcode = (value, elementId) => {
    try {
      const canvas = document.getElementById(elementId);
      if (canvas) {
        JsBarcode(canvas, value, {
          format: barcodeType,
          width: 1.5,
          height: 30,
          displayValue: true,
          fontSize: 10,
          margin: 2,
          background: '#ffffff'
        });
      }
    } catch (err) {
      console.error('Barcode generation error:', err);
    }
  };

  // Get items to print
  const getItemsToPrint = () => {
    return items
      .filter(item => selectedItems.includes(item.id || item.sku))
      .flatMap(item => {
        const count = copies[item.id || item.sku] || 1;
        return Array(count).fill(item);
      });
  };

  // Print labels
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print labels');
      return;
    }

    const labelDims = getLabelDimensions();
    const itemsToPrint = getItemsToPrint();

    const labelsHtml = itemsToPrint.map((item, idx) => {
      const barcodeValue = item.barcode || item.sku || `ITEM${idx}`;
      const sizeColorText = [
        showSize && item.size ? item.size : '',
        showColor && item.color ? item.color : ''
      ].filter(Boolean).join(' / ');
      
      return `
        <div class="label" style="width: ${labelDims.width}mm; height: ${labelDims.height}mm;">
          ${showStoreName ? `<div class="store-name">${storeName}</div>` : ''}
          ${showBrand && item.brand_name ? `<div class="brand">${item.brand_name}</div>` : ''}
          ${showName ? `<div class="name">${item.name?.substring(0, 20) || 'Product'}</div>` : ''}
          ${sizeColorText ? `<div class="size-color">${sizeColorText}</div>` : ''}
          <svg class="barcode" id="barcode-print-${idx}"></svg>
          <div class="info">
            ${showSku ? `<span class="sku">${item.sku || ''}</span>` : ''}
            <span class="prices">
              ${showMrp && item.mrp ? `<span class="mrp">MRP: ${currencySymbol}${item.mrp?.toLocaleString()}</span>` : ''}
              ${showPrice ? `<span class="price">{currencySymbol}${item.selling_price?.toLocaleString() || '0'}</span>` : ''}
            </span>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { margin: 5mm; }
          body { margin: 0; padding: 5mm; font-family: Arial, sans-serif; }
          .labels { display: flex; flex-wrap: wrap; gap: 2mm; }
          .label {
            border: 1px dashed #ccc;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            page-break-inside: avoid;
          }
          .store-name { font-size: 6px; color: #333; text-transform: uppercase; letter-spacing: 0.5px; }
          .brand { font-size: 6px; color: #666; font-style: italic; }
          .name { font-size: 8px; font-weight: bold; text-align: center; margin-bottom: 1mm; overflow: hidden; }
          .size-color { font-size: 7px; color: #444; font-weight: 500; margin-bottom: 1mm; }
          .barcode { max-width: 100%; height: auto; }
          .info { display: flex; justify-content: space-between; width: 100%; font-size: 7px; margin-top: 1mm; }
          .sku { color: #666; }
          .prices { display: flex; gap: 4px; align-items: center; }
          .mrp { color: #999; text-decoration: line-through; font-size: 6px; }
          .price { font-weight: bold; color: #000; }
          @media print {
            .label { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="labels">${labelsHtml}</div>
        <script>
          ${itemsToPrint.map((item, idx) => {
            const barcodeValue = item.barcode || item.sku || `ITEM${idx}`;
            return `
              try {
                JsBarcode("#barcode-print-${idx}", "${barcodeValue}", {
                  format: "${barcodeType}",
                  width: 1.5,
                  height: 25,
                  displayValue: true,
                  fontSize: 8,
                  margin: 1
                });
              } catch(e) { console.error(e); }
            `;
          }).join('\n')}
          setTimeout(() => window.print(), 500);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('Print dialog opened');
  };

  // Download as PDF (simplified - uses browser print to PDF)
  const handleDownloadPDF = () => {
    toast.info('Use Print → Save as PDF to download');
    handlePrint();
  };

  // Toggle item selection
  const toggleItem = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        // Initialize copies for this item if not already set
        setCopies(prevCopies => ({
          ...prevCopies,
          [itemId]: prevCopies[itemId] || 1
        }));
        return [...prev, itemId];
      }
    });
  };

  // Update copies
  const updateCopies = (itemId, delta) => {
    setCopies(prev => ({
      ...prev,
      [itemId]: Math.max(1, (prev[itemId] || 1) + delta)
    }));
  };

  const totalLabels = Object.entries(copies)
    .filter(([id]) => selectedItems.includes(id))
    .reduce((sum, [, count]) => sum + count, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col sm:max-h-[90vh] max-sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Barcode className="w-4 h-4 sm:w-5 sm:h-5" />
            Barcode Label Generator
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 p-1">
            {/* Left: Item Selection */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-medium text-sm sm:text-base">Select Items ({selectedItems.length})</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs sm:text-sm h-7 sm:h-8"
                    onClick={() => {
                      const allIds = items.map(i => i.id || i.sku);
                      setSelectedItems(allIds);
                      // Initialize copies for all items
                      const newCopies = {};
                      items.forEach(item => {
                        const id = item.id || item.sku;
                        newCopies[id] = copies[id] || 1;
                      });
                      setCopies(newCopies);
                    }}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs sm:text-sm h-7 sm:h-8"
                    onClick={() => setSelectedItems([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg max-h-48 sm:max-h-64 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-muted-foreground">
                    <Package className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No items available</p>
                  </div>
                ) : (
                  items.map(item => {
                    const itemId = item.id || item.sku;
                    const isSelected = selectedItems.includes(itemId);
                    return (
                      <div key={itemId} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border-b last:border-0 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItem(itemId)}
                          className="rounded w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">{item.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.sku || item.barcode || 'No barcode'}</p>
                        </div>
                        <div className="text-right text-xs sm:text-sm flex-shrink-0">
                          <p className="font-semibold">{currencySymbol}{item.selling_price?.toLocaleString() || '0'}</p>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2 flex-shrink-0">
                            <Button size="sm" variant="outline" className="h-5 w-5 sm:h-6 sm:w-6 p-0" onClick={() => updateCopies(itemId, -1)}>
                              <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            </Button>
                            <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-medium">{copies[itemId] || 1}</span>
                            <Button size="sm" variant="outline" className="h-5 w-5 sm:h-6 sm:w-6 p-0" onClick={() => updateCopies(itemId, 1)}>
                              <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground">
                Total labels to print: <span className="font-bold">{totalLabels}</span>
              </p>
            </div>

            {/* Right: Settings & Preview */}
            <div className="space-y-3 sm:space-y-4">
              {/* Quick Settings */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] sm:text-xs">Label Size</Label>
                  <Select value={labelSize} onValueChange={setLabelSize}>
                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LABEL_SIZES).map(([key, size]) => (
                        <SelectItem key={key} value={key}>{size.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] sm:text-xs">Barcode Type</Label>
                  <Select value={barcodeType} onValueChange={setBarcodeType}>
                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BARCODE_TYPES).map(([key, name]) => (
                        <SelectItem key={key} value={key}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {labelSize === 'custom' && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] sm:text-xs">Width (mm)</Label>
                    <Input type="number" value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value))} className="h-8 sm:h-9 text-xs sm:text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] sm:text-xs">Height (mm)</Label>
                    <Input type="number" value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value))} className="h-8 sm:h-9 text-xs sm:text-sm" />
                  </div>
                </div>
              )}

              {/* Display Options */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showStoreName} onChange={(e) => setShowStoreName(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Store Name
                </label>
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Brand
                </label>
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Item Name
                </label>
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showSku} onChange={(e) => setShowSku(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  SKU
                </label>
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showSize} onChange={(e) => setShowSize(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Size
                </label>
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showColor} onChange={(e) => setShowColor(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Color
                </label>
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showMrp} onChange={(e) => setShowMrp(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  MRP
                </label>
                <label className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs cursor-pointer">
                  <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Sale Price
                </label>
              </div>

              {/* Preview - Hidden on mobile by default */}
              <div className="border rounded-lg p-2 sm:p-4 bg-white hidden sm:block">
                <h4 className="text-xs sm:text-sm font-medium mb-2 sm:mb-3">Label Preview</h4>
                <div className="flex flex-wrap gap-2" ref={previewRef}>
                  {getItemsToPrint().slice(0, 4).map((item, idx) => {
                    const dims = getLabelDimensions();
                    const barcodeValue = item.barcode || item.sku || `ITEM${idx}`;
                    return (
                      <div 
                        key={idx}
                        className="border border-dashed border-gray-300 p-2 flex flex-col items-center justify-center bg-white"
                        style={{ 
                          width: `${Math.min(dims.width * 2.5, 140)}px`, 
                          minHeight: `${Math.min(dims.height * 2.5, 100)}px` 
                        }}
                      >
                        {showStoreName && (
                          <p className="text-[6px] text-gray-600 uppercase tracking-wide">{storeName}</p>
                        )}
                        {showBrand && item.brand_name && (
                          <p className="text-[6px] text-gray-500 italic">{item.brand_name}</p>
                        )}
                        {showName && (
                          <p className="text-[8px] font-bold text-center truncate w-full">{item.name?.substring(0, 15)}</p>
                        )}
                        {(showSize || showColor) && (item.size || item.color) && (
                          <p className="text-[7px] text-gray-600 font-medium">
                            {[showSize && item.size, showColor && item.color].filter(Boolean).join(' / ')}
                          </p>
                        )}
                        <svg id={`barcode-preview-${idx}`} className="w-full"></svg>
                        <div className="flex justify-between w-full text-[7px] mt-1">
                          {showSku && <span className="text-gray-500">{item.sku?.substring(0, 10)}</span>}
                          <span className="flex gap-1">
                            {showMrp && item.mrp && <span className="text-gray-400 line-through">{currencySymbol}{item.mrp}</span>}
                            {showPrice && <span className="font-bold">{currencySymbol}{item.selling_price || 0}</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {getItemsToPrint().length > 4 && (
                    <div className="border border-dashed border-gray-300 p-4 flex items-center justify-center text-sm text-muted-foreground">
                      +{getItemsToPrint().length - 4} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 pt-3 sm:pt-4 border-t">
          <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            {selectedItems.length} items × {totalLabels} labels
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9">
              <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Cancel
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9">
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              PDF
            </Button>
            <Button onClick={handlePrint} disabled={selectedItems.length === 0} size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9">
              <Printer className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Standalone barcode generator for single item
export function SingleBarcodeGenerator({ value, type = 'CODE128', width = 2, height = 50 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: type,
          width,
          height,
          displayValue: true,
          fontSize: 12,
          margin: 5
        });
      } catch (err) {
        console.error('Barcode error:', err);
      }
    }
  }, [value, type, width, height]);

  if (!value) return null;

  return <svg ref={canvasRef} />;
}
