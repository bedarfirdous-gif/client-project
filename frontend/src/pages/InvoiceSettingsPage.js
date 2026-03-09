import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  FileText, Save, Upload, Building2, CreditCard, Phone, Mail, 
  Globe, Image as ImageIcon, Hash, Settings, Printer, Facebook,
  Instagram, MessageCircle, RefreshCw, Eye, X, Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

export default function InvoiceSettingsPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  // Initialize to an empty object instead of null to prevent a flash where
  // form fields briefly render with fallback values and then update after fetch.
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api('/api/invoice-settings');
      setSettings(data);
    } catch (err) {
      toast.error('Failed to load invoice settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api('/api/invoice-settings', { 
        method: 'PUT', 
        body: JSON.stringify(settings) 
      });
      toast.success('Invoice settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/uploads/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        // Construct full URL for the logo
        const logoUrl = data.url.startsWith('http') 
          ? data.url 
          : `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
        setSettings({ ...settings, company_logo: logoUrl });
        toast.success('Logo uploaded successfully');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to upload logo');
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error('Failed to upload logo');
    }
  };

  const updateSetting = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="invoice-settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Invoice Settings
          </h1>
          <p className="text-muted-foreground">Your personal invoice settings - customize independently</p>
          <p className="text-xs text-green-600 mt-1">✓ Your settings are saved per user and won't affect other users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="w-4 h-4 mr-2" /> Preview
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="business">Business Info</TabsTrigger>
          <TabsTrigger value="invoice-name">Invoice Title</TabsTrigger>
          <TabsTrigger value="format">Invoice Format</TabsTrigger>
          <TabsTrigger value="print">Print Settings</TabsTrigger>
          <TabsTrigger value="terms">Terms & Footer</TabsTrigger>
          <TabsTrigger value="bank">Bank Details</TabsTrigger>
        </TabsList>

        {/* Invoice Templates Tab - NEW */}
        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Invoice Templates
              </CardTitle>
              <CardDescription>Choose from ready-to-use professional invoice templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Template 1: Classic */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'classic' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'classic')}
                >
                  {settings?.template === 'classic' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border rounded mb-3 p-2 text-[6px]">
                    <div className="text-center font-bold text-[8px] mb-1">COMPANY NAME</div>
                    <div className="text-center text-gray-500 mb-2">Address Line</div>
                    <div className="border-b mb-1"></div>
                    <div className="font-bold text-[7px] mb-1">TAX INVOICE</div>
                    <div className="flex justify-between text-gray-600 mb-2">
                      <span>Invoice #</span><span>Date</span>
                    </div>
                    <div className="border mb-1">
                      <div className="bg-gray-100 p-0.5 flex text-[5px]">
                        <span className="flex-1">Item</span>
                        <span className="w-8">Qty</span>
                        <span className="w-10 text-right">Amount</span>
                      </div>
                      <div className="p-0.5 flex text-[5px]">
                        <span className="flex-1">Product 1</span>
                        <span className="w-8">2</span>
                        <span className="w-10 text-right">{currencySymbol}500</span>
                      </div>
                    </div>
                    <div className="text-right font-bold">Total: {currencySymbol}500</div>
                  </div>
                  <h3 className="font-semibold">Classic</h3>
                  <p className="text-xs text-gray-500">Traditional layout, clean and professional</p>
                </div>

                {/* Template 2: Modern */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'modern' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'modern')}
                >
                  {settings?.template === 'modern' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-white border rounded mb-3 p-2 text-[6px]">
                    <div className="flex justify-between items-start mb-2">
                      <div className="w-8 h-8 bg-blue-500 rounded"></div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600 text-[8px]">INVOICE</div>
                        <div className="text-gray-500">#INV-001</div>
                      </div>
                    </div>
                    <div className="bg-blue-500 text-white p-1 rounded text-[5px] mb-2">
                      <div className="flex justify-between">
                        <span>Item</span><span>Amount</span>
                      </div>
                    </div>
                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between text-[5px]">
                        <span>Service 1</span><span>{currencySymbol}1,000</span>
                      </div>
                    </div>
                    <div className="border-t pt-1 text-right">
                      <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-[6px]">{currencySymbol}1,000</span>
                    </div>
                  </div>
                  <h3 className="font-semibold">Modern</h3>
                  <p className="text-xs text-gray-500">Contemporary design with color accents</p>
                </div>

                {/* Template 3: Minimal */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'minimal' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'minimal')}
                >
                  {settings?.template === 'minimal' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border rounded mb-3 p-3 text-[6px]">
                    <div className="text-[10px] font-light tracking-widest mb-3">INVOICE</div>
                    <div className="space-y-2 mb-3">
                      <div className="text-gray-400 text-[5px]">TO</div>
                      <div>Customer Name</div>
                    </div>
                    <div className="border-t border-gray-200 pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Item</span>
                        <span>{currencySymbol}500</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-medium">
                      <span>Total</span>
                      <span>{currencySymbol}500</span>
                    </div>
                  </div>
                  <h3 className="font-semibold">Minimal</h3>
                  <p className="text-xs text-gray-500">Clean, simple, lots of whitespace</p>
                </div>

                {/* Template 4: GST Compliant */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'gst' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'gst')}
                >
                  {settings?.template === 'gst' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border-2 border-gray-300 rounded mb-3 p-2 text-[5px]">
                    <div className="text-center border-b pb-1 mb-1">
                      <div className="font-bold text-[7px]">TAX INVOICE</div>
                      <div className="text-[5px]">GSTIN: 29XXXXX1234X1ZX</div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[4px] mb-1">
                      <div className="border p-0.5"><strong>Bill To:</strong><br/>Customer</div>
                      <div className="border p-0.5"><strong>Ship To:</strong><br/>Address</div>
                    </div>
                    <table className="w-full border text-[4px] mb-1">
                      <thead className="bg-gray-100">
                        <tr><th className="border p-0.5">Item</th><th className="border p-0.5">HSN</th><th className="border p-0.5">Qty</th><th className="border p-0.5">Rate</th><th className="border p-0.5">CGST</th><th className="border p-0.5">SGST</th></tr>
                      </thead>
                      <tbody>
                        <tr><td className="border p-0.5">Item</td><td className="border p-0.5">1234</td><td className="border p-0.5">1</td><td className="border p-0.5">100</td><td className="border p-0.5">9</td><td className="border p-0.5">9</td></tr>
                      </tbody>
                    </table>
                    <div className="text-right text-[5px]"><strong>Total: {currencySymbol}118</strong></div>
                  </div>
                  <h3 className="font-semibold">GST Compliant</h3>
                  <p className="text-xs text-gray-500">Full GST format with HSN, CGST/SGST</p>
                </div>

                {/* Template 5: Retail Receipt */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'retail' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'retail')}
                >
                  {settings?.template === 'retail' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border rounded mb-3 p-2 text-[5px] font-mono">
                    <div className="text-center mb-1">
                      <div className="text-[8px] font-bold">★ STORE NAME ★</div>
                      <div>123 Main Street</div>
                      <div>Tel: 1234567890</div>
                    </div>
                    <div className="border-t border-dashed my-1"></div>
                    <div className="text-center text-[6px] font-bold mb-1">CASH MEMO</div>
                    <div className="flex justify-between text-[4px] mb-1">
                      <span>Bill#: 001</span>
                      <span>12/02/2026</span>
                    </div>
                    <div className="border-t border-dashed my-1"></div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><span>Item 1 x2</span><span>{currencySymbol}200</span></div>
                      <div className="flex justify-between"><span>Item 2 x1</span><span>{currencySymbol}150</span></div>
                    </div>
                    <div className="border-t border-dashed my-1"></div>
                    <div className="flex justify-between font-bold"><span>TOTAL</span><span>{currencySymbol}350</span></div>
                    <div className="text-center mt-2 text-[4px]">Thank You! Visit Again</div>
                  </div>
                  <h3 className="font-semibold">Retail Receipt</h3>
                  <p className="text-xs text-gray-500">Thermal printer style for POS</p>
                </div>

                {/* Template 6: Professional */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'professional' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'professional')}
                >
                  {settings?.template === 'professional' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border rounded mb-3 overflow-hidden text-[5px]">
                    <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-2">
                      <div className="flex justify-between items-center">
                        <div className="w-6 h-6 bg-white rounded"></div>
                        <div className="text-right">
                          <div className="text-[8px] font-bold">COMPANY</div>
                          <div className="text-[4px] opacity-75">Professional Services</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="flex justify-between mb-2">
                        <div>
                          <div className="text-gray-400 text-[4px]">INVOICE TO</div>
                          <div className="font-medium">Client Name</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-bold text-gray-800">INVOICE</div>
                          <div className="text-gray-500">#2026-001</div>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded p-1 mb-2">
                        <div className="flex justify-between text-[4px] text-gray-500 mb-1">
                          <span>Description</span><span>Amount</span>
                        </div>
                        <div className="flex justify-between"><span>Service</span><span>{currencySymbol}5,000</span></div>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Total Due</span>
                        <span className="text-[7px]">{currencySymbol}5,000</span>
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold">Professional</h3>
                  <p className="text-xs text-gray-500">Executive look with header banner</p>
                </div>

                {/* Template 7: Tally */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'tally' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'tally')}
                >
                  {settings?.template === 'tally' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border-2 border-gray-400 rounded mb-3 p-1.5 text-[4px] font-mono">
                    {/* Tally-style header */}
                    <div className="border-b-2 border-gray-400 pb-1 mb-1">
                      <div className="text-center font-bold text-[7px]">COMPANY NAME</div>
                      <div className="text-center text-[4px]">Address Line 1, City - PIN</div>
                      <div className="text-center text-[4px]">GSTIN: 29XXXXX1234X1ZX | Ph: 9876543210</div>
                    </div>
                    {/* Invoice title */}
                    <div className="text-center font-bold text-[6px] border-b border-gray-300 pb-0.5 mb-1">TAX INVOICE</div>
                    {/* Two column details */}
                    <div className="flex gap-1 mb-1 text-[3.5px]">
                      <div className="flex-1 border border-gray-300 p-0.5">
                        <div><strong>Invoice No:</strong> INV/2026/001</div>
                        <div><strong>Date:</strong> 12-Feb-2026</div>
                        <div><strong>Place of Supply:</strong> Karnataka</div>
                      </div>
                      <div className="flex-1 border border-gray-300 p-0.5">
                        <div><strong>Party Name:</strong></div>
                        <div>Customer Business</div>
                        <div>GSTIN: 29YYYYY5678Y1ZY</div>
                      </div>
                    </div>
                    {/* Items table - Tally style */}
                    <table className="w-full border-collapse text-[3px] mb-1">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-400 p-0.5">Sl</th>
                          <th className="border border-gray-400 p-0.5">Particulars</th>
                          <th className="border border-gray-400 p-0.5">HSN</th>
                          <th className="border border-gray-400 p-0.5">Qty</th>
                          <th className="border border-gray-400 p-0.5">Rate</th>
                          <th className="border border-gray-400 p-0.5">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-gray-400 p-0.5 text-center">1</td>
                          <td className="border border-gray-400 p-0.5">Product Item</td>
                          <td className="border border-gray-400 p-0.5 text-center">6203</td>
                          <td className="border border-gray-400 p-0.5 text-center">2 Pcs</td>
                          <td className="border border-gray-400 p-0.5 text-right">500.00</td>
                          <td className="border border-gray-400 p-0.5 text-right">1,000.00</td>
                        </tr>
                      </tbody>
                    </table>
                    {/* Tax breakdown - Tally style */}
                    <div className="flex justify-end mb-1">
                      <div className="w-1/2 text-[3px]">
                        <div className="flex justify-between border-b border-gray-200 py-0.5">
                          <span>Taxable Value</span><span>1,000.00</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 py-0.5">
                          <span>CGST @9%</span><span>90.00</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 py-0.5">
                          <span>SGST @9%</span><span>90.00</span>
                        </div>
                        <div className="flex justify-between font-bold pt-0.5 border-t-2 border-gray-400">
                          <span>Grand Total</span><span>{currencySymbol}1,180.00</span>
                        </div>
                      </div>
                    </div>
                    {/* Amount in words */}
                    <div className="text-[3px] border-t border-gray-300 pt-0.5">
                      <strong>Amount in Words:</strong> One Thousand One Hundred Eighty Only
                    </div>
                  </div>
                  <h3 className="font-semibold">Tally Style</h3>
                  <p className="text-xs text-gray-500">Classic Tally ERP format for accounting</p>
                </div>

                {/* Template 8: Tally Prime */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'tally_prime' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'tally_prime')}
                >
                  {settings?.template === 'tally_prime' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border rounded mb-3 overflow-hidden text-[4px]">
                    {/* Tally Prime style header - Yellow accent */}
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-1.5">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-bold text-[7px] text-gray-800">COMPANY NAME</div>
                          <div className="text-[4px] text-gray-700">GSTIN: 29XXXXX1234X1ZX</div>
                        </div>
                        <div className="bg-white px-1.5 py-0.5 rounded text-[6px] font-bold text-yellow-600">
                          TAX INVOICE
                        </div>
                      </div>
                    </div>
                    <div className="p-1.5">
                      {/* Invoice details row */}
                      <div className="flex justify-between text-[3.5px] mb-1 pb-1 border-b border-yellow-200">
                        <div><strong>No:</strong> INV/001</div>
                        <div><strong>Date:</strong> 12-Feb-2026</div>
                        <div><strong>Due:</strong> 12-Mar-2026</div>
                      </div>
                      {/* Bill to */}
                      <div className="bg-yellow-50 rounded p-1 mb-1 text-[3.5px]">
                        <div className="font-bold text-yellow-700 mb-0.5">BILL TO:</div>
                        <div>Customer Name</div>
                        <div className="text-gray-500">GSTIN: 29YYYYY5678Y1ZY</div>
                      </div>
                      {/* Items */}
                      <div className="mb-1">
                        <div className="flex bg-yellow-100 text-[3px] font-bold p-0.5 rounded-t">
                          <span className="flex-1">Item</span>
                          <span className="w-6 text-center">Qty</span>
                          <span className="w-8 text-right">Rate</span>
                          <span className="w-10 text-right">Amount</span>
                        </div>
                        <div className="flex text-[3px] p-0.5 border-b border-yellow-100">
                          <span className="flex-1">Product</span>
                          <span className="w-6 text-center">2</span>
                          <span className="w-8 text-right">500</span>
                          <span className="w-10 text-right">1,000</span>
                        </div>
                      </div>
                      {/* Totals */}
                      <div className="bg-yellow-50 rounded p-1 text-[3.5px]">
                        <div className="flex justify-between"><span>Subtotal</span><span>1,000.00</span></div>
                        <div className="flex justify-between text-gray-500"><span>CGST 9%</span><span>90.00</span></div>
                        <div className="flex justify-between text-gray-500"><span>SGST 9%</span><span>90.00</span></div>
                        <div className="flex justify-between font-bold text-[4px] border-t border-yellow-300 mt-0.5 pt-0.5">
                          <span>Total</span><span className="text-yellow-700">{currencySymbol}1,180.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold">Tally Prime</h3>
                  <p className="text-xs text-gray-500">Modern Tally Prime style with yellow accent</p>
                </div>

                {/* Template 9: E-Invoice (GST) */}
                <div 
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                    settings?.template === 'einvoice' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'
                  }`}
                  onClick={() => updateSetting('template', 'einvoice')}
                >
                  {settings?.template === 'einvoice' && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="aspect-[3/4] bg-white border-2 border-green-300 rounded mb-3 p-1.5 text-[4px]">
                    {/* E-Invoice header with QR */}
                    <div className="flex justify-between items-start border-b border-green-200 pb-1 mb-1">
                      <div>
                        <div className="font-bold text-[7px]">e-Invoice</div>
                        <div className="text-green-600 text-[4px]">IRN: a1b2c3d4e5...</div>
                        <div className="text-[3px] text-gray-500">Ack No: 1234567890</div>
                      </div>
                      <div className="w-10 h-10 bg-gray-200 border flex items-center justify-center text-[4px] text-gray-400">
                        QR
                      </div>
                    </div>
                    {/* Company details */}
                    <div className="text-center mb-1 pb-1 border-b border-gray-200">
                      <div className="font-bold text-[6px]">COMPANY NAME</div>
                      <div className="text-[3px]">Address | GSTIN: 29XXXXX1234X1ZX</div>
                    </div>
                    {/* Buyer/Seller */}
                    <div className="grid grid-cols-2 gap-1 text-[3px] mb-1">
                      <div className="border border-green-200 p-0.5 rounded">
                        <div className="font-bold text-green-700">Seller:</div>
                        <div>Company Name</div>
                        <div>GSTIN: 29XXX...</div>
                      </div>
                      <div className="border border-green-200 p-0.5 rounded">
                        <div className="font-bold text-green-700">Buyer:</div>
                        <div>Customer Name</div>
                        <div>GSTIN: 29YYY...</div>
                      </div>
                    </div>
                    {/* Items */}
                    <table className="w-full text-[3px] mb-1">
                      <thead className="bg-green-50">
                        <tr>
                          <th className="border border-green-200 p-0.5">HSN</th>
                          <th className="border border-green-200 p-0.5">Item</th>
                          <th className="border border-green-200 p-0.5">Qty</th>
                          <th className="border border-green-200 p-0.5">Tax</th>
                          <th className="border border-green-200 p-0.5">Amt</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-green-200 p-0.5">6203</td>
                          <td className="border border-green-200 p-0.5">Product</td>
                          <td className="border border-green-200 p-0.5">2</td>
                          <td className="border border-green-200 p-0.5">18%</td>
                          <td className="border border-green-200 p-0.5">1,180</td>
                        </tr>
                      </tbody>
                    </table>
                    {/* Total */}
                    <div className="bg-green-50 p-1 rounded text-right">
                      <div className="font-bold text-[5px] text-green-700">Total: {currencySymbol}1,180.00</div>
                    </div>
                  </div>
                  <h3 className="font-semibold">E-Invoice (GST)</h3>
                  <p className="text-xs text-gray-500">GST e-Invoice with IRN & QR code</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Selected Template: {settings?.template || 'classic'}</h4>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  Your invoices will be generated using this template. You can customize colors, fonts, and content in the other tabs.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice Title/Name Tab - NEW */}
        <TabsContent value="invoice-name" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Invoice Title / Name
              </CardTitle>
              <CardDescription>Set your custom invoice title that will appear on all your invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>📌 Note:</strong> This invoice title is specific to YOUR account only. 
                  Other users have their own independent settings.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-lg font-semibold">Invoice Title *</Label>
                  <Input
                    value={settings?.invoice_title || 'Tax Invoice'}
                    onChange={(e) => updateSetting('invoice_title', e.target.value)}
                    placeholder="e.g., Tax Invoice – Delhi Branch"
                    className="text-lg h-12"
                  />
                  <p className="text-sm text-muted-foreground">
                    Examples: "Tax Invoice", "Retail Invoice – Kashmir", "GST Invoice", "Proforma Invoice"
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select
                    value={settings?.date_format || 'DD/MM/YYYY'}
                    onValueChange={(val) => updateSetting('date_format', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (08/02/2026)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (02/08/2026)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-02-08)</SelectItem>
                      <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY (08-Feb-2026)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview of Invoice Title */}
              <div className="mt-6 p-6 border rounded-lg bg-white dark:bg-gray-900">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <h2 className="text-2xl font-bold text-center text-primary">
                  {settings?.invoice_title || 'Tax Invoice'}
                </h2>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Info Tab */}
        <TabsContent value="business" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Information
              </CardTitle>
              <CardDescription>Your company details that will appear on invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-accent/30">
                  {settings?.company_logo ? (
                    <img loading="lazy" src={settings.company_logo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <Label>Company Logo</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload your company logo (PNG, JPG, max 2MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Upload Logo
                  </Button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={settings?.company_name || ''}
                    onChange={(e) => updateSetting('company_name', e.target.value)}
                    placeholder="Your Business Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={settings?.company_phone || ''}
                      onChange={(e) => updateSetting('company_phone', e.target.value)}
                      placeholder="+91 9876543210"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp Number
                  </Label>
                  <div className="relative">
                    <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <Input
                      value={settings?.whatsapp_number || ''}
                      onChange={(e) => updateSetting('whatsapp_number', e.target.value)}
                      placeholder="+91 9876543210 (for catalogue orders)"
                      className="pl-10 pr-24"
                    />
                    {settings?.company_phone && !settings?.whatsapp_number && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => updateSetting('whatsapp_number', settings.company_phone)}
                      >
                        Copy Phone
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Customers will send orders to this WhatsApp number from your catalogue</p>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={settings?.company_email || ''}
                      onChange={(e) => updateSetting('company_email', e.target.value)}
                      placeholder="contact@business.com"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={settings?.company_website || ''}
                      onChange={(e) => updateSetting('company_website', e.target.value)}
                      placeholder="www.business.com"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Business Address</Label>
                  <Textarea
                    value={settings?.company_address || ''}
                    onChange={(e) => updateSetting('company_address', e.target.value)}
                    placeholder="Complete business address..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input
                    value={settings?.gstin || ''}
                    onChange={(e) => updateSetting('gstin', e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PAN</Label>
                  <Input
                    value={settings?.pan || ''}
                    onChange={(e) => updateSetting('pan', e.target.value.toUpperCase())}
                    placeholder="AAAAA0000A"
                    maxLength={10}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice Format Tab */}
        <TabsContent value="format" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Invoice Numbering
              </CardTitle>
              <CardDescription>Configure invoice number format, prefixes and suffixes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Prefix</Label>
                  <Input
                    value={settings?.invoice_prefix || 'INV-'}
                    onChange={(e) => updateSetting('invoice_prefix', e.target.value)}
                    placeholder="INV-"
                  />
                  <p className="text-xs text-muted-foreground">Appears before the number</p>
                </div>
                <div className="space-y-2">
                  <Label>Invoice Suffix (Optional)</Label>
                  <Input
                    value={settings?.invoice_suffix || ''}
                    onChange={(e) => updateSetting('invoice_suffix', e.target.value)}
                    placeholder="-2026"
                  />
                  <p className="text-xs text-muted-foreground">Appears after the number</p>
                </div>
                <div className="space-y-2">
                  <Label>Starting Number</Label>
                  <Input
                    type="number"
                    value={settings?.invoice_starting_number || 1}
                    onChange={(e) => updateSetting('invoice_starting_number', parseInt(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Preview</Label>
                  <div className="p-3 bg-accent rounded-lg font-mono">
                    {settings?.invoice_prefix || 'INV-'}000001{settings?.invoice_suffix || ''}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quotation Prefix</Label>
                  <Input
                    value={settings?.quotation_prefix || 'QTN-'}
                    onChange={(e) => updateSetting('quotation_prefix', e.target.value)}
                    placeholder="QTN-"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Order Prefix</Label>
                  <Input
                    value={settings?.order_prefix || 'ORD-'}
                    onChange={(e) => updateSetting('order_prefix', e.target.value)}
                    placeholder="ORD-"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Print Settings Tab */}
        <TabsContent value="print" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                Print Settings
              </CardTitle>
              <CardDescription>Configure how invoices are printed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Paper Size</Label>
                  <Select
                    value={settings?.paper_size || 'A4'}
                    onValueChange={(val) => updateSetting('paper_size', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                      <SelectItem value="A5">A5 (148 x 210 mm)</SelectItem>
                      <SelectItem value="thermal">Thermal (80mm)</SelectItem>
                      <SelectItem value="letter">Letter (8.5 x 11 in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select
                    value={settings?.font_size || 'medium'}
                    onValueChange={(val) => updateSetting('font_size', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <p className="font-medium text-sm">Show on Invoice:</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Company Logo</Label>
                    <Switch
                      checked={settings?.show_logo !== false}
                      onCheckedChange={(val) => updateSetting('show_logo', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>GST Fields</Label>
                    <Switch
                      checked={settings?.show_gst_fields !== false}
                      onCheckedChange={(val) => updateSetting('show_gst_fields', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>GSTIN Number</Label>
                    <Switch
                      checked={settings?.show_gstin !== false}
                      onCheckedChange={(val) => updateSetting('show_gstin', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>HSN Code</Label>
                    <Switch
                      checked={settings?.show_hsn !== false}
                      onCheckedChange={(val) => updateSetting('show_hsn', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Discount Column</Label>
                    <Switch
                      checked={settings?.show_discount !== false}
                      onCheckedChange={(val) => updateSetting('show_discount', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Item Images</Label>
                    <Switch
                      checked={settings?.show_item_images}
                      onCheckedChange={(val) => updateSetting('show_item_images', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Terms & Conditions</Label>
                    <Switch
                      checked={settings?.show_terms !== false}
                      onCheckedChange={(val) => updateSetting('show_terms', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Signature</Label>
                    <Switch
                      checked={settings?.show_signature !== false}
                      onCheckedChange={(val) => updateSetting('show_signature', val)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Social Links</Label>
                    <Switch
                      checked={settings?.show_social_links !== false}
                      onCheckedChange={(val) => updateSetting('show_social_links', val)}
                    />
                  </div>
                </div>
              </div>
              
              {/* Signature Upload */}
              {settings?.show_signature !== false && (
                <div className="space-y-4 pt-4 border-t">
                  <p className="font-medium text-sm">Signature Image:</p>
                  <div className="flex items-start gap-4">
                    <div className="w-48 h-24 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-accent/30">
                      {settings?.signature_image ? (
                        <img loading="lazy" src={settings.signature_image} alt="Signature" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-sm text-muted-foreground">No signature</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label>Upload Signature Image</Label>
                      <p className="text-sm text-muted-foreground mb-2">PNG with transparent background recommended</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 1 * 1024 * 1024) {
                            toast.error('File size must be less than 1MB');
                            return;
                          }
                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/uploads/images`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                              body: formData
                            });
                            if (response.ok) {
                              const data = await response.json();
                              const signatureUrl = data.url.startsWith('http') ? data.url : `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
                              updateSetting('signature_image', signatureUrl);
                              toast.success('Signature uploaded');
                            }
                          } catch (err) {
                            toast.error('Failed to upload signature');
                          }
                        }}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Terms & Footer Tab */}
        <TabsContent value="terms" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Terms & Footer</CardTitle>
              <CardDescription>Text that appears at the bottom of invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={settings?.terms_and_conditions || ''}
                  onChange={(e) => updateSetting('terms_and_conditions', e.target.value)}
                  placeholder="Payment terms, delivery conditions, etc..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Return Policy</Label>
                <Textarea
                  value={settings?.return_policy || ''}
                  onChange={(e) => updateSetting('return_policy', e.target.value)}
                  placeholder="Return and exchange policy..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Warranty Information</Label>
                <Textarea
                  value={settings?.warranty_info || ''}
                  onChange={(e) => updateSetting('warranty_info', e.target.value)}
                  placeholder="Product warranty details..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Input
                  value={settings?.footer_text || 'Thank you for your business!'}
                  onChange={(e) => updateSetting('footer_text', e.target.value)}
                  placeholder="Thank you message..."
                />
              </div>

              <div className="pt-4 border-t space-y-4">
                <p className="font-medium text-sm">Social Media Links</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Facebook className="w-4 h-4 text-blue-600" /> Facebook
                    </Label>
                    <Input
                      value={settings?.facebook_url || ''}
                      onChange={(e) => updateSetting('facebook_url', e.target.value)}
                      placeholder="facebook.com/yourpage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-600" /> Instagram
                    </Label>
                    <Input
                      value={settings?.instagram_url || ''}
                      onChange={(e) => updateSetting('instagram_url', e.target.value)}
                      placeholder="instagram.com/yourpage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
                    </Label>
                    <Input
                      value={settings?.whatsapp_number || ''}
                      onChange={(e) => updateSetting('whatsapp_number', e.target.value)}
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Details Tab */}
        <TabsContent value="bank" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Bank & Payment Details
              </CardTitle>
              <CardDescription>Payment information for customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={settings?.bank_name || ''}
                    onChange={(e) => updateSetting('bank_name', e.target.value)}
                    placeholder="State Bank of India"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={settings?.account_number || ''}
                    onChange={(e) => updateSetting('account_number', e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input
                    value={settings?.ifsc_code || ''}
                    onChange={(e) => updateSetting('ifsc_code', e.target.value.toUpperCase())}
                    placeholder="SBIN0001234"
                  />
                </div>
                <div className="space-y-2">
                  <Label>UPI ID</Label>
                  <Input
                    value={settings?.upi_id || ''}
                    onChange={(e) => updateSetting('upi_id', e.target.value)}
                    placeholder="yourname@upi"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Invoice Preview
            </DialogTitle>
          </DialogHeader>
          
          {/* Sample Invoice Preview */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div className="flex items-start gap-4">
                {settings?.company_logo && settings?.show_logo ? (
                  <img loading="lazy" src={settings.company_logo} alt="Logo" className="w-20 h-20 object-contain" />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{settings?.company_name || 'Your Company Name'}</h2>
                  <p className="text-sm text-gray-600">{settings?.company_address || '123 Business Street, City'}</p>
                  {settings?.company_phone && <p className="text-sm text-gray-600">📞 {settings.company_phone}</p>}
                  {settings?.company_email && <p className="text-sm text-gray-600">✉️ {settings.company_email}</p>}
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold text-primary">{settings?.invoice_title || 'Tax Invoice'}</h1>
                <p className="text-sm text-gray-600">{settings?.invoice_prefix || 'INV-'}{settings?.invoice_starting_number || '0001'}{settings?.invoice_suffix || ''}</p>
                <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Customer & Tax Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="font-medium text-gray-700">Bill To:</p>
                <p className="text-gray-900">Sample Customer</p>
                <p className="text-sm text-gray-600">customer@example.com</p>
                <p className="text-sm text-gray-600">+91 9876543210</p>
              </div>
              <div className="text-right">
                {settings?.show_gstin && settings?.gstin && (
                  <p className="text-sm text-gray-600">GSTIN: {settings.gstin}</p>
                )}
                {settings?.pan && (
                  <p className="text-sm text-gray-600">PAN: {settings.pan}</p>
                )}
              </div>
            </div>

            {/* Sample Items Table */}
            <table className="w-full mb-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 text-sm font-medium">#</th>
                  <th className="text-left p-2 text-sm font-medium">Item</th>
                  {settings?.show_hsn && <th className="text-left p-2 text-sm font-medium">HSN</th>}
                  <th className="text-center p-2 text-sm font-medium">Qty</th>
                  <th className="text-right p-2 text-sm font-medium">Rate</th>
                  <th className="text-right p-2 text-sm font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 text-sm">1</td>
                  <td className="p-2 text-sm">Sample Product A</td>
                  {settings?.show_hsn && <td className="p-2 text-sm">1234</td>}
                  <td className="p-2 text-sm text-center">2</td>
                  <td className="p-2 text-sm text-right">{currencySymbol}500.00</td>
                  <td className="p-2 text-sm text-right">{currencySymbol}1,000.00</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-sm">2</td>
                  <td className="p-2 text-sm">Sample Product B</td>
                  {settings?.show_hsn && <td className="p-2 text-sm">5678</td>}
                  <td className="p-2 text-sm text-center">1</td>
                  <td className="p-2 text-sm text-right">{currencySymbol}750.00</td>
                  <td className="p-2 text-sm text-right">{currencySymbol}750.00</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-64">
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{currencySymbol}1,750.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Tax (18%):</span>
                  <span>{currencySymbol}315.00</span>
                </div>
                <div className="flex justify-between py-2 border-t font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">{currencySymbol}2,065.00</span>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            {(settings?.bank_name || settings?.upi_id) && (
              <div className="bg-gray-50 rounded p-3 mb-4">
                <p className="font-medium text-sm text-gray-700 mb-2">Payment Details:</p>
                {settings?.bank_name && (
                  <p className="text-sm text-gray-600">Bank: {settings.bank_name} | A/C: {settings.account_number} | IFSC: {settings.ifsc_code}</p>
                )}
                {settings?.upi_id && (
                  <p className="text-sm text-gray-600">UPI: {settings.upi_id}</p>
                )}
              </div>
            )}

            {/* Terms & Footer */}
            {settings?.show_terms && settings?.terms_and_conditions && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700">Terms & Conditions:</p>
                <p className="text-xs text-gray-600">{settings.terms_and_conditions}</p>
              </div>
            )}

            {/* Signature */}
            {settings?.show_signature && (
              <div className="flex justify-end mb-4">
                <div className="text-center">
                  {settings?.signature_image ? (
                    <img loading="lazy" src={settings.signature_image} alt="Signature" className="w-32 h-16 object-contain mb-1" />
                  ) : (
                    <div className="w-32 h-16 border-b border-gray-400 mb-1"></div>
                  )}
                  <p className="text-xs text-gray-600">Authorized Signature</p>
                </div>
              </div>
            )}

            {/* Social Links */}
            {settings?.show_social_links && (settings?.facebook_url || settings?.instagram_url || settings?.whatsapp_number) && (
              <div className="flex gap-4 justify-center pt-3 border-t">
                {settings?.facebook_url && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Facebook className="w-3 h-3" /> {settings.facebook_url}
                  </span>
                )}
                {settings?.instagram_url && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Instagram className="w-3 h-3" /> {settings.instagram_url}
                  </span>
                )}
                {settings?.whatsapp_number && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {settings.whatsapp_number}
                  </span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-4 pt-3 border-t">
              <p className="text-sm text-gray-600">{settings?.footer_text || 'Thank you for your business!'}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
