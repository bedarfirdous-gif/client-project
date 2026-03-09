import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ThermalInvoice from '../components/ThermalInvoice';
import { 
  FileText, Plus, Search, Filter, Download, Send, Eye, Edit, Trash2,
  Calendar, DollarSign, User, Building2, Package, Percent, Calculator,
  CheckCircle, Clock, AlertCircle, XCircle, CreditCard, Banknote,
  Smartphone, ChevronDown, ChevronUp, Printer, Mail, RefreshCw,
  MoreVertical, Copy, ArrowRight, Share2, Receipt
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

// Invoice status configurations
const INVOICE_STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-500', icon: Edit },
  sent: { label: 'Sent', color: 'bg-blue-500', icon: Send },
  paid: { label: 'Paid', color: 'bg-green-500', icon: CheckCircle },
  partial: { label: 'Partially Paid', color: 'bg-amber-500', icon: Clock },
  overdue: { label: 'Overdue', color: 'bg-red-500', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-400', icon: XCircle },
};

// Payment methods
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank', label: 'Bank Transfer', icon: Building2 },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'cheque', label: 'Cheque', icon: FileText },
];

// Payment terms
const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Due on Receipt', days: 0 },
  { value: 'net7', label: 'Net 7', days: 7 },
  { value: 'net15', label: 'Net 15', days: 15 },
  { value: 'net30', label: 'Net 30', days: 30 },
  { value: 'net45', label: 'Net 45', days: 45 },
  { value: 'net60', label: 'Net 60', days: 60 },
  { value: 'custom', label: 'Custom', days: null },
];

// Currency options
const CURRENCIES = [
  { value: 'INR', label: '₹ INR', symbol: '₹' },
  { value: 'USD', label: '$ USD', symbol: '$' },
  { value: 'EUR', label: '€ EUR', symbol: '€' },
  { value: 'GBP', label: '£ GBP', symbol: '£' },
];

// Indian States list for GST
const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

// Get state from GST number
const getStateFromGST = (gstNumber) => {
  if (!gstNumber || gstNumber.length < 2) return null;
  const stateCode = gstNumber.substring(0, 2);
  return INDIAN_STATES.find(s => s.code === stateCode);
};

export default function InvoicesPage() {
  const { api, user } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();
  const [invoices, setInvoices] = useState([]);
  const [timeout, setTimeout] = useState(false);
  const [date, setDate] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  // FIX: avoid `null` initial state which can cause a visual flash when UI conditionally
  // renders based on selectedInvoice (e.g., selectedInvoice && <Modal />).
  // Use a stable empty object and treat "selected" as having a valid id.
  const [selectedInvoice, setSelectedInvoice] = useState({});
  const hasSelectedInvoice = Boolean(selectedInvoice && selectedInvoice.id);
  const [saving, setSaving] = useState(false);

  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_terms: 'net30',
    currency: 'INR',
    tax_inclusive: false,
    line_items: [],
    notes: '',
    terms: '',
    discount_type: 'none', // none, percentage, fixed
    discount_value: 0,
    shipping_charges: 0,
    status: 'draft',
  });

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'cash',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Invoice settings (for PDF/Print)
  // Invoice settings (for PDF/Print)
  // FIX: avoid null initial state which can cause a visual flash when UI conditionally renders
  // based on presence of settings. Use an explicit loaded flag for stable initial render.
  const [invoiceSettings, setInvoiceSettings] = useState({});
  const [invoiceSettingsLoaded, setInvoiceSettingsLoaded] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const printRef = useRef(null);
  
  // Thermal Print state
  const [showThermalPrint, setShowThermalPrint] = useState(false);
  const [thermalPaperWidth, setThermalPaperWidth] = useState('80mm');
  const thermalRef = useRef(null);
  
  // Interstate transaction state (IGST vs CGST+SGST)
  // FIX: avoid null initial state to prevent mount/unmount flicker in dependent UI
  const [isInterstate, setIsInterstate] = useState(false);
  const [customerState, setCustomerState] = useState('');
  const [sellerState, setSellerState] = useState('');

  useEffect(() => {
    fetchData();
    fetchInvoiceSettings();
  }, []);
  
  // Check if transaction is interstate when customer changes
  useEffect(() => {
    if (invoiceForm.customer_id && invoiceSettings) {
      const customer = customers.find(c => c.id === invoiceForm.customer_id);
      
      // Get customer state from GST number or state field
      let custState = customer?.state;
      if (!custState && customer?.gst_number) {
        const stateFromGST = getStateFromGST(customer.gst_number);
        custState = stateFromGST?.name;
      }
      
      // Get seller/company state from invoice settings
      let companyState = invoiceSettings?.state;
      if (!companyState && invoiceSettings?.gstin) {
        const stateFromGST = getStateFromGST(invoiceSettings.gstin);
        companyState = stateFromGST?.name;
      }
      
      setCustomerState(custState);
      setSellerState(companyState);
      
      // Interstate if states are different
      const interstate = custState && companyState && custState !== companyState;
      setIsInterstate(interstate);
      
      if (interstate) {
        toast.info(`Interstate transaction: IGST applicable (${companyState} → ${custState})`);
      }
    }
  }, [invoiceForm.customer_id, customers, invoiceSettings]);

  // Fetch invoice settings for branding
  const fetchInvoiceSettings = async () => {
    try {
      const settings = await api('/api/invoice-settings').catch(() => null);
      setInvoiceSettings(settings);
    } catch (err) {
      console.log('Invoice settings not configured');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoicesData, customersData, itemsData] = await Promise.all([
        api('/api/invoices').catch(() => []),
        api('/api/customers').catch(() => []),
        api('/api/items').catch(() => []),
      ]);
      setInvoices(invoicesData);
      setCustomers(customersData);
      setItems(itemsData);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${year}${month}-${random}`;
  };

  // Calculate due date based on payment terms
  const calculateDueDate = (issueDate, terms) => {
    const term = PAYMENT_TERMS.find(t => t.value === terms);
    if (!term || term.days === null) return '';
    
    const date = new Date(issueDate);
    date.setDate(date.getDate() + term.days);
    return date.toISOString().split('T')[0];
  };

  // Open create invoice modal
  const openCreateInvoice = () => {
    const invoiceNumber = generateInvoiceNumber();
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = calculateDueDate(issueDate, 'net30');
    
    setInvoiceForm({
      invoice_number: invoiceNumber,
      customer_id: '',
      issue_date: issueDate,
      due_date: dueDate,
      payment_terms: 'net30',
      currency: 'INR',
      tax_inclusive: false,
      line_items: [{ id: Date.now(), item_id: '', description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 18 }],
      notes: '',
      terms: 'Payment due within the specified period. Late payments may incur additional charges.',
      discount_type: 'none',
      discount_value: 0,
      shipping_charges: 0,
      status: 'draft',
    });
    setSelectedInvoice(null);
    setShowInvoiceModal(true);
  };

  // Open edit invoice modal
  const openEditInvoice = (invoice) => {
    setInvoiceForm({
      ...invoice,
      line_items: invoice.line_items || [],
    });
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  // Add line item
  const addLineItem = () => {
    setInvoiceForm(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        { id: Date.now(), item_id: '', description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 18 }
      ]
    }));
  };

  // Remove line item
  const removeLineItem = (id) => {
    setInvoiceForm(prev => ({
      ...prev,
      line_items: prev.line_items.filter(item => item.id !== id)
    }));
  };

  // Update line item
  const updateLineItem = (id, field, value) => {
    setInvoiceForm(prev => ({
      ...prev,
      line_items: prev.line_items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          
          // Auto-populate from items catalog
          if (field === 'item_id' && value) {
            const catalogItem = items.find(i => i.id === value);
            if (catalogItem) {
              updated.description = catalogItem.name;
              updated.unit_price = catalogItem.selling_price || catalogItem.price || 0;
            }
          }
          
          return updated;
        }
        return item;
      })
    }));
  };

  // Calculate line item total
  const calculateLineTotal = (item) => {
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = (subtotal * (item.discount || 0)) / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = invoiceForm.tax_inclusive ? 0 : (afterDiscount * (item.tax_rate || 0)) / 100;
    return afterDiscount + taxAmount;
  };

  // Calculate invoice totals
  const calculateTotals = () => {
    const lineItems = invoiceForm.line_items || [];
    
    let subtotal = 0;
    let totalTax = 0;
    let totalItemDiscount = 0;
    
    lineItems.forEach(item => {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const afterItemDiscount = itemSubtotal - itemDiscount;
      const itemTax = invoiceForm.tax_inclusive ? 0 : (afterItemDiscount * (item.tax_rate || 0)) / 100;
      
      subtotal += itemSubtotal;
      totalItemDiscount += itemDiscount;
      totalTax += itemTax;
    });

    // Overall discount
    let overallDiscount = 0;
    if (invoiceForm.discount_type === 'percentage') {
      overallDiscount = ((subtotal - totalItemDiscount) * invoiceForm.discount_value) / 100;
    } else if (invoiceForm.discount_type === 'fixed') {
      overallDiscount = invoiceForm.discount_value;
    }

    const shipping = parseFloat(invoiceForm.shipping_charges) || 0;
    const total = subtotal - totalItemDiscount - overallDiscount + totalTax + shipping;

    return {
      subtotal,
      totalItemDiscount,
      overallDiscount,
      totalDiscount: totalItemDiscount + overallDiscount,
      totalTax,
      shipping,
      total: Math.max(0, total),
    };
  };

  // Save invoice
  const saveInvoice = async (status = 'draft') => {
    if (!invoiceForm.customer_id) {
      toast.error('Please select a customer');
      return;
    }
    
    if (!invoiceForm.line_items || invoiceForm.line_items.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setSaving(true);
    try {
      const totals = calculateTotals();
      const customer = customers.find(c => c.id === invoiceForm.customer_id);
      
      // Calculate CGST, SGST, IGST based on interstate flag
      let cgst_amount = 0, sgst_amount = 0, igst_amount = 0;
      if (isInterstate) {
        igst_amount = totals.totalTax;
      } else {
        cgst_amount = totals.totalTax / 2;
        sgst_amount = totals.totalTax / 2;
      }
      
      const invoiceData = {
        ...invoiceForm,
        status,
        customer_name: customer?.name || '',
        customer_email: customer?.email || '',
        customer_phone: customer?.phone || '',
        customer_address: customer?.address || '',
        customer_gst: customer?.gst_number || '',
        customer_state: customerState || customer?.state || '',
        seller_state: sellerState || '',
        is_interstate: isInterstate,
        cgst_amount,
        sgst_amount,
        igst_amount,
        ...totals,
        payments: selectedInvoice?.payments || [],
        amount_paid: selectedInvoice?.amount_paid || 0,
        balance_due: totals.total - (selectedInvoice?.amount_paid || 0),
      };

      if (selectedInvoice) {
        await api(`/api/invoices/${selectedInvoice.id}`, {
          method: 'PUT',
          body: JSON.stringify(invoiceData),
        });
        toast.success('Invoice updated');
      } else {
        await api('/api/invoices', {
          method: 'POST',
          body: JSON.stringify(invoiceData),
        });
        toast.success('Invoice created');
      }
      
      setShowInvoiceModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save invoice: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Record payment
  const recordPayment = async () => {
    if (!selectedInvoice) return;
    
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await api(`/api/invoices/${selectedInvoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify(paymentForm),
      });
      toast.success('Payment recorded');
      setShowPaymentModal(false);
      setPaymentForm({ amount: 0, method: 'cash', reference: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to record payment: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Open payment modal
  const openPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: invoice.balance_due || invoice.total || 0,
      method: 'cash',
      reference: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowPaymentModal(true);
  };

  // Delete invoice
  const deleteInvoice = async (invoice) => {
    if (!confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    
    try {
      await api(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
      toast.success('Invoice deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete invoice');
    }
  };

  // Update invoice status
  const updateStatus = async (invoice, status) => {
    try {
      await api(`/api/invoices/${invoice.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      toast.success(`Invoice marked as ${INVOICE_STATUSES[status].label}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Print invoice
  const handlePrint = (invoice) => {
    setSelectedInvoice(invoice);
    setShowPrintPreview(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Generate PDF
  const generatePDF = async (invoice) => {
    setGeneratingPdf(true);
    setSelectedInvoice(invoice);
    setShowPrintPreview(true);
    
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const element = printRef.current;
      if (!element) {
        toast.error('Unable to generate PDF');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${invoice.invoice_number || 'invoice'}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
      setShowPrintPreview(false);
    }
  };

  // Thermal Print - compact format for thermal printers
  const handleThermalPrint = (invoice) => {
    setSelectedInvoice(invoice);
    setShowThermalPrint(true);
  };

  // Print thermal invoice
  const printThermal = async () => {
    if (!thermalRef.current) {
      toast.error('Unable to print');
      return;
    }

    try {
      const content = thermalRef.current.innerHTML;
      const is58mm = thermalPaperWidth === '58mm';
      const printWindow = window.open('', '_blank', `width=${is58mm ? 220 : 302},height=600`);
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${selectedInvoice?.invoice_number || ''}</title>
            <style>
              @page {
                size: ${thermalPaperWidth} auto;
                margin: 0;
              }
              @media print {
                body { 
                  margin: 0; 
                  padding: 0;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
              body {
                margin: 0;
                padding: 0;
                font-family: 'Courier New', Courier, monospace;
                background: white;
              }
            </style>
          </head>
          <body>${content}</body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setShowThermalPrint(false);
        toast.success('Sent to printer');
      }, 250);
    } catch (err) {
      console.error('Thermal print error:', err);
      toast.error('Failed to print');
    }
  };

  // Share invoice via WhatsApp - generates PDF and sends link to customer's phone
  const shareInvoice = async (invoice) => {
    // Get customer phone from invoice
    const customerPhone = invoice.customer_phone || '';
    
    if (!customerPhone) {
      toast.error('No customer phone number available for this invoice.');
      return;
    }
    
    try {
      toast.loading('Generating invoice PDF...');
      
      // Generate a proper invoice PDF
      const doc = new jsPDF({ unit: 'mm', format: 'a5' });
      const symbol = getCurrencySymbol(invoice.currency);
      
      let y = 15;
      const lineHeight = 6;
      const leftMargin = 10;
      const rightMargin = 138;
      const pageWidth = 148;
      
      // Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TAX INVOICE', pageWidth / 2, y, { align: 'center' });
      y += lineHeight * 2;
      
      // Invoice details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice #: ${invoice.invoice_number}`, leftMargin, y);
      y += lineHeight;
      doc.text(`Date: ${invoice.issue_date}`, leftMargin, y);
      doc.text(`Due: ${invoice.due_date}`, rightMargin, y, { align: 'right' });
      y += lineHeight;
      doc.text(`Customer: ${invoice.customer_name}`, leftMargin, y);
      y += lineHeight + 3;
      
      // Line
      doc.setDrawColor(200);
      doc.line(leftMargin, y, rightMargin, y);
      y += lineHeight;
      
      // Items header
      doc.setFillColor(240, 240, 240);
      doc.rect(leftMargin, y - 4, rightMargin - leftMargin, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Description', leftMargin + 2, y);
      doc.text('Amount', rightMargin - 2, y, { align: 'right' });
      y += lineHeight + 2;
      
      // Items
      doc.setFont('helvetica', 'normal');
      invoice.items?.forEach(item => {
        doc.text(item.description?.substring(0, 50) || item.name || 'Item', leftMargin + 2, y);
        doc.text(`${symbol}${(item.amount || item.total || 0).toLocaleString()}`, rightMargin - 2, y, { align: 'right' });
        y += lineHeight;
      });
      
      y += 3;
      doc.line(leftMargin, y, rightMargin, y);
      y += lineHeight;
      
      // Subtotal
      doc.setFontSize(9);
      doc.text('Subtotal:', leftMargin + 2, y);
      doc.text(`${symbol}${(invoice.subtotal || 0).toLocaleString()}`, rightMargin - 2, y, { align: 'right' });
      y += lineHeight;
      
      // CGST and SGST breakdown
      if (invoice.totalTax > 0 || invoice.tax_amount > 0) {
        const taxAmount = invoice.totalTax || invoice.tax_amount || 0;
        const gstRate = invoice.gst_rate || 5;
        const cgst = taxAmount / 2;
        const sgst = taxAmount / 2;
        
        doc.text(`CGST (${gstRate / 2}%):`, leftMargin + 2, y);
        doc.text(`${symbol}${cgst.toFixed(2)}`, rightMargin - 2, y, { align: 'right' });
        y += lineHeight;
        
        doc.text(`SGST (${gstRate / 2}%):`, leftMargin + 2, y);
        doc.text(`${symbol}${sgst.toFixed(2)}`, rightMargin - 2, y, { align: 'right' });
        y += lineHeight;
      }
      
      // Discount
      if (invoice.totalDiscount > 0 || invoice.discount_amount > 0) {
        const discount = invoice.totalDiscount || invoice.discount_amount || 0;
        doc.setTextColor(0, 150, 0);
        doc.text('Discount:', leftMargin + 2, y);
        doc.text(`-${symbol}${discount.toFixed(2)}`, rightMargin - 2, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += lineHeight;
      }
      
      y += 2;
      doc.line(leftMargin, y, rightMargin, y);
      y += lineHeight;
      
      // Total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('TOTAL', leftMargin + 2, y);
      doc.text(`${symbol}${(invoice.total || 0).toLocaleString()}`, rightMargin - 2, y, { align: 'right' });
      y += lineHeight;
      
      // Status
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const statusLabel = INVOICE_STATUSES[invoice.status]?.label || invoice.status;
      doc.text(`Status: ${statusLabel}`, leftMargin + 2, y);
      y += lineHeight * 2;
      
      // Footer
      doc.text('Thank you for your business!', pageWidth / 2, y, { align: 'center' });
      
      // Convert to blob and upload
      const pdfBlob = doc.output('blob');
      const formData = new FormData();
      formData.append('file', pdfBlob, `invoice_${invoice.invoice_number}.pdf`);
      
      const uploadResponse = await api('/api/uploads/invoice-pdf', {
        method: 'POST',
        body: formData,
        headers: {}
      });
      
      toast.dismiss();
      
      if (uploadResponse.url) {
        const pdfUrl = `${window.location.origin}${uploadResponse.url}`;
        
        // Format phone number
        let formattedPhone = customerPhone.replace(/\D/g, '');
        if (formattedPhone.length === 10) {
          formattedPhone = '91' + formattedPhone;
        }
        
        const message = `📄 *Invoice ${invoice.invoice_number}*\n\nCustomer: ${invoice.customer_name}\nAmount: ${symbol}${(invoice.total || 0).toLocaleString()}\nStatus: ${statusLabel}\n\n📎 Download PDF:\n${pdfUrl}\n\nThank you for your business!`;
        
        // Copy to clipboard instead of opening new tab
        try {
          await navigator.clipboard.writeText(message);
          toast.success(
            <div>
              <p className="font-semibold">Invoice message copied!</p>
              <p className="text-sm mt-1">Paste in your WhatsApp chat with {invoice.customer_name}.</p>
              <p className="text-xs mt-2 text-gray-500">Phone: {customerPhone}</p>
            </div>,
            { duration: 8000 }
          );
        } catch (clipboardError) {
          window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`, '_blank');
          toast.success('Opening WhatsApp with invoice PDF!');
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast.dismiss();
      console.error('WhatsApp share error:', error);
      
      // Fallback to text - copy to clipboard
      const symbol = getCurrencySymbol(invoice.currency);
      const text = `*Invoice ${invoice.invoice_number}*\n\nCustomer: ${invoice.customer_name}\nDate: ${invoice.issue_date}\nDue: ${invoice.due_date}\nAmount: ${symbol}${(invoice.total || 0).toLocaleString()}\nStatus: ${INVOICE_STATUSES[invoice.status]?.label || invoice.status}\n\nThank you for your business!`;
      
      try {
        await navigator.clipboard.writeText(text);
        toast.success(
          <div>
            <p className="font-semibold">Invoice copied to clipboard!</p>
            <p className="text-sm mt-1">Paste in your WhatsApp chat.</p>
          </div>,
          { duration: 5000 }
        );
      } catch (e) {
        let formattedPhone = (invoice.customer_phone || '').replace(/\D/g, '');
        if (formattedPhone.length === 10) {
          formattedPhone = '91' + formattedPhone;
        }
        
        if (formattedPhone) {
          window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`, '_blank');
        } else {
          toast.error('No customer phone number available');
        }
      }
    }
  };

  // Get currency symbol
  const getCurrencySymbol = (currency) => {
    return CURRENCIES.find(c => c.value === currency)?.symbol || currencySymbol;
  };

  // Format currency for invoices with specific currency override
  const formatInvoiceCurrency = (amount, currency = 'INR') => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    totalAmount: invoices.reduce((sum, i) => sum + (i.total || 0), 0),
    totalPaid: invoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0),
    totalDue: invoices.reduce((sum, i) => sum + (i.balance_due || i.total || 0), 0),
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="invoices-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Invoices
          </h1>
          <p className="text-muted-foreground">Create and manage invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={openCreateInvoice} className="bg-primary">
            <Plus className="w-4 h-4 mr-2" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Due</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalDue)}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(INVOICE_STATUSES).map(([key, status]) => (
              <SelectItem key={key} value={key}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Invoices List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Invoice #</th>
                  <th className="text-left p-4 font-medium">Customer</th>
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Due Date</th>
                  <th className="text-right p-4 font-medium">Amount</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No invoices found</p>
                      <Button variant="link" onClick={openCreateInvoice}>
                        Create your first invoice
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => {
                    const status = INVOICE_STATUSES[invoice.status] || INVOICE_STATUSES.draft;
                    const StatusIcon = status.icon;
                    
                    return (
                      <tr key={invoice.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <span className="font-mono font-medium">{invoice.invoice_number}</span>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{invoice.customer_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{invoice.customer_email}</p>
                        </td>
                        <td className="p-4 text-sm">{invoice.issue_date}</td>
                        <td className="p-4 text-sm">{invoice.due_date}</td>
                        <td className="p-4 text-right">
                          <p className="font-semibold">{formatInvoiceCurrency(invoice.total, invoice.currency)}</p>
                          {invoice.balance_due > 0 && invoice.balance_due < invoice.total && (
                            <p className="text-xs text-muted-foreground">
                              Due: {formatInvoiceCurrency(invoice.balance_due, invoice.currency)}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge className={`${status.color} text-white`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedInvoice(invoice); setShowViewModal(true); }}>
                                <Eye className="w-4 h-4 mr-2" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditInvoice(invoice)}>
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPaymentModal(invoice)}>
                                <DollarSign className="w-4 h-4 mr-2" /> Record Payment
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handlePrint(invoice)}>
                                <Printer className="w-4 h-4 mr-2" /> Print (A4)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleThermalPrint(invoice)}>
                                <Receipt className="w-4 h-4 mr-2" /> Thermal Print
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generatePDF(invoice)}>
                                <Download className="w-4 h-4 mr-2" /> Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => shareInvoice(invoice)}>
                                <Share2 className="w-4 h-4 mr-2" /> Share via WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {invoice.status === 'draft' && (
                                <DropdownMenuItem onClick={() => updateStatus(invoice, 'sent')}>
                                  <Send className="w-4 h-4 mr-2" /> Mark as Sent
                                </DropdownMenuItem>
                              )}
                              {(invoice.status === 'sent' || invoice.status === 'partial') && (
                                <DropdownMenuItem onClick={() => updateStatus(invoice, 'paid')}>
                                  <CheckCircle className="w-4 h-4 mr-2" /> Mark as Paid
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => updateStatus(invoice, 'cancelled')} className="text-red-600">
                                <XCircle className="w-4 h-4 mr-2" /> Cancel
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => deleteInvoice(invoice)} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {selectedInvoice ? 'Edit Invoice' : 'Create Invoice'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Invoice Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input 
                  value={invoiceForm.invoice_number || ''} 
                  onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="INV-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Issue Date *</Label>
                <Input 
                  type="date" 
                  value={invoiceForm.issue_date}
                  onChange={(e) => {
                    const issueDate = e.target.value;
                    const dueDate = calculateDueDate(issueDate, invoiceForm.payment_terms);
                    setInvoiceForm(prev => ({ ...prev, issue_date: issueDate, due_date: dueDate }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input 
                  type="date" 
                  value={invoiceForm.due_date}
                  onChange={(e) => setInvoiceForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Customer & Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select value={invoiceForm.customer_id} onValueChange={(v) => setInvoiceForm(prev => ({ ...prev, customer_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select 
                  value={invoiceForm.payment_terms} 
                  onValueChange={(v) => {
                    const dueDate = calculateDueDate(invoiceForm.issue_date, v);
                    setInvoiceForm(prev => ({ ...prev, payment_terms: v, due_date: dueDate || prev.due_date }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={invoiceForm.currency} onValueChange={(v) => setInvoiceForm(prev => ({ ...prev, currency: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tax Settings */}
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <Checkbox 
                id="tax_inclusive"
                checked={invoiceForm.tax_inclusive}
                onCheckedChange={(checked) => setInvoiceForm(prev => ({ ...prev, tax_inclusive: checked }))}
              />
              <Label htmlFor="tax_inclusive" className="cursor-pointer">
                Prices are tax inclusive
              </Label>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 w-1/3">Item</th>
                      <th className="text-center p-2 w-16">Qty</th>
                      <th className="text-right p-2 w-24">Price</th>
                      <th className="text-center p-2 w-16">Disc %</th>
                      <th className="text-center p-2 w-16">Tax %</th>
                      <th className="text-right p-2 w-24">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceForm.line_items.map((item, idx) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">
                          <Select 
                            value={item.item_id} 
                            onValueChange={(v) => updateLineItem(item.id, 'item_id', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map(i => (
                                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            className="mt-1 h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-9 w-20 text-center font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price || ''}
                            onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                            onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="h-9 w-28 text-right font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={item.discount || ''}
                            onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                            onChange={(e) => updateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                            className="h-9 w-20 text-center"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={item.tax_rate || ''}
                            onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                            onChange={(e) => updateLineItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                            className="h-9 w-20 text-center"
                          />
                        </td>
                        <td className="p-2 text-right font-medium">
                          {formatInvoiceCurrency(calculateLineTotal(item), invoiceForm.currency)}
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500"
                            onClick={() => removeLineItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & Additional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Notes & Terms */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    placeholder="Notes visible to customer..."
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Terms & Conditions</Label>
                  <Textarea 
                    placeholder="Payment terms, conditions..."
                    value={invoiceForm.terms}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, terms: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatInvoiceCurrency(totals.subtotal, invoiceForm.currency)}</span>
                </div>
                
                {totals.totalItemDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Item Discounts</span>
                    <span>-{formatInvoiceCurrency(totals.totalItemDiscount, invoiceForm.currency)}</span>
                  </div>
                )}

                {/* Overall Discount */}
                <div className="flex gap-2 items-center">
                  <Select 
                    value={invoiceForm.discount_type} 
                    onValueChange={(v) => setInvoiceForm(prev => ({ ...prev, discount_type: v, discount_value: 0 }))}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Discount</SelectItem>
                      <SelectItem value="percentage">% Discount</SelectItem>
                      <SelectItem value="fixed">Fixed Discount</SelectItem>
                    </SelectContent>
                  </Select>
                  {invoiceForm.discount_type !== 'none' && (
                    <Input
                      type="number"
                      min="0"
                      value={invoiceForm.discount_value}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                      className="w-24 h-8"
                      placeholder={invoiceForm.discount_type === 'percentage' ? '%' : currencySymbol}
                    />
                  )}
                  {totals.overallDiscount > 0 && (
                    <span className="text-green-600 text-sm">
                      -{formatInvoiceCurrency(totals.overallDiscount, invoiceForm.currency)}
                    </span>
                  )}
                </div>

                {!invoiceForm.tax_inclusive && (
                  <div className="space-y-1">
                    {isInterstate ? (
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          IGST
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-300">Interstate</Badge>
                        </span>
                        <span>{formatInvoiceCurrency(totals.totalTax, invoiceForm.currency)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>CGST</span>
                          <span>{formatInvoiceCurrency(totals.totalTax / 2, invoiceForm.currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>SGST</span>
                          <span>{formatInvoiceCurrency(totals.totalTax / 2, invoiceForm.currency)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Interstate transaction indicator */}
                {(customerState || sellerState) && invoiceForm.customer_id && (
                  <div className={`text-xs p-2 rounded ${isInterstate ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                    {isInterstate ? (
                      <>Interstate: {sellerState} → {customerState} (IGST)</>
                    ) : (
                      <>Intrastate: {sellerState || customerState} (CGST+SGST)</>
                    )}
                  </div>
                )}

                {/* Shipping */}
                <div className="flex gap-2 items-center">
                  <span className="text-sm">Shipping</span>
                  <Input
                    type="number"
                    min="0"
                    value={invoiceForm.shipping_charges}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, shipping_charges: parseFloat(e.target.value) || 0 }))}
                    className="w-24 h-8 ml-auto"
                  />
                </div>

                <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatInvoiceCurrency(totals.total, invoiceForm.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => saveInvoice('draft')} disabled={saving}>
              Save as Draft
            </Button>
            <Button onClick={() => saveInvoice('sent')} disabled={saving} className="bg-primary">
              {saving ? 'Saving...' : 'Save & Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Invoice</p>
                <p className="font-mono font-semibold">{selectedInvoice.invoice_number}</p>
                <div className="flex justify-between mt-2 text-sm">
                  <span>Total:</span>
                  <span>{formatInvoiceCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Paid:</span>
                  <span className="text-green-600">{formatInvoiceCurrency(selectedInvoice.amount_paid || 0, selectedInvoice.currency)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Balance Due:</span>
                  <span className="text-amber-600">{formatInvoiceCurrency(selectedInvoice.balance_due || selectedInvoice.total, selectedInvoice.currency)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm(prev => ({ ...prev, method: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Reference / Transaction ID</Label>
                <Input
                  placeholder="e.g., Transaction ID, Cheque No."
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Payment notes..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button onClick={recordPayment} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6 py-4">
              {/* Invoice Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold font-mono">{selectedInvoice.invoice_number}</h2>
                  <Badge className={`mt-2 ${INVOICE_STATUSES[selectedInvoice.status]?.color || 'bg-gray-500'} text-white`}>
                    {INVOICE_STATUSES[selectedInvoice.status]?.label || selectedInvoice.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium">{selectedInvoice.issue_date}</p>
                  <p className="text-sm text-muted-foreground mt-2">Due Date</p>
                  <p className="font-medium">{selectedInvoice.due_date}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Bill To</p>
                <p className="font-semibold text-lg">{selectedInvoice.customer_name}</p>
                {selectedInvoice.customer_address && (
                  <p className="text-sm">{selectedInvoice.customer_address}</p>
                )}
                {selectedInvoice.customer_email && (
                  <p className="text-sm">{selectedInvoice.customer_email}</p>
                )}
                {selectedInvoice.customer_gst && (
                  <p className="text-sm">GST: {selectedInvoice.customer_gst}</p>
                )}
              </div>

              {/* Line Items */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-center p-3">Qty</th>
                      <th className="text-right p-3">Price</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.line_items || []).map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3">
                          <p className="font-medium">{item.description || 'Item'}</p>
                        </td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right">{formatInvoiceCurrency(item.unit_price, selectedInvoice.currency)}</td>
                        <td className="p-3 text-right font-medium">
                          {formatInvoiceCurrency(item.quantity * item.unit_price, selectedInvoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatInvoiceCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                  </div>
                  {selectedInvoice.totalDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatInvoiceCurrency(selectedInvoice.totalDiscount, selectedInvoice.currency)}</span>
                    </div>
                  )}
                  {/* GST/IGST breakdown */}
                  {(selectedInvoice.totalTax > 0 || selectedInvoice.igst_amount > 0 || selectedInvoice.cgst_amount > 0) && (
                    <>
                      {selectedInvoice.is_interstate ? (
                        <div className="flex justify-between">
                          <span className="flex items-center gap-1">
                            IGST
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-300">Interstate</Badge>
                          </span>
                          <span>{formatInvoiceCurrency(selectedInvoice.igst_amount || selectedInvoice.totalTax, selectedInvoice.currency)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span>CGST</span>
                            <span>{formatInvoiceCurrency(selectedInvoice.cgst_amount || (selectedInvoice.totalTax / 2), selectedInvoice.currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SGST</span>
                            <span>{formatInvoiceCurrency(selectedInvoice.sgst_amount || (selectedInvoice.totalTax / 2), selectedInvoice.currency)}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {selectedInvoice.shipping > 0 && (
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span>{formatInvoiceCurrency(selectedInvoice.shipping, selectedInvoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>{formatInvoiceCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                  </div>
                  {selectedInvoice.amount_paid > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>Paid</span>
                        <span>{formatInvoiceCurrency(selectedInvoice.amount_paid, selectedInvoice.currency)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-amber-600">
                        <span>Balance Due</span>
                        <span>{formatInvoiceCurrency(selectedInvoice.balance_due, selectedInvoice.currency)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment History */}
              {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Payment History</h3>
                  <div className="space-y-2">
                    {selectedInvoice.payments.map((payment, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="font-medium">{formatInvoiceCurrency(payment.amount, selectedInvoice.currency)}</p>
                          <p className="text-xs text-muted-foreground">{payment.date} • {payment.method}</p>
                        </div>
                        {payment.reference && (
                          <Badge variant="outline">{payment.reference}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedInvoice.notes && (
                <div>
                  <h3 className="font-semibold mb-1">Notes</h3>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Terms */}
              {selectedInvoice.terms && (
                <div>
                  <h3 className="font-semibold mb-1">Terms & Conditions</h3>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.terms}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={() => { setShowViewModal(false); handlePrint(selectedInvoice); }}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button variant="outline" onClick={() => { setShowViewModal(false); generatePDF(selectedInvoice); }}>
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" onClick={() => { setShowViewModal(false); openEditInvoice(selectedInvoice); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => { setShowViewModal(false); openPaymentModal(selectedInvoice); }} className="bg-green-600 hover:bg-green-700">
              <DollarSign className="w-4 h-4 mr-2" /> Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview / PDF Generation (Hidden) */}
      {showPrintPreview && selectedInvoice && (
        <div className={`fixed inset-0 z-[100] bg-white ${generatingPdf ? '' : 'print:block'}`}>
          <div 
            ref={printRef} 
            className="max-w-[210mm] mx-auto p-8 bg-white text-black"
            style={{ minHeight: '297mm' }}
          >
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b-2 border-amber-500 pb-6 mb-6">
              <div>
                {invoiceSettings?.logo_url ? (
                  <img loading="lazy" src={invoiceSettings.logo_url} alt="Logo" className="h-16 mb-2" />
                ) : (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">{(invoiceSettings?.company_name || 'YS')[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800">
                        {invoiceSettings?.company_name || 'Your Store'}
                      </h1>
                    </div>
                  </div>
                )}
                <p className="text-sm text-gray-600">{invoiceSettings?.address || ''}</p>
                <p className="text-sm text-gray-600">{invoiceSettings?.phone || ''}</p>
                <p className="text-sm text-gray-600">{invoiceSettings?.email || ''}</p>
                {invoiceSettings?.gstin && (
                  <p className="text-sm text-gray-600">GSTIN: {invoiceSettings.gstin}</p>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold text-amber-600 mb-2">INVOICE</h2>
                <p className="font-mono text-lg font-semibold">{selectedInvoice.invoice_number}</p>
                <div className="mt-2 text-sm text-gray-600">
                  <p><span className="font-medium">Date:</span> {selectedInvoice.issue_date}</p>
                  <p><span className="font-medium">Due:</span> {selectedInvoice.due_date}</p>
                </div>
                <div className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  selectedInvoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                  selectedInvoice.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                  selectedInvoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {INVOICE_STATUSES[selectedInvoice.status]?.label || selectedInvoice.status}
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
              <p className="text-lg font-semibold">{selectedInvoice.customer_name}</p>
              {selectedInvoice.customer_address && (
                <p className="text-sm text-gray-600">{selectedInvoice.customer_address}</p>
              )}
              {selectedInvoice.customer_phone && (
                <p className="text-sm text-gray-600">Phone: {selectedInvoice.customer_phone}</p>
              )}
              {selectedInvoice.customer_email && (
                <p className="text-sm text-gray-600">Email: {selectedInvoice.customer_email}</p>
              )}
              {selectedInvoice.customer_gst && (
                <p className="text-sm text-gray-600">GST: {selectedInvoice.customer_gst}</p>
              )}
            </div>

            {/* Line Items Table */}
            <table className="w-full mb-6">
              <thead>
                <tr className="bg-amber-500 text-white">
                  <th className="text-left p-3 rounded-tl-lg">#</th>
                  <th className="text-left p-3">Item Description</th>
                  <th className="text-center p-3">Qty</th>
                  <th className="text-right p-3">Rate</th>
                  <th className="text-right p-3">Discount</th>
                  <th className="text-right p-3">Tax</th>
                  <th className="text-right p-3 rounded-tr-lg">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedInvoice.line_items || []).map((item, idx) => {
                  const itemTotal = item.quantity * item.unit_price;
                  const discountAmt = (itemTotal * (item.discount || 0)) / 100;
                  const afterDiscount = itemTotal - discountAmt;
                  const taxAmt = (afterDiscount * (item.tax_rate || 0)) / 100;
                  const lineTotal = afterDiscount + taxAmt;
                  
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 border-b">{idx + 1}</td>
                      <td className="p-3 border-b font-medium">{item.description || 'Item'}</td>
                      <td className="p-3 border-b text-center">{item.quantity}</td>
                      <td className="p-3 border-b text-right">{formatInvoiceCurrency(item.unit_price, selectedInvoice.currency)}</td>
                      <td className="p-3 border-b text-right">{item.discount || 0}%</td>
                      <td className="p-3 border-b text-right">{item.tax_rate || 0}%</td>
                      <td className="p-3 border-b text-right font-medium">{formatInvoiceCurrency(lineTotal, selectedInvoice.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-72 space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatInvoiceCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                </div>
                {selectedInvoice.totalDiscount > 0 && (
                  <div className="flex justify-between py-1 text-green-600">
                    <span>Discount</span>
                    <span>-{formatInvoiceCurrency(selectedInvoice.totalDiscount, selectedInvoice.currency)}</span>
                  </div>
                )}
                {/* GST/IGST breakdown for print */}
                {(selectedInvoice.totalTax > 0 || selectedInvoice.igst_amount > 0 || selectedInvoice.cgst_amount > 0) && (
                  <>
                    {selectedInvoice.is_interstate ? (
                      <div className="flex justify-between py-1 bg-orange-50 px-2 rounded">
                        <span className="text-gray-600">IGST (Interstate)</span>
                        <span>{formatInvoiceCurrency(selectedInvoice.igst_amount || selectedInvoice.totalTax, selectedInvoice.currency)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600">CGST</span>
                          <span>{formatInvoiceCurrency(selectedInvoice.cgst_amount || (selectedInvoice.totalTax / 2), selectedInvoice.currency)}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600">SGST</span>
                          <span>{formatInvoiceCurrency(selectedInvoice.sgst_amount || (selectedInvoice.totalTax / 2), selectedInvoice.currency)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                {selectedInvoice.shipping > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Shipping</span>
                    <span>{formatInvoiceCurrency(selectedInvoice.shipping, selectedInvoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t-2 border-amber-500 font-bold text-lg">
                  <span>Total</span>
                  <span className="text-amber-600">{formatInvoiceCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                </div>
                {selectedInvoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between py-1 text-green-600">
                      <span>Amount Paid</span>
                      <span>{formatInvoiceCurrency(selectedInvoice.amount_paid, selectedInvoice.currency)}</span>
                    </div>
                    <div className="flex justify-between py-2 bg-amber-50 px-2 rounded font-semibold">
                      <span>Balance Due</span>
                      <span className="text-amber-700">{formatInvoiceCurrency(selectedInvoice.balance_due, selectedInvoice.currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment History */}
            {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold mb-2 text-green-700">Payment History</h3>
                <div className="space-y-1 text-sm">
                  {selectedInvoice.payments.map((payment, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{payment.date} - {payment.method} {payment.reference && `(${payment.reference})`}</span>
                      <span className="font-medium">{formatInvoiceCurrency(payment.amount, selectedInvoice.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Details */}
            {invoiceSettings?.bank_name && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-2 text-blue-700">Bank Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-gray-500">Bank:</span> {invoiceSettings.bank_name}</p>
                  <p><span className="text-gray-500">Account:</span> {invoiceSettings.account_number}</p>
                  <p><span className="text-gray-500">IFSC:</span> {invoiceSettings.ifsc_code}</p>
                  {invoiceSettings.upi_id && <p><span className="text-gray-500">UPI:</span> {invoiceSettings.upi_id}</p>}
                </div>
              </div>
            )}

            {/* Notes & Terms */}
            {(selectedInvoice.notes || selectedInvoice.terms) && (
              <div className="mb-6 grid grid-cols-2 gap-4">
                {selectedInvoice.notes && (
                  <div>
                    <h3 className="font-semibold mb-1 text-gray-700">Notes</h3>
                    <p className="text-sm text-gray-600">{selectedInvoice.notes}</p>
                  </div>
                )}
                {selectedInvoice.terms && (
                  <div>
                    <h3 className="font-semibold mb-1 text-gray-700">Terms & Conditions</h3>
                    <p className="text-sm text-gray-600">{selectedInvoice.terms}</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="border-t pt-4 mt-auto text-center text-sm text-gray-500">
              <p className="font-medium">Thank you for your business!</p>
              {invoiceSettings?.footer_text && <p className="mt-1">{invoiceSettings.footer_text}</p>}
            </div>
          </div>

          {/* Close button (hidden when printing) */}
          {!generatingPdf && (
            <div className="fixed top-4 right-4 print:hidden">
              <Button variant="outline" onClick={() => setShowPrintPreview(false)}>
                <XCircle className="w-4 h-4 mr-2" /> Close Preview
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Thermal Print Dialog */}
      <Dialog open={showThermalPrint} onOpenChange={setShowThermalPrint}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Thermal Print - {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Paper Size Selection */}
            <div className="space-y-2">
              <Label>Paper Width</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={thermalPaperWidth === '58mm' ? 'default' : 'outline'}
                  onClick={() => setThermalPaperWidth('58mm')}
                  className="w-full"
                >
                  58mm (32 chars)
                </Button>
                <Button
                  type="button"
                  variant={thermalPaperWidth === '80mm' ? 'default' : 'outline'}
                  onClick={() => setThermalPaperWidth('80mm')}
                  className="w-full"
                >
                  80mm (48 chars)
                </Button>
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-2 bg-white max-h-[400px] overflow-auto">
              <div className="flex justify-center">
                <ThermalInvoice
                  ref={thermalRef}
                  invoice={selectedInvoice}
                  storeName={invoiceSettings?.company_name || 'BIJNISBOOKS'}
                  storeAddress={invoiceSettings?.company_address || ''}
                  storePhone={invoiceSettings?.company_phone || ''}
                  storeGSTIN={invoiceSettings?.gst_number || ''}
                  paperWidth={thermalPaperWidth}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowThermalPrint(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={printThermal} className="flex-1">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
