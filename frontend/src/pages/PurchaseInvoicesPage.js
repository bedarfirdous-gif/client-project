import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Plus, Eye, Trash2, FileText, Clock, CheckCircle, X, Package, Truck, Calculator, Camera, Upload, Loader2, Sparkles, Pencil, RotateCcw, Archive, RefreshCw, Play } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import SyncBar from '../components/SyncBar';

const GST_RATES = ['0', '5', '12', '18', '28'];

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

// Get state from GST number (first 2 digits)
const getStateFromGST = (gstNumber) => {
  if (!gstNumber || gstNumber.length < 2) return null;
  const stateCode = gstNumber.substring(0, 2);
  return INDIAN_STATES.find(s => s.code === stateCode);
};

// Size options
const NUMERIC_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44'];
const LETTER_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];
const SHOE_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12', '13'];
const ALL_SIZES = [...NUMERIC_SIZES, ...LETTER_SIZES, ...SHOE_SIZES];

// Common colors
const COLORS = [
  'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 
  'Pink', 'Brown', 'Grey', 'Navy', 'Maroon', 'Beige', 'Cream', 'Olive',
  'Teal', 'Coral', 'Burgundy', 'Mustard', 'Peach', 'Lavender', 'Turquoise'
];

const emptyForm = {
  supplier_id: '', store_id: '', invoice_number: '',
  invoice_date: new Date().toISOString().split('T')[0],
  items: [], subtotal: 0, tax_amount: 0, discount_amount: 0,
  other_charges: 0, freight_charges: 0,
  total_amount: 0, payment_status: 'pending', notes: '',
  gst_type: 'exclusive' // 'exclusive' or 'inclusive'
};

const emptyLineItem = {
  variant_id: '', item_id: '', quantity: 1, rate: 0,
  size: '', color: '', barcode: '',
  discount_percent: 0, gst_percent: 12, freight: 0, description: ''
};

export default function PurchaseInvoicesPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [variants, setVariants] = useState([]);
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // FIX: avoid null-initialized UI state that can cause a brief flash
  // when the component renders before data/effects settle.
  // Use a stable initial value plus a loaded flag if the UI needs to wait.
  const [showDetail, setShowDetail] = useState(false);
  const [isDetailReady, setIsDetailReady] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState([]);
  
  // Interstate transaction state (IGST vs CGST+SGST)
  const [isInterstate, setIsInterstate] = useState(false);

  // FIX: initialize to empty string instead of null to prevent
  // null→string transitions from briefly rendering inconsistent state.
  const [supplierState, setSupplierState] = useState('');
  const [buyerState, setBuyerState] = useState('');
  const [isGSTStateReady, setIsGSTStateReady] = useState(false);
  
  // Quick-add modals
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [showAddColor, setShowAddColor] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '', address: '', gst_number: '', state: '' });
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', selling_price: 0 });
  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const [customSizes, setCustomSizes] = useState([]);
  const [customColors, setCustomColors] = useState([]);
  const [addingProduct, setAddingProduct] = useState(false);  // Loading state for Add Product
  // AI Scanner states
  const [showAIScanner, setShowAIScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  // FIX: avoid null initial state (null → object) which can cause a brief
  // conditional-render flash. Use a stable initial value + a readiness flag.
  const [scannedData, setScannedData] = useState({});
  const [hasScannedData, setHasScannedData] = useState(false);
  const fileInputRef = useRef(null);
  
  // Edit mode state
  // FIX: avoid null initial state (null → object) which can flash edit UI.
  // Track readiness separately.
  const [editingInvoice, setEditingInvoice] = useState({});
  const [isEditingInvoiceReady, setIsEditingInvoiceReady] = useState(false);
  
  // Deleted invoices state
  const [deletedInvoices, setDeletedInvoices] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  
  // Hold invoices state (saved locally)
  const [heldInvoices, setHeldInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem('held_purchase_invoices');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  // API Cache for frequently accessed data
  const cacheRef = useRef({
    suppliers: { data: null, timestamp: 0 },
    items: { data: null, timestamp: 0 },
    variants: { data: null, timestamp: 0 },
    stores: { data: null, timestamp: 0 }
  });
  const CACHE_TTL = 30 * 1000; // 30 seconds cache - reduced for faster updates

  // Check if transaction is interstate when supplier or store changes
  useEffect(() => {
    if (form.supplier_id && form.store_id) {
      const supplier = suppliers.find(s => s.id === form.supplier_id);
      const store = stores.find(s => s.id === form.store_id);
      
      // Get supplier state from GST number or state field
      let suppState = supplier?.state;
      if (!suppState && supplier?.gst_number) {
        const stateFromGST = getStateFromGST(supplier.gst_number);
        suppState = stateFromGST?.name;
      }
      
      // Get buyer/store state
      let storeState = store?.state;
      if (!storeState && store?.gst_number) {
        const stateFromGST = getStateFromGST(store.gst_number);
        storeState = stateFromGST?.name;
      }
      
      setSupplierState(suppState);
      setBuyerState(storeState);
      
      // Interstate if states are different
      const interstate = suppState && storeState && suppState !== storeState;
      setIsInterstate(interstate);
      
      if (interstate) {
        toast.info(`Interstate transaction: IGST applicable (${suppState} → ${storeState})`);
      }
    }
  }, [form.supplier_id, form.store_id, suppliers, stores]);

  useEffect(() => { fetchData(); }, []);

  // Cached API fetch helper
  const fetchWithCache = async (key, fetchFn) => {
    const cache = cacheRef.current[key];
    const now = Date.now();
    
    if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
      return cache.data; // Return cached data
    }
    
    const data = await fetchFn();
    cacheRef.current[key] = { data, timestamp: now };
    return data;
  };

  const fetchData = async (forceRefresh = false) => {
    try {
      // Reset cache if forced
      if (forceRefresh) {
        Object.keys(cacheRef.current).forEach(key => {
          cacheRef.current[key] = { data: null, timestamp: 0 };
        });
      }
      
      // Batch all API calls - use cache for frequently accessed data
      const [d1, d2, d3, d4, d5, d6] = await Promise.all([
        api('/api/purchase-invoices'), // Always fresh for invoices
        fetchWithCache('suppliers', () => 
          api('/api/suppliers/with-ledgers').catch(() => api('/api/suppliers'))
        ),
        fetchWithCache('stores', () => api('/api/stores')),
        fetchWithCache('variants', () => api('/api/variants')),
        fetchWithCache('items', () => api('/api/items')),
        api('/api/purchase-invoices/deleted').catch(() => [])
      ]);
      
      setInvoices(d1);
      setSuppliers(d2);
      setStores(d3);
      setVariants(d4);
      setItems(d5);
      setDeletedInvoices(d6);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Hold current invoice to local storage
  const holdInvoice = () => {
    if (!form.supplier_id && lineItems.length === 0) {
      toast.error('Nothing to hold - add supplier or items first');
      return;
    }
    
    const heldInvoice = {
      id: `hold_${Date.now()}`,
      form: { ...form },
      lineItems: [...lineItems],
      timestamp: new Date().toISOString(),
      supplierName: suppliers.find(s => s.id === form.supplier_id)?.name || 'Unknown'
    };
    
    const newHeldInvoices = [...heldInvoices, heldInvoice];
    setHeldInvoices(newHeldInvoices);
    localStorage.setItem('held_purchase_invoices', JSON.stringify(newHeldInvoices));
    
    // Clear current form
    setForm(emptyForm);
    setLineItems([]);
    setShowModal(false);
    
    toast.success(`Invoice held (${heldInvoice.supplierName})`);
  };

  // Resume a held invoice
  const resumeHeldInvoice = (heldId) => {
    const held = heldInvoices.find(h => h.id === heldId);
    if (!held) return;
    
    setForm(held.form);
    setLineItems(held.lineItems);
    
    // Remove from held list
    const newHeldInvoices = heldInvoices.filter(h => h.id !== heldId);
    setHeldInvoices(newHeldInvoices);
    localStorage.setItem('held_purchase_invoices', JSON.stringify(newHeldInvoices));
    
    setShowModal(true);
    toast.success('Invoice resumed');
  };

  // Delete a held invoice
  const deleteHeldInvoice = (heldId) => {
    const newHeldInvoices = heldInvoices.filter(h => h.id !== heldId);
    setHeldInvoices(newHeldInvoices);
    localStorage.setItem('held_purchase_invoices', JSON.stringify(newHeldInvoices));
    toast.success('Held invoice deleted');
  };

  // Clear current form
  const clearForm = () => {
    if (lineItems.length > 0 || form.supplier_id) {
      if (!window.confirm('Clear all data? This cannot be undone.')) return;
    }
    setForm(emptyForm);
    setLineItems([]);
    toast.info('Form cleared');
  };

  // Restore deleted invoice
  const restoreInvoice = async (id) => {
    try {
      await api(`/api/purchase-invoices/${id}/restore`, { method: 'POST' });
      toast.success('Invoice restored successfully!');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to restore invoice');
    }
  };

  // Permanently delete invoice
  const permanentlyDeleteInvoice = async (id) => {
    if (!window.confirm('Are you sure? This action cannot be undone!')) return;
    try {
      await api(`/api/purchase-invoices/${id}/permanent`, { method: 'DELETE' });
      toast.success('Invoice permanently deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete invoice');
    }
  };

  // Quick-add functions
  const handleAddSupplier = async () => {
    if (!newSupplier.name) { toast.error('Supplier name is required'); return; }
    try {
      const created = await api('/api/suppliers', { method: 'POST', body: JSON.stringify(newSupplier) });
      setSuppliers([...suppliers, created]);
      setForm({ ...form, supplier_id: created.id });
      setShowAddSupplier(false);
      setNewSupplier({ name: '', phone: '', email: '', address: '', gst_number: '' });
      
      // Invalidate cache for suppliers to ensure fresh data on next fetch
      cacheRef.current.suppliers = { data: null, timestamp: 0 };
      
      toast.success('Supplier added!');
    } catch (err) { toast.error(err.message); }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name) { toast.error('Product name is required'); return; }
    
    setAddingProduct(true);
    
    // Close modal immediately for faster UX
    const productName = newProduct.name;
    const productSku = newProduct.sku;
    const productPrice = parseFloat(newProduct.selling_price) || 0;
    setShowAddProduct(false);
    setNewProduct({ name: '', sku: '', selling_price: 0 });
    
    try {
      // Create item
      const item = await api('/api/items', { 
        method: 'POST', 
        body: JSON.stringify({ 
          name: productName, 
          description: '',
          sku: productSku || ''
        }) 
      });
      
      // Create variant
      const variant = await api('/api/variants', { 
        method: 'POST', 
        body: JSON.stringify({ 
          item_id: item.id, 
          sku: productSku || `${productName.toUpperCase().slice(0,3)}-001`, 
          selling_price: productPrice, 
          cost_price: productPrice 
        })
      });
      
      // Update state immediately
      setItems(prev => [...prev, item]);
      setVariants(prev => [...prev, variant]);
      
      // Invalidate cache for items and variants to ensure fresh data on next fetch
      cacheRef.current.items = { data: null, timestamp: 0 };
      cacheRef.current.variants = { data: null, timestamp: 0 };
      
      toast.success(`${productName} added successfully`);
    } catch (err) { 
      toast.error(err.message || 'Failed to add product');
      // Re-open dialog on error
      setNewProduct({ name: productName, sku: productSku, selling_price: productPrice });
      setShowAddProduct(true);
    } finally {
      setAddingProduct(false);
    }
  };

  const handleAddSize = () => {
    if (!newSize) { toast.error('Size is required'); return; }
    if (!customSizes.includes(newSize) && !ALL_SIZES.includes(newSize)) {
      setCustomSizes([...customSizes, newSize]);
    }
    setShowAddSize(false);
    setNewSize('');
    toast.success('Size added!');
  };

  const handleAddColor = () => {
    if (!newColor) { toast.error('Color is required'); return; }
    if (!customColors.includes(newColor) && !COLORS.includes(newColor)) {
      setCustomColors([...customColors, newColor]);
    }
    setShowAddColor(false);
    setNewColor('');
    toast.success('Color added!');
  };

  // AI Invoice Scanner Functions
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image (JPEG, PNG, WebP, GIF) or PDF file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    await scanInvoice(file);
  };

  const scanInvoice = async (file) => {
    setIsScanning(true);
    setScannedData(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api('/api/ai/scan-invoice', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set content-type for FormData
      });
      
      if (response.success) {
        setScannedData(response);
        toast.success('Invoice scanned successfully!');
      } else {
        throw new Error(response.message || 'Failed to scan invoice');
      }
    } catch (err) {
      console.error('Scan error:', err);
      toast.error(err.message || 'Failed to scan invoice. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const applyScannedData = () => {
    if (!scannedData?.extracted_data) return;
    
    const data = scannedData.extracted_data;
    
    // Update form with extracted data
    const newForm = {
      ...form,
      invoice_number: data.invoice_number || form.invoice_number,
      invoice_date: data.invoice_date || form.invoice_date,
      subtotal: data.subtotal || 0,
      tax_amount: data.tax_amount || 0,
      discount_amount: data.discount || 0,
      total_amount: data.total_amount || 0,
      notes: data.notes || ''
    };
    
    // If supplier was matched, set it
    if (scannedData.supplier_match) {
      newForm.supplier_id = scannedData.supplier_match.id;
    }
    
    setForm(newForm);
    
    // Convert scanned items to line items
    if (data.items && data.items.length > 0) {
      const newLineItems = data.items.map(item => ({
        variant_id: '',
        item_id: '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        size: '',
        color: '',
        barcode: item.barcode || '',
        discount_percent: 0,
        gst_percent: item.gst_percent || 12,
        freight: 0,
        description: `${item.name || ''}${item.description ? ' - ' + item.description : ''}`
      }));
      setLineItems(newLineItems);
    }
    
    // Close scanner modal and open main form
    setShowAIScanner(false);
    setShowModal(true);
    toast.success('Data applied to form! Please verify and select products.');
  };

  const allSizes = [...ALL_SIZES, ...customSizes];
  const allColors = [...COLORS, ...customColors];

  // Generate a unique barcode (EAN-13 format style: 13 digits)
  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return timestamp + random;
  };

  const getSupplierName = (id) => suppliers.find(x => x.id === id)?.name || '-';
  const getStoreName = (id) => stores.find(x => x.id === id)?.name || '-';
  const getItemName = (itemId) => items.find(x => x.id === itemId)?.name || 'Unknown Item';
  const getVariantDisplay = (v) => {
    const item = items.find(i => i.id === v.item_id);
    return `${item?.name || 'Item'} - ${v.sku || v.size || v.color || v.id.slice(0,6)}`;
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { ...emptyLineItem }]);
  };

  const updateLineItem = (idx, field, value) => {
    const updated = [...lineItems];
    updated[idx][field] = value;
    if (field === 'variant_id') {
      const v = variants.find(x => x.id === value);
      if (v) {
        updated[idx].item_id = v.item_id;
        updated[idx].rate = v.cost_price || v.selling_price || 0;
      }
    }
    setLineItems(updated);
    recalcTotals(updated, form);
  };

  const removeLineItem = (idx) => {
    const updated = lineItems.filter((_, i) => i !== idx);
    setLineItems(updated);
    recalcTotals(updated, form);
  };

  const calcLineAmount = (li, gstType = form.gst_type) => {
    const qty = li.quantity || 0;
    const rate = li.rate || 0;
    const discountPct = li.discount_percent || 0;
    const gstPct = li.gst_percent || 0;
    const freight = li.freight || 0;
    
    if (gstType === 'inclusive') {
      // GST Inclusive: Rate already includes GST
      // Base price = Rate / (1 + GST%)
      const grossAmount = qty * rate;
      const discountAmt = grossAmount * (discountPct / 100);
      const afterDiscount = grossAmount - discountAmt;
      const baseAmount = afterDiscount / (1 + gstPct / 100);
      const gstAmt = afterDiscount - baseAmount;
      return { 
        base: baseAmount, 
        discountAmt, 
        afterDiscount: baseAmount, 
        gstAmt, 
        total: afterDiscount + freight 
      };
    } else {
      // GST Exclusive: GST added on top
      const base = qty * rate;
      const discountAmt = base * (discountPct / 100);
      const afterDiscount = base - discountAmt;
      const gstAmt = afterDiscount * (gstPct / 100);
      return { 
        base, 
        discountAmt, 
        afterDiscount, 
        gstAmt, 
        total: afterDiscount + gstAmt + freight 
      };
    }
  };

  const recalcTotals = (items, currentForm) => {
    let subtotal = 0, totalGst = 0, totalDiscount = 0, totalItemFreight = 0;
    
    items.forEach(li => {
      const calc = calcLineAmount(li, currentForm.gst_type);
      subtotal += calc.base;
      totalDiscount += calc.discountAmt;
      totalGst += calc.gstAmt;
      totalItemFreight += li.freight || 0;
    });
    
    const grandTotal = subtotal - totalDiscount + totalGst + totalItemFreight + 
                       (currentForm.freight_charges || 0) + (currentForm.other_charges || 0);
    
    setForm(f => ({
      ...f,
      subtotal,
      discount_amount: totalDiscount,
      tax_amount: totalGst,
      total_amount: grandTotal
    }));
  };

  const updateFormField = (field, value) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    recalcTotals(lineItems, newForm);
  };

  const openModal = () => {
    setEditingInvoice(null); // Clear editing state for new invoice
    setForm(emptyForm);
    setLineItems([]);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id || !form.store_id) {
      toast.error('Please select supplier and store');
      return;
    }
    if (lineItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    // Calculate totals before submitting
    let subtotal = 0, totalGst = 0, totalDiscount = 0, totalFreight = 0;
    lineItems.forEach(li => {
      const calc = calcLineAmount(li, form.gst_type);
      subtotal += calc.base;
      totalDiscount += calc.discountAmt;
      totalGst += calc.gstAmt;
      totalFreight += li.freight || 0;
    });
    
    const grandTotal = subtotal - totalDiscount + totalGst + totalFreight + 
                       (parseFloat(form.freight_charges) || 0) + (parseFloat(form.other_charges) || 0);
    
    try {
      const payload = {
        supplier_id: form.supplier_id,
        store_id: form.store_id,
        invoice_number: form.invoice_number || '',
        invoice_date: form.invoice_date,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(totalGst * 100) / 100,
        discount_amount: Math.round(totalDiscount * 100) / 100,
        freight_charges: parseFloat(form.freight_charges) || 0,
        other_charges: parseFloat(form.other_charges) || 0,
        total_amount: Math.round(grandTotal * 100) / 100,
        payment_status: form.payment_status || 'pending',
        notes: form.notes || '',
        items: lineItems.map((li, idx) => {
          const calc = calcLineAmount(li);
          // Find item name from items list or use description
          const item = items.find(i => i.id === li.item_id);
          const itemName = item?.name || li.description || li.item_name || 'Unknown Item';
          
          // Auto-generate barcode if empty
          const barcode = li.barcode?.trim() || generateBarcode();
          
          return {
            variant_id: li.variant_id || '',
            item_id: li.item_id || '',
            name: itemName,
            item_name: itemName,
            quantity: parseInt(li.quantity) || 1,
            rate: parseFloat(li.rate) || 0,
            size: li.size || '',
            color: li.color || '',
            barcode: barcode,
            discount_percent: parseFloat(li.discount_percent) || 0,
            gst_percent: parseFloat(li.gst_percent) || 12,
            freight: parseFloat(li.freight) || 0,
            description: li.description || itemName,
            amount: calc.total
          };
        })
      };
      
      console.log('Purchase invoice payload:', payload);
      await api('/api/purchase-invoices', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('Purchase invoice created successfully! Stock updated.');
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Purchase invoice error:', err);
      toast.error(err.message || 'Failed to create purchase invoice');
    }
  };

  const updatePayment = async (id, status) => {
    try {
      await api(`/api/purchase-invoices/${id}/payment?payment_status=${status}`, { method: 'PUT' });
      toast.success('Payment status updated');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this purchase invoice?')) return;
    try {
      await api(`/api/purchase-invoices/${id}`, { method: 'DELETE' });
      toast.success('Invoice deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Edit invoice function
  const openEditModal = async (invoice) => {
    try {
      // Fetch full invoice details
      const fullInvoice = await api(`/api/purchase-invoices/${invoice.id}`);
      
      setEditingInvoice(fullInvoice);
      setForm({
        supplier_id: fullInvoice.supplier_id || '',
        store_id: fullInvoice.store_id || '',
        invoice_date: fullInvoice.invoice_date || new Date().toISOString().split('T')[0],
        invoice_number: fullInvoice.invoice_number || '',
        subtotal: fullInvoice.subtotal || 0,
        discount_amount: fullInvoice.discount_amount || 0,
        tax_amount: fullInvoice.tax_amount || 0,
        freight_amount: fullInvoice.freight_amount || 0,
        other_charges: fullInvoice.other_charges || 0,
        total_amount: fullInvoice.total_amount || 0,
        notes: fullInvoice.notes || ''
      });
      
      // Map items to line items format
      if (fullInvoice.items && fullInvoice.items.length > 0) {
        const mappedItems = fullInvoice.items.map(item => ({
          variant_id: item.variant_id || '',
          item_id: item.item_id || '',
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          size: item.size || '',
          color: item.color || '',
          barcode: item.barcode || '',
          discount_percent: item.discount_percent || 0,
          gst_percent: item.gst_percent || 12,
          freight: item.freight || 0,
          description: item.description || ''
        }));
        setLineItems(mappedItems);
      } else {
        setLineItems([]);
      }
      
      setShowModal(true);
    } catch (err) {
      toast.error('Failed to load invoice details');
      console.error(err);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingInvoice) return;
    
    if (!form.supplier_id || !form.store_id) {
      toast.error('Please select supplier and store');
      return;
    }
    
    // Calculate totals before submitting
    let subtotal = 0, totalGst = 0, totalDiscount = 0, totalFreight = 0;
    lineItems.forEach(li => {
      const calc = calcLineAmount(li, form.gst_type);
      subtotal += calc.base;
      totalDiscount += calc.discountAmt;
      totalGst += calc.gstAmt;
      totalFreight += li.freight || 0;
    });
    
    const grandTotal = subtotal - totalDiscount + totalGst + totalFreight + 
                       (parseFloat(form.freight_charges) || 0) + (parseFloat(form.other_charges) || 0);
    
    try {
      const payload = {
        supplier_id: form.supplier_id,
        store_id: form.store_id,
        invoice_number: form.invoice_number || '',
        invoice_date: form.invoice_date,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(totalGst * 100) / 100,
        discount_amount: Math.round(totalDiscount * 100) / 100,
        freight_charges: parseFloat(form.freight_charges) || 0,
        other_charges: parseFloat(form.other_charges) || 0,
        total_amount: Math.round(grandTotal * 100) / 100,
        payment_status: form.payment_status || 'pending',
        notes: form.notes || '',
        items: lineItems.map(li => {
          const calc = calcLineAmount(li);
          const item = items.find(i => i.id === li.item_id);
          const itemName = item?.name || li.description || li.item_name || 'Unknown Item';
          
          // Auto-generate barcode if empty
          const barcode = li.barcode?.trim() || generateBarcode();
          
          return {
            variant_id: li.variant_id || '',
            item_id: li.item_id || '',
            name: itemName,
            item_name: itemName,
            quantity: parseInt(li.quantity) || 1,
            rate: parseFloat(li.rate) || 0,
            size: li.size || '',
            color: li.color || '',
            barcode: barcode,
            discount_percent: parseFloat(li.discount_percent) || 0,
            gst_percent: parseFloat(li.gst_percent) || 12,
            freight: parseFloat(li.freight) || 0,
            description: li.description || itemName,
            amount: calc.total
          };
        })
      };
      
      await api(`/api/purchase-invoices/${editingInvoice.id}`, { 
        method: 'PUT', 
        body: JSON.stringify(payload) 
      });
      toast.success('Purchase invoice updated successfully! Stock updated.');
      setShowModal(false);
      setEditingInvoice(null);
      fetchData();
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.message || 'Failed to update purchase invoice');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingInvoice(null);
    setForm(emptyForm);
    setLineItems([]);
  };

  const totalAmount = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const pendingAmount = invoices.filter(i => i.payment_status === 'pending').reduce((s, i) => s + (i.total_amount || 0), 0);
  const paidAmount = invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="purchase-invoices-page">
      {/* Sync Bar */}
      <SyncBar api={api} onSyncComplete={fetchData} />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <FileText className="w-8 h-8 text-blue-600 mb-2" />
          <p className="text-sm text-muted-foreground">Total Purchases</p>
          <p className="text-2xl font-bold">{currencySymbol}{totalAmount.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <Clock className="w-8 h-8 text-amber-600 mb-2" />
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{currencySymbol}{pendingAmount.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <CheckCircle className="w-8 h-8 text-emerald-600 mb-2" />
          <p className="text-sm text-muted-foreground">Paid</p>
          <p className="text-2xl font-bold text-emerald-600">{currencySymbol}{paidAmount.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <Package className="w-8 h-8 text-purple-600 mb-2" />
          <p className="text-sm text-muted-foreground">Total Invoices</p>
          <p className="text-2xl font-bold">{invoices.length}</p>
        </CardContent></Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setShowAIScanner(true)} data-testid="ai-scan-btn" className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 hover:from-violet-600 hover:to-purple-700">
          <Sparkles className="w-4 h-4 mr-2" /> AI Invoice Scanner
        </Button>
        <Button onClick={openModal} data-testid="add-purchase-btn">
          <Plus className="w-4 h-4 mr-2" /> New Purchase
        </Button>
      </div>

      {/* Held Invoices Banner */}
      {heldInvoices.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 mb-4">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  {heldInvoices.length} Held Invoice{heldInvoices.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {heldInvoices.map((held) => (
                  <div key={held.id} className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm border">
                    <span className="text-sm font-medium">{held.supplierName || 'Draft'}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({held.lineItems?.length || 0} items)
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => resumeHeldInvoice(held.id)}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteHeldInvoice(held.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Purchase Invoices</CardTitle>
            {deletedInvoices.length > 0 && (
              <Badge variant="outline" className="text-red-600 border-red-300">
                <Archive className="w-3 h-3 mr-1" /> {deletedInvoices.length} in Trash
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Active ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="deleted" className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Deleted ({deletedInvoices.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active">
              {invoices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No purchase invoices yet. Click "New Purchase" to create one.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-left p-3">Invoice #</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Store</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-right p-3">Actions</th>
                    </tr></thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b hover:bg-accent/30">
                          <td className="p-3 font-medium">{inv.invoice_number}</td>
                          <td className="p-3">{inv.invoice_date}</td>
                          <td className="p-3">{getSupplierName(inv.supplier_id)}</td>
                          <td className="p-3">{getStoreName(inv.store_id)}</td>
                          <td className="p-3 text-right font-bold">{currencySymbol}{inv.total_amount?.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <Badge variant={inv.payment_status === 'paid' ? 'default' : inv.payment_status === 'partial' ? 'outline' : 'secondary'}>
                              {inv.payment_status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setShowDetail(inv)} data-testid={`view-${inv.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {inv.payment_status !== 'paid' && (
                            <Button size="sm" variant="outline" onClick={() => updatePayment(inv.id, 'paid')}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEditModal(inv)} data-testid={`edit-${inv.id}`} title="Edit Invoice">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteInvoice(inv.id)} data-testid={`delete-${inv.id}`} title="Delete Invoice">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </TabsContent>
            
            <TabsContent value="deleted">
              {deletedInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <Trash2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No deleted invoices</p>
                  <p className="text-sm text-muted-foreground">Deleted invoices will appear here and can be restored</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-red-50">
                      <th className="text-left p-3">Invoice #</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-left p-3">Deleted At</th>
                      <th className="text-right p-3">Actions</th>
                    </tr></thead>
                    <tbody>
                      {deletedInvoices.map((inv) => (
                        <tr key={inv.id} className="border-b hover:bg-red-50/50">
                          <td className="p-3 font-medium text-muted-foreground">{inv.invoice_number}</td>
                          <td className="p-3 text-muted-foreground">{inv.invoice_date}</td>
                          <td className="p-3 text-muted-foreground">{getSupplierName(inv.supplier_id)}</td>
                          <td className="p-3 text-right font-medium text-muted-foreground">{currencySymbol}{inv.total_amount?.toLocaleString()}</td>
                          <td className="p-3 text-muted-foreground text-sm">
                            {inv.deleted_at ? new Date(inv.deleted_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => restoreInvoice(inv.id)}
                                title="Restore Invoice"
                              >
                                <RotateCcw className="w-4 h-4 mr-1" /> Restore
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-destructive hover:bg-red-100"
                                onClick={() => permanentlyDeleteInvoice(inv.id)}
                                title="Delete Permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingInvoice ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}</DialogTitle></DialogHeader>
          <form onSubmit={editingInvoice ? handleUpdate : handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <div className="flex gap-1">
                  <Select value={form.supplier_id} onValueChange={(v) => setForm({...form, supplier_id: v})}>
                    <SelectTrigger data-testid="supplier-select" className="flex-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          No suppliers found. Click + to add one.
                        </div>
                      ) : (
                        suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={() => setShowAddSupplier(true)} title="Add Supplier">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Store *</Label>
                <Select value={form.store_id} onValueChange={(v) => setForm({...form, store_id: v})}>
                  <SelectTrigger data-testid="store-select"><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {stores.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No stores found. Please create a store first.
                      </div>
                    ) : (
                      stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Date *</Label>
                <Input type="date" value={form.invoice_date} onChange={(e) => setForm({...form, invoice_date: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Invoice Number (auto-generated if empty)</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({...form, invoice_number: e.target.value})} placeholder="PUR-000001" />
              </div>
            </div>

            {/* GST/IGST Type Selector - Centralized with Clear Visual Distinction */}
            <div className="border-2 rounded-xl overflow-hidden shadow-sm">
              {/* Tax Type Toggle - GST vs IGST */}
              <div className="flex flex-col items-center gap-4 p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Select Tax Type</span>
                <div className="flex bg-gray-100 rounded-full p-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setIsInterstate(false)}
                    className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
                      !isInterstate 
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg transform scale-105' 
                        : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${!isInterstate ? 'bg-white' : 'bg-gray-400'}`}></span>
                      GST (CGST + SGST)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInterstate(true)}
                    className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
                      isInterstate 
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg transform scale-105' 
                        : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${isInterstate ? 'bg-white' : 'bg-gray-400'}`}></span>
                      IGST (Interstate)
                    </span>
                  </button>
                </div>
                
                {/* State indicator */}
                {(supplierState || buyerState) && (
                  <Badge 
                    variant="outline" 
                    className={`text-sm px-4 py-1 ${
                      isInterstate 
                        ? 'border-orange-400 text-orange-700 bg-orange-50' 
                        : 'border-green-400 text-green-700 bg-green-50'
                    }`}
                  >
                    {isInterstate 
                      ? `Interstate: ${supplierState || '?'} → ${buyerState || '?'}` 
                      : `Intrastate: ${supplierState || buyerState || 'Same State'}`
                    }
                  </Badge>
                )}
              </div>
              
              {/* Exclusive/Inclusive Options - Centered */}
              <div className={`flex justify-center items-center gap-12 p-4 border-t ${
                isInterstate ? 'bg-orange-50/70' : 'bg-amber-50/70'
              }`}>
                <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-all ${
                  form.gst_type === 'exclusive' 
                    ? (isInterstate ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-amber-100 ring-2 ring-amber-400')
                    : 'hover:bg-gray-100'
                }`}>
                  <input
                    type="radio"
                    name="gst_type"
                    value="exclusive"
                    checked={form.gst_type === 'exclusive'}
                    onChange={(e) => {
                      setForm({...form, gst_type: e.target.value});
                      recalcTotals(lineItems, {...form, gst_type: e.target.value});
                    }}
                    className={`w-5 h-5 ${isInterstate ? 'text-orange-600' : 'text-amber-600'}`}
                  />
                  <div>
                    <span className="text-sm font-bold block">{isInterstate ? 'IGST' : 'GST'} Exclusive</span>
                    <span className="text-xs text-muted-foreground">Tax added to price</span>
                  </div>
                </label>
                <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-all ${
                  form.gst_type === 'inclusive' 
                    ? (isInterstate ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-amber-100 ring-2 ring-amber-400')
                    : 'hover:bg-gray-100'
                }`}>
                  <input
                    type="radio"
                    name="gst_type"
                    value="inclusive"
                    checked={form.gst_type === 'inclusive'}
                    onChange={(e) => {
                      setForm({...form, gst_type: e.target.value});
                      recalcTotals(lineItems, {...form, gst_type: e.target.value});
                    }}
                    className={`w-5 h-5 ${isInterstate ? 'text-orange-600' : 'text-amber-600'}`}
                  />
                  <div>
                    <span className="text-sm font-bold block">{isInterstate ? 'IGST' : 'GST'} Inclusive</span>
                    <span className="text-xs text-muted-foreground">Price includes tax</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Product / Item Details</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowAddProduct(true)}>
                    <Plus className="w-4 h-4 mr-1" /> New Product
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={addLineItem} data-testid="add-line-item-btn">
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
              </div>
              {lineItems.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">No items added. Click "Add Item" to add products.</p>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((li, idx) => {
                    const calc = calcLineAmount(li);
                    return (
                      <div key={idx} className="bg-accent/30 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</span>
                          <Button type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeLineItem(idx)}>
                            <X className="w-4 h-4 mr-1" /> Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-3">
                            <Label className="text-xs">Product *</Label>
                            <div className="flex gap-1">
                              <Select value={li.variant_id} onValueChange={(v) => updateLineItem(idx, 'variant_id', v)}>
                                <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                                <SelectContent>
                                  {variants.map(v => <SelectItem key={v.id} value={v.id}>{getVariantDisplay(v)}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setShowAddProduct(true)} title="Add Product">
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Size</Label>
                            <div className="flex gap-1">
                              <Select value={li.size || ''} onValueChange={(v) => updateLineItem(idx, 'size', v)}>
                                <SelectTrigger className="flex-1"><SelectValue placeholder="Size" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {allSizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setShowAddSize(true)} title="Add Size">
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Color</Label>
                            <div className="flex gap-1">
                              <Select value={li.color || ''} onValueChange={(v) => updateLineItem(idx, 'color', v)}>
                                <SelectTrigger className="flex-1"><SelectValue placeholder="Color" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {allColors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setShowAddColor(true)} title="Add Color">
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Qty *</Label>
                            <Input 
                              type="number" 
                              min="1" 
                              step="1" 
                              className="w-full text-center font-medium"
                              value={li.quantity} 
                              onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 1)} 
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Rate ({currencySymbol}) *</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              step="any" 
                              className="w-full text-right font-medium"
                              value={li.rate || ''} 
                              onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                              onChange={(e) => updateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)} 
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Disc %</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              max="100" 
                              step="any" 
                              className="w-full text-center"
                              value={li.discount_percent || ''} 
                              onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                              onChange={(e) => updateLineItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)} 
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">{isInterstate ? 'IGST %' : 'GST %'}</Label>
                            <Select value={String(li.gst_percent)} onValueChange={(v) => updateLineItem(idx, 'gst_percent', parseInt(v))}>
                              <SelectTrigger className={isInterstate ? 'border-orange-300 bg-orange-50' : ''}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {GST_RATES.map(r => <SelectItem key={r} value={r}>{r}%</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-2">
                            <Label className="text-xs">Barcode</Label>
                            <Input 
                              value={li.barcode || ''} 
                              onChange={(e) => updateLineItem(idx, 'barcode', e.target.value)} 
                              placeholder="Scan or enter"
                              data-testid={`barcode-input-${idx}`}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Freight ({currencySymbol})</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              step="any" 
                              value={li.freight || ''} 
                              onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                              onChange={(e) => updateLineItem(idx, 'freight', parseFloat(e.target.value) || 0)} 
                            />
                          </div>
                          <div className="col-span-6">
                            <Label className="text-xs">Description (Optional)</Label>
                            <Input value={li.description} onChange={(e) => updateLineItem(idx, 'description', e.target.value)} placeholder="Item notes..." />
                          </div>
                          <div className="col-span-2 text-right pt-5">
                            <span className="font-bold text-primary text-lg">{currencySymbol}{calc.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Truck className="w-4 h-4" /> Invoice Freight ({currencySymbol})</Label>
                <Input type="number" min="0" step="any" value={form.freight_charges} onChange={(e) => updateFormField('freight_charges', parseFloat(e.target.value) || 0)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Other Charges ({currencySymbol})</Label>
                <Input type="number" min="0" step="any" value={form.other_charges} onChange={(e) => updateFormField('other_charges', parseFloat(e.target.value) || 0)} placeholder="0" />
              </div>
            </div>

            <div className="bg-accent/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-5 h-5" />
                <Label className="text-base font-semibold">Summary</Label>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="text-right">{currencySymbol}{form.subtotal.toLocaleString()}</span>
                <span className="text-muted-foreground">Discount:</span>
                <span className="text-right text-red-600">-{currencySymbol}{form.discount_amount.toLocaleString()}</span>
                
                {/* Show IGST for interstate, CGST+SGST for intrastate */}
                {isInterstate ? (
                  <>
                    <span className="text-muted-foreground flex items-center gap-1">
                      IGST:
                      <Badge variant="outline" className="text-xs font-normal">Interstate</Badge>
                    </span>
                    <span className="text-right">{currencySymbol}{form.tax_amount.toLocaleString()}</span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">CGST:</span>
                    <span className="text-right">{currencySymbol}{(form.tax_amount / 2).toLocaleString()}</span>
                    <span className="text-muted-foreground">SGST:</span>
                    <span className="text-right">{currencySymbol}{(form.tax_amount / 2).toLocaleString()}</span>
                  </>
                )}
                
                <span className="text-muted-foreground">Item Freight:</span>
                <span className="text-right">{currencySymbol}{lineItems.reduce((s, li) => s + (li.freight || 0), 0).toLocaleString()}</span>
                <span className="text-muted-foreground">Invoice Freight:</span>
                <span className="text-right">{currencySymbol}{(form.freight_charges || 0).toLocaleString()}</span>
                <span className="text-muted-foreground">Other Charges:</span>
                <span className="text-right">{currencySymbol}{(form.other_charges || 0).toLocaleString()}</span>
                <span className="font-bold text-base border-t pt-2">Grand Total:</span>
                <span className="font-bold text-base text-right text-primary border-t pt-2">{currencySymbol}{form.total_amount.toLocaleString()}</span>
              </div>
              
              {/* Interstate indicator */}
              {(supplierState || buyerState) && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                  <span className="font-medium">Transaction Type: </span>
                  {isInterstate ? (
                    <span className="text-orange-600">Interstate ({supplierState} → {buyerState}) - IGST Applicable</span>
                  ) : (
                    <span className="text-green-600">Intrastate ({supplierState || buyerState}) - CGST+SGST Applicable</span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Optional notes..." />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={clearForm}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  data-testid="clear-form-btn"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Clear
                </Button>
                {!editingInvoice && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={holdInvoice}
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    data-testid="hold-invoice-btn"
                  >
                    <Clock className="w-4 h-4 mr-1" /> Hold
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                <Button type="submit" data-testid="create-purchase-btn">
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Invoice Details - {showDetail?.invoice_number}</DialogTitle></DialogHeader>
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Supplier:</span> {getSupplierName(showDetail.supplier_id)}</div>
                <div><span className="text-muted-foreground">Store:</span> {getStoreName(showDetail.store_id)}</div>
                <div><span className="text-muted-foreground">Date:</span> {showDetail.invoice_date}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={showDetail.payment_status === 'paid' ? 'default' : 'secondary'}>{showDetail.payment_status}</Badge></div>
              </div>
              {showDetail.items?.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium mb-2">Items ({showDetail.items.length})</h4>
                  <div className="space-y-2">
                    {showDetail.items.map((it, i) => (
                      <div key={i} className="bg-accent/30 p-2 rounded text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">{getItemName(it.item_id)}</span>
                            {(it.size || it.color) && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {it.size && <Badge variant="outline" className="mr-1">{it.size}</Badge>}
                                {it.color && <Badge variant="outline" style={{backgroundColor: it.color?.toLowerCase(), color: ['White', 'Yellow', 'Cream', 'Beige', 'Peach'].includes(it.color) ? '#000' : '#fff'}}>{it.color}</Badge>}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-primary">{currencySymbol}{(it.amount || (it.quantity * it.rate)).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mt-1 text-xs text-muted-foreground">
                          <span>Qty: {it.quantity}</span>
                          <span>Rate: {currencySymbol}{it.rate}</span>
                          <span>GST: {it.gst_percent || 0}%</span>
                          <span>Disc: {it.discount_percent || 0}%</span>
                        </div>
                        {(it.freight > 0 || it.description) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {it.freight > 0 && <span>Freight: {currencySymbol}{it.freight} </span>}
                            {it.description && <span>• {it.description}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="text-right">{currencySymbol}{showDetail.subtotal?.toLocaleString()}</span>
                  {showDetail.discount_amount > 0 && <>
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="text-right text-red-600">-{currencySymbol}{showDetail.discount_amount?.toLocaleString()}</span>
                  </>}
                  {showDetail.tax_amount > 0 && <>
                    <span className="text-muted-foreground">GST:</span>
                    <span className="text-right">{currencySymbol}{showDetail.tax_amount?.toLocaleString()}</span>
                  </>}
                  {showDetail.freight_charges > 0 && <>
                    <span className="text-muted-foreground">Invoice Freight:</span>
                    <span className="text-right">{currencySymbol}{showDetail.freight_charges?.toLocaleString()}</span>
                  </>}
                  {showDetail.other_charges > 0 && <>
                    <span className="text-muted-foreground">Other Charges:</span>
                    <span className="text-right">{currencySymbol}{showDetail.other_charges?.toLocaleString()}</span>
                  </>}
                  <span className="font-bold border-t pt-1">Grand Total:</span>
                  <span className="font-bold text-right text-primary border-t pt-1">{currencySymbol}{showDetail.total_amount?.toLocaleString()}</span>
                </div>
              </div>
              {showDetail.notes && <p className="text-sm text-muted-foreground">Notes: {showDetail.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Supplier Modal */}
      <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier Name *</Label>
              <Input value={newSupplier.name} onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})} placeholder="Enter supplier name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={newSupplier.phone} onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})} placeholder="Phone number" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newSupplier.email} onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})} placeholder="Email address" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input value={newSupplier.gst_number} onChange={(e) => setNewSupplier({...newSupplier, gst_number: e.target.value})} placeholder="e.g., 29ABCDE1234F1Z5" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={newSupplier.address} onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})} placeholder="Full address" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
              <Button type="button" onClick={handleAddSupplier}><Plus className="w-4 h-4 mr-1" /> Add Supplier</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Product Modal */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input 
                value={newProduct.name} 
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} 
                placeholder="Enter product name"
                onKeyDown={(e) => e.key === 'Enter' && !addingProduct && handleAddProduct()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input 
                value={newProduct.sku} 
                onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})} 
                placeholder="Stock keeping unit"
                onKeyDown={(e) => e.key === 'Enter' && !addingProduct && handleAddProduct()}
              />
            </div>
            <div className="space-y-2">
              <Label>Price ({currencySymbol})</Label>
              <Input 
                type="number" 
                min="0" 
                step="any" 
                value={newProduct.selling_price} 
                onChange={(e) => setNewProduct({...newProduct, selling_price: parseFloat(e.target.value) || 0})}
                onKeyDown={(e) => e.key === 'Enter' && !addingProduct && handleAddProduct()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddProduct(false)} disabled={addingProduct}>Cancel</Button>
              <Button type="button" onClick={handleAddProduct} disabled={addingProduct}>
                {addingProduct ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Adding...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-1" /> Add Product</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Size Modal */}
      <Dialog open={showAddSize} onOpenChange={setShowAddSize}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Custom Size</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Size *</Label>
              <Input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="e.g., 46, XXXXXL, 14" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddSize(false)}>Cancel</Button>
              <Button type="button" onClick={handleAddSize}><Plus className="w-4 h-4 mr-1" /> Add Size</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Color Modal */}
      <Dialog open={showAddColor} onOpenChange={setShowAddColor}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Custom Color</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Color Name *</Label>
              <Input value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="e.g., Sky Blue, Mint Green" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddColor(false)}>Cancel</Button>
              <Button type="button" onClick={handleAddColor}><Plus className="w-4 h-4 mr-1" /> Add Color</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Invoice Scanner Modal */}
      <Dialog open={showAIScanner} onOpenChange={setShowAIScanner}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Invoice Scanner
            </DialogTitle>
            <DialogDescription>
              Upload a purchase invoice image or PDF to automatically extract supplier and item details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Upload Section */}
            {!scannedData && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,application/pdf"
                  className="hidden"
                  data-testid="invoice-file-input"
                />
                
                {isScanning ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                    <p className="text-lg font-medium">Analyzing invoice with AI...</p>
                    <p className="text-sm text-muted-foreground">This may take a few seconds</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                      <Camera className="w-8 h-8 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Upload Invoice</p>
                      <p className="text-sm text-muted-foreground">Drag & drop or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports: JPEG, PNG, WebP, GIF, PDF (max 10MB)</p>
                    </div>
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
                      data-testid="browse-invoice-btn"
                    >
                      <Upload className="w-4 h-4 mr-2" /> Browse Files
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Results Section */}
            {scannedData && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Invoice Scanned Successfully!</span>
                </div>
                
                {/* Extracted Data Preview */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Extracted Information:</h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Supplier:</span>
                      <p className="font-medium">{scannedData.extracted_data?.supplier_name || 'Not found'}</p>
                      {scannedData.supplier_match && (
                        <Badge variant="outline" className="mt-1 text-emerald-600 border-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" /> Matched
                        </Badge>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Invoice #:</span>
                      <p className="font-medium">{scannedData.extracted_data?.invoice_number || 'Not found'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <p className="font-medium">{scannedData.extracted_data?.invoice_date || 'Not found'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <p className="font-medium text-primary">{currencySymbol}{(scannedData.extracted_data?.total_amount || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Items Preview */}
                  {scannedData.extracted_data?.items?.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-muted-foreground text-sm">Items Found ({scannedData.extracted_data.items.length}):</span>
                      <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                        {scannedData.extracted_data.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm bg-white p-2 rounded">
                            <span className="truncate flex-1">{item.name || `Item ${i+1}`}</span>
                            <span className="text-muted-foreground mx-2">x{item.quantity || 1}</span>
                            <span className="font-medium">{currencySymbol}{(item.amount || item.rate * (item.quantity || 1)).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setScannedData(null); fileInputRef.current.value = ''; }}>
                    Scan Another
                  </Button>
                  <Button onClick={applyScannedData} className="bg-gradient-to-r from-violet-500 to-purple-600 text-white" data-testid="apply-scanned-data-btn">
                    <CheckCircle className="w-4 h-4 mr-2" /> Apply to Form
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
