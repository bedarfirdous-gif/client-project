import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Search, Receipt, Eye, Printer, Calendar, XCircle, MoreVertical, Ban, AlertTriangle, CheckSquare, Square, Trash2, Download, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext';

export default function SalesPage() {
  const { currencySymbol } = useCurrency();
  const { api } = useAuth();
  const { formatCurrency, displayCurrency } = useCurrency();
  const [sales, setSales] = useState([]);
  const [textColor, setTextColor] = useState(false);
  const [lineWidth, setLineWidth] = useState(false);
  const [font, setFont] = useState(false);
  const [fontSize, setFontSize] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // FIX: Avoid `null` for UI-driving selection/modal state to prevent conditional-render flashes.
  // Use explicit booleans so the first render is deterministic (no transient mount/unmount).
  const [viewSale, setViewSale] = useState(false); // holds a sale object when open, otherwise `false`
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSale, setCancelSale] = useState(false); // holds a sale object when cancelling, otherwise `false`
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  // Keep settings shape stable to avoid flicker in render branches that check presence.
  const [invoiceSettings, setInvoiceSettings] = useState({});

  const fetchData = async () => {
    try {
      let url = '/api/sales?';
      if (selectedStore) url += `store_id=${selectedStore}&`;
      if (selectedDate) url += `date=${selectedDate}&`;
      
      const [salesData, storesData, settingsData] = await Promise.all([
        api(url),
        api('/api/stores'),
        api('/api/invoice-settings'),
      ]);
      setSales(salesData);
      setStores(storesData);
      setInvoiceSettings(settingsData);
    } catch (err) {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedStore, selectedDate]);

  const getStoreName = (id) => stores.find(s => s.id === id)?.name || 'Unknown';

  // Print invoice function with invoice settings
  const handlePrintInvoice = (sale) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    const invoiceHTML = generateInvoiceHTML(sale);
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Download Professional A4 Invoice PDF - Uses centralized utility
  const handleDownloadPDF = (sale) => {
    try {
      const settings = invoiceSettings || {};
      const sym = CURRENCIES[displayCurrency]?.symbol || '₹';
      
      // Use the centralized PDF generator utility
      const { downloadInvoicePDF } = require('../utils/invoicePdfGenerator');
      const success = downloadInvoicePDF(sale, settings, sym, getStoreName);
      if (success) {
        toast.success(`Invoice ${sale.invoice_number} downloaded`);
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    }
  };

  // Generate invoice HTML for printing with invoice settings
  const generateInvoiceHTML = (sale) => {
    const settings = invoiceSettings || {};
    const invoiceCurrencySymbol = CURRENCIES[displayCurrency]?.symbol || '₹';
    
    const itemsHTML = sale.items?.map((item, idx) => {
      const itemName = item.variant_name || item.item_name || item.name || 'Item';
      const qty = item.quantity || 1;
      const rate = item.rate || item.price || 0;
      const amount = qty * rate;
      
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 500;">${itemName}</div>
            ${item.size || item.color ? `<div style="font-size: 11px; color: #6b7280;">Size: ${item.size || 'N/A'} | Color: ${item.color || 'N/A'}</div>` : ''}
          </td>
          ${settings.show_hsn ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.hsn_code || '-'}</td>` : ''}
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace;">${qty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: monospace;">${currencySymbol}${rate.toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: monospace; font-weight: 500;">${currencySymbol}${amount.toFixed(2)}</td>
        </tr>
      `;
    }).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${sale.invoice_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; font-size: 13px; }
          .invoice-container { max-width: 800px; margin: 0 auto; background: #fff; }
          
          /* Header */
          .company-header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #2563eb; margin-bottom: 15px; }
          .company-logo { max-height: 60px; margin-bottom: 8px; }
          .company-name { font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 4px; }
          .company-details { font-size: 12px; color: #6b7280; line-height: 1.5; }
          .company-gstin { font-size: 11px; color: #374151; margin-top: 4px; font-weight: 500; }
          
          /* Invoice Title */
          .invoice-title { text-align: center; margin: 15px 0; }
          .invoice-title h1 { font-size: 18px; color: #2563eb; letter-spacing: 2px; }
          
          /* Details Grid */
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
          .detail-section h3 { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
          .detail-section p { margin: 4px 0; font-size: 13px; }
          .detail-section strong { color: #374151; }
          
          /* Items Table */
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { background: #2563eb; color: white; padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          .items-table th:first-child { border-radius: 6px 0 0 0; }
          .items-table th:last-child { border-radius: 0 6px 0 0; text-align: right; }
          .items-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          
          /* Totals */
          .totals-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
          .totals-box { width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .totals-row.grand-total { border-bottom: none; border-top: 2px solid #2563eb; margin-top: 8px; padding-top: 12px; }
          .totals-row.grand-total span { font-size: 16px; font-weight: bold; color: #2563eb; }
          .totals-row span:last-child { font-family: monospace; }
          
          /* Bank Details */
          .bank-details { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 12px; }
          .bank-details h4 { font-size: 11px; color: #374151; margin-bottom: 6px; text-transform: uppercase; }
          
          /* Terms & Policies */
          .terms-section { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-top: 20px; margin-bottom: 15px; }
          .terms-section h4 { font-size: 11px; color: #1f2937; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
          .terms-section p { font-size: 11px; color: #4b5563; line-height: 1.6; margin-bottom: 10px; }
          .terms-section p:last-child { margin-bottom: 0; }
          .terms-divider { border-top: 1px dashed #d1d5db; margin: 10px 0; }
          .policy-label { font-weight: 500; color: #374151; }
          
          /* Footer */
          .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
          .footer p { color: #6b7280; font-size: 12px; }
          
          /* Status Badge */
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; }
          .status-completed { background: #dcfce7; color: #166534; }
          .status-cancelled { background: #fee2e2; color: #991b1b; }
          
          @media print { 
            body { margin: 0; padding: 15px; } 
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Company Header -->
          <div class="company-header">
            ${settings.company_logo && settings.show_logo ? `<img loading="lazy" src="${settings.company_logo}" alt="Logo" class="company-logo" />` : ''}
            <div class="company-name">${settings.company_name || 'Your Company Name'}</div>
            <div class="company-details">
              ${settings.company_address || ''}
              ${settings.company_phone ? `<br/>📞 ${settings.company_phone}` : ''}
              ${settings.company_email ? ` | ✉️ ${settings.company_email}` : ''}
              ${settings.company_website ? ` | 🌐 ${settings.company_website}` : ''}
            </div>
            ${settings.gstin && settings.show_gstin ? `<div class="company-gstin">GSTIN: ${settings.gstin}</div>` : ''}
            ${settings.pan ? `<div class="company-gstin">PAN: ${settings.pan}</div>` : ''}
          </div>
          
          <!-- Invoice Title -->
          <div class="invoice-title">
            <h1>TAX INVOICE</h1>
          </div>
          
          <!-- Details Grid -->
          <div class="details-grid">
            <div class="detail-section">
              <h3>Invoice Details</h3>
              <p><strong>Invoice #:</strong> ${sale.invoice_number}</p>
              <p><strong>Date:</strong> ${new Date(sale.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p><strong>Time:</strong> ${new Date(sale.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              <p><strong>Store:</strong> ${getStoreName(sale.store_id)}</p>
              <p><strong>Payment:</strong> ${sale.payment_method?.toUpperCase() || 'CASH'}</p>
            </div>
            <div class="detail-section" style="text-align: right;">
              <h3>Bill To</h3>
              <p><strong>${sale.customer_name || 'Walk-in Customer'}</strong></p>
              <p>${sale.customer_phone || 'N/A'}</p>
              <p>${sale.customer_address || ''}</p>
              <p style="margin-top: 8px;">
                <span class="status-badge ${sale.status === 'cancelled' ? 'status-cancelled' : 'status-completed'}">
                  ${sale.status?.toUpperCase() || 'COMPLETED'}
                </span>
              </p>
            </div>
          </div>
          
          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Item Description</th>
                ${settings.show_hsn ? '<th style="width: 80px; text-align: center;">HSN</th>' : ''}
                <th style="width: 60px; text-align: center;">Qty</th>
                <th style="width: 90px; text-align: right;">Rate</th>
                <th style="width: 100px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          
          <!-- Totals Section -->
          <div class="totals-section">
            <div class="totals-box">
              <div class="totals-row">
                <span>Subtotal:</span>
                <span>${currencySymbol}${(sale.subtotal || 0).toFixed(2)}</span>
              </div>
              ${sale.discount_amount > 0 ? `
                <div class="totals-row" style="color: #dc2626;">
                  <span>Discount:</span>
                  <span>-${currencySymbol}${sale.discount_amount.toFixed(2)}</span>
                </div>
              ` : ''}
              ${sale.voucher_discount > 0 ? `
                <div class="totals-row" style="color: #dc2626;">
                  <span>Voucher (${sale.voucher_code || 'VOUCHER'}):</span>
                  <span>-${currencySymbol}${sale.voucher_discount.toFixed(2)}</span>
                </div>
              ` : ''}
              ${(() => {
                const gstRate = sale.gst_rate || 5;
                let gstAmt = sale.gst_amount;
                if (!gstAmt || gstAmt <= 0) {
                  gstAmt = (sale.subtotal || sale.total_amount || 0) * gstRate / (100 + gstRate);
                }
                if (gstAmt > 0) {
                  return `<div class="totals-row">
                    <span>CGST (${gstRate / 2}%):</span>
                    <span>${currencySymbol}${(gstAmt / 2).toFixed(2)}</span>
                  </div>
                  <div class="totals-row">
                    <span>SGST (${gstRate / 2}%):</span>
                    <span>${currencySymbol}${(gstAmt / 2).toFixed(2)}</span>
                  </div>`;
                }
                return '';
              })()}
              <div class="totals-row grand-total">
                <span>GRAND TOTAL:</span>
                <span>${currencySymbol}${(sale.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <!-- Bank Details -->
          ${(settings.bank_name || settings.upi_id) ? `
            <div class="bank-details">
              <h4>Payment Details</h4>
              ${settings.bank_name ? `<p><strong>Bank:</strong> ${settings.bank_name} | <strong>A/C:</strong> ${settings.account_number || 'N/A'} | <strong>IFSC:</strong> ${settings.ifsc_code || 'N/A'}</p>` : ''}
              ${settings.upi_id ? `<p><strong>UPI:</strong> ${settings.upi_id}</p>` : ''}
            </div>
          ` : ''}
          
          <!-- Terms & Policies Section -->
          ${(settings.terms_and_conditions || settings.return_policy || settings.warranty_info) ? `
            <div class="terms-section">
              ${settings.terms_and_conditions ? `
                <h4>📋 Terms & Conditions</h4>
                <p>${settings.terms_and_conditions}</p>
              ` : ''}
              ${settings.return_policy ? `
                ${settings.terms_and_conditions ? '<div class="terms-divider"></div>' : ''}
                <p><span class="policy-label">🔄 Return Policy:</span> ${settings.return_policy}</p>
              ` : ''}
              ${settings.warranty_info ? `
                <p><span class="policy-label">🛡️ Warranty:</span> ${settings.warranty_info}</p>
              ` : ''}
            </div>
          ` : ''}
          
          <!-- Footer -->
          <div class="footer">
            <p>${settings.footer_text || 'Thank you for your business!'}</p>
            ${settings.show_social_links && (settings.facebook_url || settings.instagram_url || settings.whatsapp_number) ? `
              <p style="margin-top: 8px; font-size: 11px;">
                ${settings.facebook_url ? `FB: ${settings.facebook_url}` : ''}
                ${settings.instagram_url ? ` | IG: ${settings.instagram_url}` : ''}
                ${settings.whatsapp_number ? ` | WA: ${settings.whatsapp_number}` : ''}
              </p>
            ` : ''}
          </div>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
  };

  // Open cancel modal
  const openCancelModal = (sale) => {
    setCancelSale(sale);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // Handle cancel sale
  const handleCancelSale = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    
    setCancelling(true);
    try {
      await api(`/api/sales/${cancelSale.id}/cancel?reason=${encodeURIComponent(cancelReason)}`, {
        method: 'PUT'
      });
      toast.success(`Invoice ${cancelSale.invoice_number} cancelled successfully`);
      setShowCancelModal(false);
      setCancelSale(null);
      setCancelReason('');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel sale');
    } finally {
      setCancelling(false);
    }
  };

  // Summary
  const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalOrders = sales.length;

  // Mark All / Unmark All functions
  const handleMarkAll = () => {
    const allIds = new Set(sales.map(sale => sale.id));
    setSelectedRows(allIds);
    toast.success(`Selected all ${sales.length} sales`);
  };

  const handleUnmarkAll = () => {
    setSelectedRows(new Set());
    toast.success('Cleared selection');
  };

  const handleToggleRow = (saleId) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('No sales selected');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedRows.size} sales records? This action cannot be undone.`)) return;
    
    try {
      for (const saleId of selectedRows) {
        await api(`/api/sales/${saleId}`, { method: 'DELETE' });
      }
      toast.success(`Deleted ${selectedRows.size} sales records`);
      setSelectedRows(new Set());
      fetchData();
    } catch (err) {
      toast.error('Failed to delete some sales');
    }
  };

  return (
    <div className="space-y-6" data-testid="sales-page">
      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-2">
            <Label>Store</Label>
            <Select value={selectedStore || "all"} onValueChange={(v) => setSelectedStore(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-48"
            />
          </div>
        </div>
        
        {/* Actions Dropdown */}
        <div className="flex items-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="sales-actions-menu">
                <MoreVertical className="w-4 h-4" /> Actions
                {selectedRows.size > 0 && (
                  <Badge variant="secondary" className="ml-1">{selectedRows.size}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleMarkAll();
                }} 
                data-testid="sales-mark-all-btn"
              >
                <CheckSquare className="w-4 h-4 mr-2" /> Mark All
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleUnmarkAll();
                }} 
                data-testid="sales-unmark-all-btn"
              >
                <Square className="w-4 h-4 mr-2" /> Unmark All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  handleBulkDelete();
                }}
                className="text-red-600 dark:text-red-400"
                disabled={selectedRows.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-3xl font-bold font-mono-data">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-bold font-mono-data text-emerald-600">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No sales found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${selectedRows.size === sales.length && sales.length > 0 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
                    onClick={() => {
                      if (selectedRows.size === sales.length) {
                        handleUnmarkAll();
                      } else {
                        handleMarkAll();
                      }
                    }}
                  >
                    {selectedRows.size === sales.length && sales.length > 0 && <CheckSquare className="w-3 h-3" />}
                  </div>
                </TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => {
                const isSelected = selectedRows.has(sale.id);
                return (
                <TableRow key={sale.id} className={`${sale.status === 'cancelled' ? 'opacity-60 bg-red-50/30 dark:bg-red-900/10' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <TableCell>
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
                      onClick={() => handleToggleRow(sale.id)}
                    >
                      {isSelected && <CheckSquare className="w-3 h-3" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono-data font-medium">{sale.invoice_number}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(sale.created_at).toLocaleDateString()}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleTimeString()}
                    </span>
                  </TableCell>
                  <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                  <TableCell>{getStoreName(sale.store_id)}</TableCell>
                  <TableCell className="text-right font-mono-data">{sale.items?.length || 0}</TableCell>
                  <TableCell className={`text-right font-mono-data font-bold ${sale.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                    {formatCurrency(sale.total_amount || 0)}
                  </TableCell>
                  <TableCell className="capitalize">{sale.payment_method}</TableCell>
                  <TableCell>
                    {sale.status === 'cancelled' ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" /> Cancelled
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`sale-actions-${sale.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-48">
                        <DropdownMenuItem onClick={() => setViewSale(sale)} className="rounded-lg">
                          <Eye className="w-4 h-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handlePrintInvoice(sale)} className="rounded-lg">
                          <Printer className="w-4 h-4 mr-2" /> Print Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadPDF(sale)} className="rounded-lg">
                          <Download className="w-4 h-4 mr-2" /> Download PDF
                        </DropdownMenuItem>
                        {sale.status !== 'cancelled' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openCancelModal(sale)} className="rounded-lg text-red-600">
                              <Ban className="w-4 h-4 mr-2" /> Cancel Sale
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this sale?')) {
                              api(`/api/sales/${sale.id}`, { method: 'DELETE' })
                                .then(() => { toast.success('Sale deleted'); fetchData(); })
                                .catch(err => toast.error(err.message));
                            }
                          }} 
                          className="rounded-lg text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Sale
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* View Sale Modal */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice {viewSale?.invoice_number}</DialogTitle>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(viewSale.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{viewSale.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Store</p>
                  <p className="font-medium">{getStoreName(viewSale.store_id)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment</p>
                  <p className="font-medium capitalize">{viewSale.payment_method}</p>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewSale.items?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {item.item_name}
                          {item.size && <span className="text-xs text-muted-foreground"> ({item.size}/{item.color})</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono-data">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono-data">{formatCurrency(item.rate || 0)}</TableCell>
                        <TableCell className="text-right font-mono-data">{formatCurrency(((item.rate || 0) * (item.quantity || 0)))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono-data">{formatCurrency(viewSale.subtotal || 0)}</span>
                </div>
                {viewSale.discount_amount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount</span>
                    <span className="font-mono-data">-{formatCurrency(viewSale.discount_amount || 0)}</span>
                  </div>
                )}
                {viewSale.voucher_discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Voucher ({viewSale.voucher_code})</span>
                    <span className="font-mono-data">-{formatCurrency(viewSale.voucher_discount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST</span>
                  <span className="font-mono-data">{formatCurrency(viewSale.gst_amount || 0)}</span>
                </div>
                <div className={`flex justify-between text-lg font-bold pt-2 border-t ${viewSale.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                  <span>Total</span>
                  <span className="font-mono-data">{formatCurrency(viewSale.total_amount || 0)}</span>
                </div>
              </div>

              {/* Cancellation Info */}
              {viewSale.status === 'cancelled' && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Sale Cancelled</span>
                  </div>
                  <p className="text-sm text-muted-foreground"><strong>Reason:</strong> {viewSale.cancel_reason || 'No reason provided'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cancelled on {new Date(viewSale.cancelled_at).toLocaleString()} by {viewSale.cancelled_by_name || 'Unknown'}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handlePrintInvoice(viewSale)}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
                <Button variant="outline" onClick={() => handleDownloadPDF(viewSale)}>
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </Button>
                <Button variant="outline" onClick={() => setViewSale(null)}>Close</Button>
                {viewSale.status !== 'cancelled' && (
                  <Button variant="destructive" onClick={() => { setViewSale(null); openCancelModal(viewSale); }}>
                    <Ban className="w-4 h-4 mr-2" /> Cancel Sale
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Sale Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Cancel Sale
            </DialogTitle>
          </DialogHeader>
          
          {cancelSale && (
            <div className="space-y-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="font-medium">Invoice: {cancelSale.invoice_number}</p>
                <p className="text-sm text-muted-foreground">
                  {cancelSale.customer_name || 'Walk-in'} • {formatCurrency(cancelSale.total_amount || 0)}
                </p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>Warning:</strong> Cancelling this sale will restore the inventory quantities for all items in this order.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Cancellation Reason <span className="text-red-500">*</span></Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="Enter the reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={cancelling}>
              Keep Sale
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelSale} 
              disabled={cancelling || !cancelReason.trim()}
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
