import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { usePermissions } from '../contexts/PermissionContext';
import { ReadOnlyBanner, ActionGuard } from '../components/RBACComponents';
import { toast } from 'sonner';
import { 
  Plus, Search, Edit, Trash2, Package, X, PenLine, Sparkles, 
  ChevronRight, Layers, Image as ImageIcon, Tag, Barcode, Printer,
  Download, Share2, Eye, FileSpreadsheet, FileText, Upload, MoreVertical,
  Wand2, Loader2, RefreshCw, ShoppingCart, Camera, User, Maximize, Grid3X3,
  CreditCard, CheckSquare, Square, Settings, BarChart3
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import BarcodeLabelGenerator from '../components/BarcodeLabelGenerator';
import { CatalogueShareButton } from './PublicCatalogue';
import jsPDF from 'jspdf';
import SyncBar from '../components/SyncBar';

// Lazy load E-commerce Dashboard for Store Dashboard modal
const EcommercePage = lazy(() => import('./EcommercePage'));

export default function ItemsPage({ onNavigate }) {
  const { api, user } = useAuth();
  const { formatCurrency, formatWithConversion, getCurrencyInfo, displayCurrency, currencySymbol } = useCurrency();
  const { isReadOnly, canPerformAction } = usePermissions();
  const [items, setItems] = useState([]);
  const [timeout, setTimeout] = useState(false);
  const [font, setFont] = useState(false);
  const [fontSize, setFontSize] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showEcommerceDashboard, setShowEcommerceDashboard] = useState(false);

  // FIX: avoid null initial state (can cause conditional UI to briefly render/unrender -> flicker)
  // Use a stable default object and keep the "open" state separate.
  const EMPTY_ITEM = useRef(null);
  if (EMPTY_ITEM.current === null) {
    EMPTY_ITEM.current = {
      id: null,
      name: '',
      sku: '',
      style_code: '',
      category_id: '',
      brand_id: '',
      description: '',
      hsn_code: '',
      gst_slab_id: '',
      gst_rate: 18,
      gst_inclusive: false,
      mrp: 0,
      selling_price: 0,
      wholesale_price: 0,
      cost_price: 0,
      min_stock_alert: 5,
      quality: 'standard',
      unit: 'pcs',
      allow_returns: true,
      allow_discounts: true,
      images: [],
      variants: []
    };
  }
  const [editItem, setEditItem] = useState(EMPTY_ITEM.current);

  const [activeTab, setActiveTab] = useState('basic'); // basic, pricing, variants
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  const [selectedItemsForBarcode, setSelectedItemsForBarcode] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set()); // For mark all/unmark all
  const [stores, setStores] = useState([]);
  const [gstSlabs, setGstSlabs] = useState([]); // GST Slabs from master
  const [form, setForm] = useState({
    name: '', sku: '', style_code: '', category_id: '', brand_id: '', description: '',
    hsn_code: '', gst_slab_id: '', gst_rate: 18, gst_inclusive: false, mrp: 0, selling_price: 0, 
    wholesale_price: 0, cost_price: 0, min_stock_alert: 5, quality: 'standard', 
    unit: 'pcs', allow_returns: true, allow_discounts: true, images: [],
    variants: []
  });
  const [newVariant, setNewVariant] = useState({ size: '', color: '', barcode: '', mrp: '', selling_price: '', quantity: '' });
  
  // Quick Add Modal States
  const [showQuickAddCategory, setShowQuickAddCategory] = useState(false);
  const [showQuickAddBrand, setShowQuickAddBrand] = useState(false);
  const [quickAddCategoryName, setQuickAddCategoryName] = useState('');
  const [quickAddBrandName, setQuickAddBrandName] = useState('');
  
  // Predefined sizes and colors
  const PREDEFINED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46'];
  const PREDEFINED_COLORS = [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Red', hex: '#EF4444' },
    { name: 'Blue', hex: '#3B82F6' },
    { name: 'Navy', hex: '#1E3A5F' },
    { name: 'Green', hex: '#22C55E' },
    { name: 'Yellow', hex: '#EAB308' },
    { name: 'Orange', hex: '#F97316' },
    { name: 'Purple', hex: '#A855F7' },
    { name: 'Pink', hex: '#EC4899' },
    { name: 'Brown', hex: '#92400E' },
    { name: 'Grey', hex: '#6B7280' },
    { name: 'Beige', hex: '#D4B896' },
    { name: 'Maroon', hex: '#7F1D1D' },
  ];
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showColorSelector, setShowColorSelector] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const [customColor, setCustomColor] = useState('');
  
  // Bulk Import States
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const bulkImportFileRef = useRef(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // FIX: avoid null initial state which can cause conditional UI to briefly render/unrender (flash)
  // Use a stable default object; the modal visibility is controlled by `showViewModal`.
  const EMPTY_VIEW_ITEM = useRef(null);
  if (EMPTY_VIEW_ITEM.current === null) {
    EMPTY_VIEW_ITEM.current = { images: [], variants: [] };
  }
  const [viewItem, setViewItem] = useState(EMPTY_VIEW_ITEM.current);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // AI Image Generation States
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState('product');
  const [generatingAI, setGeneratingAI] = useState(false);

  // FIX: avoid null; use empty string as "no image" sentinel to prevent mount/unmount flicker
  // (UI should rely on `generatingAI` / `showAIGenerator` for loading/visibility).
  const [generatedImage, setGeneratedImage] = useState('');
  
  // Cart state
  const [addingToCart, setAddingToCart] = useState(false);
  // Quick Add Functions
  const handleQuickAddCategory = async () => {
    if (!quickAddCategoryName.trim()) return;
    try {
      const newCat = await api('/api/categories', { 
        method: 'POST', 
        body: JSON.stringify({ name: quickAddCategoryName.trim() }) 
      });
      setCategories([...categories, newCat]);
      setForm({ ...form, category_id: newCat.id });
      setQuickAddCategoryName('');
      setShowQuickAddCategory(false);
      toast.success('Category added');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleQuickAddBrand = async () => {
    if (!quickAddBrandName.trim()) return;
    try {
      const newBrand = await api('/api/brands', { 
        method: 'POST', 
        body: JSON.stringify({ name: quickAddBrandName.trim() }) 
      });
      setBrands([...brands, newBrand]);
      setForm({ ...form, brand_id: newBrand.id });
      setQuickAddBrandName('');
      setShowQuickAddBrand(false);
      toast.success('Brand added');
    } catch (err) {
      toast.error(err.message);
    }
  };


  const fetchData = async () => {
    try {
      // Fetch all data in parallel with individual error handling
      const [itemsData, catsData, brandsData, storesData, gstData, inventoryData] = await Promise.all([
        api(`/api/items?search=${search}`).catch(err => { console.error('Items fetch error:', err); return []; }),
        api('/api/categories').catch(err => { console.error('Categories fetch error:', err); return []; }),
        api('/api/brands').catch(err => { console.error('Brands fetch error:', err); return []; }),
        api('/api/stores').catch(err => { console.error('Stores fetch error:', err); return []; }),
        api('/api/gst-slabs').catch(() => []),
        api('/api/inventory').catch(() => []),
      ]);
      
      // Merge inventory stock data with items
      const itemsWithStock = (itemsData || []).map(item => {
        const itemInventory = (inventoryData || []).filter(inv => inv.item_id === item.id);
        const totalStock = itemInventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
        return { ...item, current_stock: item.current_stock || totalStock };
      });
      
      setItems(itemsWithStock);
      setCategories(catsData || []);
      setBrands(brandsData || []);
      setStores(storesData || []);
      setGstSlabs(gstData || []);
    } catch (err) {
      console.error('Failed to load items data:', err);
      toast.error('Failed to load items: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  // Handle edit query parameter from Inventory page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId && items.length > 0) {
      const itemToEdit = items.find(i => i.id === editId);
      if (itemToEdit) {
        openEdit(itemToEdit);
        // Clear the query parameter from URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [items]);

  // Listen for open-add-product event from Inventory page
  useEffect(() => {
    const handleOpenAddProduct = () => {
      setShowAddOptions(true);
    };
    
    window.addEventListener('open-add-product', handleOpenAddProduct);
    
    // Check if we should auto-open from URL or sessionStorage
    const shouldOpenAdd = sessionStorage.getItem('openAddProduct');
    if (shouldOpenAdd) {
      sessionStorage.removeItem('openAddProduct');
      setTimeout(() => setShowAddOptions(true), 300);
    }
    
    return () => window.removeEventListener('open-add-product', handleOpenAddProduct);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let itemId = editItem?.id;
      
      if (editItem) {
        await api(`/api/items/${editItem.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('Item updated successfully!');
      } else {
        const newItem = await api('/api/items', { method: 'POST', body: JSON.stringify(form) });
        itemId = newItem.id;
        toast.success('Call Successful! Product added to inventory', {
          duration: 4000,
          description: `${form.name} has been added successfully`
        });
      }

      // Handle variants
      if (form.variants.length > 0 && itemId) {
        for (const variant of form.variants) {
          // Check if this is an existing variant (has id) or new variant
          if (variant.id) {
            // Update existing variant
            await api(`/api/variants/${variant.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                item_id: itemId,
                size: variant.size,
                color: variant.color,
                barcode: variant.barcode,
                mrp: variant.mrp || form.mrp,
                selling_price: variant.selling_price || form.selling_price
              })
            });
            
            // Update inventory if quantity changed
            const qty = parseInt(variant.quantity) || 0;
            const currentStock = variant.currentStock || 0;
            const diff = qty - currentStock;
            if (diff !== 0) {
              const storeId = stores.length > 0 ? stores[0].id : 'default';
              await api(`/api/inventory/adjust?variant_id=${variant.id}&store_id=${storeId}&quantity=${diff}`, {
                method: 'POST'
              });
            }
          } else {
            // Create new variant
            const createdVariant = await api('/api/variants', {
              method: 'POST',
              body: JSON.stringify({
                item_id: itemId,
                size: variant.size,
                color: variant.color,
                barcode: variant.barcode,
                mrp: variant.mrp || form.mrp,
                selling_price: variant.selling_price || form.selling_price
              })
            });
            
            // If quantity is specified, create initial inventory
            const qty = parseInt(variant.quantity) || 0;
            if (qty > 0 && createdVariant?.id) {
              const storeId = stores.length > 0 ? stores[0].id : 'default';
              await api(`/api/inventory/adjust?variant_id=${createdVariant.id}&store_id=${storeId}&quantity=${qty}`, {
                method: 'POST'
              });
            }
          }
        }
      }

      setShowModal(false);
      setEditItem(null);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this item to Recycle Bin?\n\nYou can restore it within 30 days.')) return;
    try {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      toast.success('Item moved to Recycle Bin');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = async (item) => {
    setEditItem(item);
    // Fetch variants for this item
    let variants = [];
    try {
      variants = await api(`/api/variants?item_id=${item.id}`);
    } catch (err) {
      console.error('Failed to fetch variants');
    }
    
    setForm({
      name: item.name, sku: item.sku || '', style_code: item.style_code || '',
      category_id: item.category_id || '', brand_id: item.brand_id || '', 
      description: item.description || '', hsn_code: item.hsn_code || '', 
      gst_slab_id: item.gst_slab_id || '', gst_rate: item.gst_rate || 18, gst_inclusive: item.gst_inclusive || false,
      mrp: item.mrp || 0, selling_price: item.selling_price || 0,
      wholesale_price: item.wholesale_price || 0, cost_price: item.cost_price || 0, 
      min_stock_alert: item.min_stock_alert || 5, quality: item.quality || 'standard', 
      unit: item.unit || 'pcs', allow_returns: item.allow_returns !== false,
      allow_discounts: item.allow_discounts !== false, images: item.images || [],
      variants: variants.map(v => ({ id: v.id, size: v.size, color: v.color, barcode: v.barcode, mrp: v.mrp, selling_price: v.selling_price, quantity: v.current_stock || 0, currentStock: v.current_stock || 0 }))
    });
    setActiveTab('basic');
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({
      name: '', sku: '', style_code: '', category_id: '', brand_id: '', description: '',
      hsn_code: '', gst_slab_id: '', gst_rate: 18, gst_inclusive: false, mrp: 0, selling_price: 0, 
      wholesale_price: 0, cost_price: 0, min_stock_alert: 5, quality: 'standard', 
      unit: 'pcs', allow_returns: true, allow_discounts: true, images: [],
      variants: []
    });
    setNewVariant({ size: '', color: '', barcode: '', mrp: '', selling_price: '', quantity: '' });
    setActiveTab('basic');
  };

  const addVariant = () => {
    if (!newVariant.size && !newVariant.color) {
      toast.error('Please enter size or color for variant');
      return;
    }
    setForm(prev => ({
      ...prev,
      variants: [...prev.variants, { ...newVariant }]
    }));
    setNewVariant({ size: '', color: '', barcode: '', mrp: '', selling_price: '', quantity: '' });
    toast.success('Variant added');
  };

  const removeVariant = (index) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const openAddNew = () => {
    resetForm();
    setEditItem(null);
    setShowModal(true);
  };

  // Image upload handler with validation
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Validate files
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff'];
    
    const validFiles = files.filter(file => {
      // Handle filenames with spaces before extension
      const ext = file.name.split('.').pop()?.toLowerCase().trim() || '';
      const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(ext);
      const isValidSize = file.size <= maxSize;
      
      if (!isValidType) {
        toast.error(`${file.name}: Invalid file type. Allowed: JPG, PNG, GIF, WEBP`);
        return false;
      }
      if (!isValidSize) {
        toast.error(`${file.name}: File too large. Max 10MB allowed`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) return;
    
    setUploading(true);
    const uploadedUrls = [];
    
    for (const file of validFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/uploads/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(data.url);
        } else {
          const error = await response.json().catch(() => ({}));
          toast.error(`Failed to upload ${file.name}: ${error.detail || 'Server error'}`);
        }
      } catch (err) {
        console.error('Upload error:', err);
        toast.error(`Error uploading ${file.name}: Network error`);
      }
    }
    
    if (uploadedUrls.length > 0) {
      setForm(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // AI Image Generation
  const handleGenerateAIImage = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a description for your product image');
      return;
    }
    
    setGeneratingAI(true);
    setGeneratedImage(null);
    
    try {
      const formData = new FormData();
      formData.append('prompt', `${form.name || 'Product'}: ${aiPrompt}`);
      formData.append('style', aiStyle);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai/generate-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate image');
      }
      
      const data = await response.json();
      setGeneratedImage(data);
      toast.success('AI image generated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to generate AI image');
    } finally {
      setGeneratingAI(false);
    }
  };

  const useGeneratedImage = () => {
    if (generatedImage?.url) {
      setForm(prev => ({
        ...prev,
        images: [...prev.images, generatedImage.url]
      }));
      toast.success('AI image added to product');
      setShowAIGenerator(false);
      setGeneratedImage(null);
      setAiPrompt('');
    }
  };

  // Add to Cart function
  const addToCart = async (item) => {
    setAddingToCart(true);
    try {
      const cartItem = {
        item_id: item.id,
        name: item.name,
        brand: getBrandName(item.brand_id),
        price: item.selling_price,
        mrp: item.mrp,
        quantity: 1,
        image: item.images?.[0] || null,
        size: item.variants?.[0]?.size || null,
        color: item.variants?.[0]?.color || null
      };
      
      await api('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify(cartItem)
      });
      
      toast.success(`${item.name} added to cart!`, {
        action: {
          label: 'View Cart',
          onClick: () => window.dispatchEvent(new CustomEvent('open-cart'))
        }
      });
    } catch (err) {
      toast.error(err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  // View item details
  const openViewModal = async (item) => {
    let variants = [];
    try {
      variants = await api(`/api/variants?item_id=${item.id}`);
    } catch (err) {
      console.error('Failed to fetch variants');
    }
    setViewItem({ ...item, variants });
    setShowViewModal(true);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(20);
    doc.text('Product Catalogue', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 28, { align: 'center' });
    
    let y = 40;
    const lineHeight = 8;
    
    // Header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Item Name', 14, y);
    doc.text('SKU', 70, y);
    doc.text('Category', 100, y);
    doc.text('MRP', 140, y);
    doc.text('Price', 160, y);
    doc.text('Stock', 180, y);
    
    doc.setFont(undefined, 'normal');
    y += lineHeight;
    doc.line(14, y - 2, pageWidth - 14, y - 2);
    
    items.forEach((item, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(item.name?.substring(0, 25) || '-', 14, y);
      doc.text(item.sku || '-', 70, y);
      doc.text(getCategoryName(item.category_id)?.substring(0, 15) || '-', 100, y);
      doc.text(formatCurrency(item.mrp || 0), 140, y);
      doc.text(formatCurrency(item.selling_price || 0), 160, y);
      doc.text(`${item.current_stock || 0}`, 180, y);
      
      y += lineHeight;
    });
    
    doc.save('catalogue.pdf');
    toast.success('PDF exported successfully');
  };

  // Export to Excel/CSV
  const exportToExcel = () => {
    const headers = ['Item Name', 'SKU', 'Category', 'Brand', 'MRP', 'Selling Price', 'Cost Price', 'Stock', 'Unit', 'HSN Code'];
    const rows = items.map(item => [
      item.name,
      item.sku,
      getCategoryName(item.category_id),
      getBrandName(item.brand_id),
      item.mrp,
      item.selling_price,
      item.cost_price,
      item.current_stock || 0,
      item.unit,
      item.hsn_code
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `catalogue_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Excel/CSV exported successfully');
  };

  // Share on WhatsApp
  const shareOnWhatsApp = (item) => {
    const currencySymbol = getCurrencyInfo(displayCurrency).symbol;
    const text = `*${item.name}*\n\nSKU: ${item.sku}\nMRP: ${currencySymbol}${item.mrp}\nPrice: ${currencySymbol}${item.selling_price}\nStock: ${item.current_stock || 0}\n\n${item.description || ''}`;
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Share catalogue
  const shareCatalogue = () => {
    const currencySymbol = getCurrencyInfo(displayCurrency).symbol;
    const text = `*Product Catalogue*\n\n${items.slice(0, 10).map(item => 
      `• ${item.name} - ${currencySymbol}${item.selling_price} (${item.current_stock || 0} in stock)`
    ).join('\n')}\n\n${items.length > 10 ? `...and ${items.length - 10} more items` : ''}`;
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '-';
  const getBrandName = (id) => brands.find(b => b.id === id)?.name || '-';

  // Mark All / Unmark All functions
  const handleMarkAll = () => {
    const allIds = new Set(items.map(item => item.id));
    setSelectedItems(allIds);
    toast.success(`Selected all ${items.length} items`);
  };

  const handleUnmarkAll = () => {
    setSelectedItems(new Set());
    toast.success('Cleared selection');
  };

  const handleToggleItem = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.size} items?`)) return;
    
    try {
      for (const itemId of selectedItems) {
        await api(`/api/items/${itemId}`, { method: 'DELETE' });
      }
      toast.success(`Deleted ${selectedItems.size} items`);
      setSelectedItems(new Set());
      fetchData();
    } catch (err) {
      toast.error('Failed to delete some items');
    }
  };

  // ==================== BULK IMPORT FUNCTIONS ====================
  
  // Handle file selection for bulk import
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }
    
    setImportFile(file);
    
    // Parse file for preview
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const preview = await api('/api/items/import/preview', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set content-type for FormData
      });
      
      setImportPreview(preview.items || []);
      toast.success(`Found ${preview.items?.length || 0} items to import`);
    } catch (err) {
      toast.error(err.message || 'Failed to parse file');
      setImportFile(null);
    }
  };
  
  // Execute bulk import
  const handleBulkImport = async () => {
    if (!importFile || importPreview.length === 0) {
      toast.error('No items to import');
      return;
    }
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const result = await api('/api/items/import', {
        method: 'POST',
        body: formData,
        headers: {}
      });
      
      toast.success(`Imported ${result.imported} items successfully!`);
      if (result.errors?.length > 0) {
        toast.warning(`${result.errors.length} items had errors`);
      }
      
      setShowBulkImport(false);
      setImportFile(null);
      setImportPreview([]);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };
  
  // Download sample template
  const downloadTemplate = () => {
    const csvContent = `name,sku,category,brand,hsn_code,gst_rate,mrp,selling_price,cost_price,unit,min_stock_alert,description
"Sample Product","SKU001","Category Name","Brand Name","12345678","18","999","899","500","pcs","10","Product description here"
"Another Product","SKU002","Electronics","Samsung","98765432","12","1999","1799","1200","pcs","5","Another description"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };
  
  // ==================== END BULK IMPORT ====================

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="items-page">
      {/* Read-Only Banner for Viewers */}
      <ReadOnlyBanner module="Items & Inventory" />
      
      {/* Sync Bar */}
      <SyncBar api={api} onSyncComplete={fetchData} />
      
      {/* Header - Modern & Clean */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 sm:h-11 rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20"
              data-testid="items-search"
            />
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            {/* Actions Dropdown - Only show write actions for authorized users */}
            {canPerformAction('items', 'edit') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="actions-menu">
                    <MoreVertical className="w-4 h-4" /> Actions
                    {selectedItems.size > 0 && (
                      <Badge variant="secondary" className="ml-1">{selectedItems.size}</Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      handleMarkAll();
                    }} 
                    data-testid="mark-all-btn"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" /> Mark All
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      handleUnmarkAll();
                    }} 
                    data-testid="unmark-all-btn"
                  >
                    <Square className="w-4 h-4 mr-2" /> Unmark All
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      if (selectedItems.size === 0) {
                        toast.error('Select items first');
                        return;
                      }
                      setSelectedItemsForBarcode(items.filter(i => selectedItems.has(i.id)));
                      setShowBarcodeGenerator(true);
                    }}
                  >
                    <Printer className="w-4 h-4 mr-2" /> Print Barcodes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowBulkImport(true);
                    }}
                    className="text-green-600 dark:text-green-400"
                  >
                    <Upload className="w-4 h-4 mr-2" /> Bulk Import (Excel/CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      downloadTemplate();
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Download Template
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      handleBulkDelete();
                    }}
                    className="text-red-600 dark:text-red-400"
                    disabled={selectedItems.size === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedItems.size})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* E-Commerce Dashboard Link */}
            <Button 
              variant="outline" 
              onClick={() => setShowEcommerceDashboard(true)}
              className="gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 hover:from-purple-100 hover:to-indigo-100 text-purple-700"
              data-testid="ecommerce-dashboard-btn"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Store Dashboard</span>
            </Button>
            
            {/* Share Catalogue with QR Code */}
            <CatalogueShareButton tenantId={user?.tenant_id} storeName={user?.business_name || 'My Store'} />
          </div>
        </div>
        
        {/* Stats Bar */}
        {items.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">{items.length} products</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">{items.filter(i => i.current_stock > 0).length} in stock</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline text-amber-600 dark:text-amber-400">{items.filter(i => i.current_stock <= (i.min_stock_alert || 5) && i.current_stock > 0).length} low stock</span>
          </div>
        )}
      </div>

      {/* Items Grid - Product Photography Style */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {isReadOnly() 
                ? 'Contact your administrator to add products to the catalogue'
                : 'Start building your catalogue by adding your first product'}
            </p>
            {canPerformAction('items', 'create') && (
              <Button onClick={() => setShowAddOptions(true)} size="lg" className="rounded-full px-8">
                <Plus className="w-5 h-5 mr-2" /> Add First Product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
          {items.map((item) => {
            const hasDiscount = item.mrp > item.selling_price;
            const discountPercent = hasDiscount ? Math.round((1 - item.selling_price / item.mrp) * 100) : 0;
            const isLowStock = item.current_stock <= (item.min_stock_alert || 5);
            const isOutOfStock = item.current_stock <= 0;
            
            // Get sizes and colors from variants
            const sizes = item.variants?.map(v => v.size).filter(Boolean) || [];
            const colors = item.variants?.map(v => v.color).filter(Boolean) || [];
            const uniqueSizes = [...new Set(sizes)];
            const uniqueColors = [...new Set(colors)];
            
            // Calculate size-wise stock (size ratio)
            const sizeWiseStock = {};
            item.variants?.forEach(v => {
              if (v.size) {
                sizeWiseStock[v.size] = (sizeWiseStock[v.size] || 0) + (v.current_stock || 0);
              }
            });
            
            return (
              <div 
                key={item.id}
                className={`group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 border ${selectedItems.has(item.id) ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-100 dark:border-gray-800'}`}
                data-testid={`item-card-${item.id}`}
              >
                {/* Image Container */}
                <div className="relative aspect-square sm:aspect-[4/5] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                  {/* Selection Checkbox */}
                  <div 
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleItem(item.id);
                    }}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${selectedItems.has(item.id) ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/80 border-gray-300 hover:border-blue-400'}`}>
                      {selectedItems.has(item.id) && <CheckSquare className="w-4 h-4" />}
                    </div>
                  </div>
                  
                  {item.images?.[0] ? (
                    <img loading="lazy" 
                      src={item.images[0]} 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center mb-3 shadow-inner">
                        <span className="text-3xl sm:text-4xl font-bold text-gray-400 dark:text-gray-500">
                          {item.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Discount Badge */}
                  {hasDiscount && (
                    <div className="absolute top-2 sm:top-3 right-10 sm:right-12">
                      <div className="px-2 py-1 sm:px-2.5 sm:py-1 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-lg shadow-lg">
                        {discountPercent}% OFF
                      </div>
                    </div>
                  )}
                  
                  {/* AI Ready Badge */}
                  {item.ai_images_status === 'complete' && (
                    <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
                      <div className="px-1.5 py-0.5 bg-purple-500/90 text-white text-[9px] sm:text-[10px] font-medium rounded flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </div>
                    </div>
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 sm:p-4">
                    <div className="flex gap-1.5 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-white/95 hover:bg-white text-gray-900 text-[10px] sm:text-xs h-7 sm:h-8 rounded-lg shadow-lg px-2"
                        onClick={(e) => { e.stopPropagation(); openViewModal(item); }}
                        data-testid={`view-item-${item.id}`}
                      >
                        <Eye className="w-3 h-3 mr-0.5" /> View
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-[10px] sm:text-xs h-7 sm:h-8 rounded-lg shadow-lg px-2"
                        onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                        data-testid={`edit-item-${item.id}`}
                      >
                        <Edit className="w-3 h-3 mr-0.5" /> Edit
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] sm:text-xs h-7 sm:h-8 rounded-lg shadow-lg px-2"
                        onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                        disabled={addingToCart || item.current_stock <= 0}
                        data-testid={`add-to-cart-item-${item.id}`}
                      >
                        <ShoppingCart className="w-3 h-3 mr-0.5" /> Cart
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="h-7 sm:h-8 rounded-lg shadow-lg px-2"
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        data-testid={`delete-item-${item.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Product Info - Clean Catalogue Display */}
                <div className="p-3 sm:p-4 space-y-2">
                  {/* Brand Name */}
                  {item.brand_id && (
                    <p className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      {getBrandName(item.brand_id)}
                    </p>
                  )}
                  
                  {/* Product Name */}
                  <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white line-clamp-2 leading-tight">
                    {item.name}
                  </h3>
                  
                  {/* Size with Stock Ratio */}
                  {uniqueSizes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] sm:text-xs text-gray-500 font-medium">Size:</span>
                      <div className="flex gap-1 flex-wrap">
                        {uniqueSizes.slice(0, 5).map((size, idx) => (
                          <span key={idx} className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded ${
                            sizeWiseStock[size] > 0 
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          }`}>
                            {size}:{sizeWiseStock[size] || 0}
                          </span>
                        ))}
                        {uniqueSizes.length > 5 && (
                          <span className="text-[10px] sm:text-xs text-gray-400">+{uniqueSizes.length - 5}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Colour */}
                  {uniqueColors.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] sm:text-xs text-gray-500 font-medium">Colour:</span>
                      <div className="flex gap-1 flex-wrap">
                        {uniqueColors.slice(0, 4).map((color, idx) => (
                          <span key={idx} className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                            {color}
                          </span>
                        ))}
                        {uniqueColors.length > 4 && (
                          <span className="text-[10px] sm:text-xs text-gray-400">+{uniqueColors.length - 4}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Quantity */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] sm:text-xs text-gray-500 font-medium">Qty:</span>
                    <span className={`text-xs sm:text-sm font-semibold ${
                      isOutOfStock 
                        ? 'text-red-600 dark:text-red-400' 
                        : isLowStock 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isOutOfStock ? 'Out of Stock' : `${item.current_stock} pcs`}
                    </span>
                  </div>
                  
                  {/* Price Section - MRP & Selling Price */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        {hasDiscount && (
                          <p className="text-[10px] sm:text-xs text-gray-400">
                            MRP: <span className="line-through">{formatWithConversion(item.mrp)}</span>
                          </p>
                        )}
                        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                          {formatWithConversion(item.selling_price)}
                        </p>
                      </div>
                      {hasDiscount && (
                        <span className="text-[10px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md">
                          Save {formatWithConversion(item.mrp - item.selling_price)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Quick Actions - Purchase Only */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      className="flex-1 h-8 sm:h-9 text-xs sm:text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => addToCart(item)}
                      disabled={addingToCart || item.current_stock <= 0}
                      data-testid={`quick-add-cart-${item.id}`}
                    >
                      <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> 
                      {item.current_stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 sm:h-9 w-8 sm:w-9 p-0 rounded-lg border-gray-200 dark:border-gray-700"
                      onClick={() => openViewModal(item)}
                    >
                      <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Options Modal */}
      <Dialog open={showAddOptions} onOpenChange={setShowAddOptions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Add Items to Inventory
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-4 pt-4">
            {/* Manual Add Option */}
            <button
              onClick={() => { setShowAddOptions(false); openAddNew(); }}
              className="group flex flex-col p-6 rounded-xl border-2 border-border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
              data-testid="add-manually-btn"
            >
              <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <PenLine className="w-7 h-7 text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Add Manually</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Add New Item - Single Window
              </p>
              <p className="text-xs text-muted-foreground">
                Enter all item details including variants in one form
              </p>
              <div className="flex items-center gap-1 text-blue-600 text-sm mt-4 font-medium">
                Open Form <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Smart Scanner Option */}
            <button
              onClick={() => { setShowAddOptions(false); onNavigate && onNavigate('smart-scanner'); }}
              className="group flex flex-col p-6 rounded-xl border-2 border-border hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-left"
              data-testid="smart-scanner-btn"
            >
              <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Sparkles className="w-7 h-7 text-amber-600 group-hover:text-white" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">Smart Stock Scanner</h3>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-medium">AI</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                AI-powered inventory management
              </p>
              <p className="text-xs text-muted-foreground">
                Upload Excel or scan invoices to bulk add items
              </p>
              <div className="flex items-center gap-1 text-amber-600 text-sm mt-4 font-medium">
                Open Scanner <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Modal - Single Window with Tabs */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {editItem ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Tabs */}
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'basic' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Tag className="w-4 h-4 inline-block mr-2" />
              Basic Details
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'images' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <ImageIcon className="w-4 h-4 inline-block mr-2" />
              Images ({form.images.length})
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'pricing' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Tag className="w-4 h-4 inline-block mr-2" />
              Pricing & Tax
            </button>
            <button
              onClick={() => setActiveTab('variants')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'variants' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-4 h-4 inline-block mr-2" />
              Variants ({form.variants.length})
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Basic Details Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Item Name *</Label>
                      <Input 
                        value={form.name} 
                        onChange={(e) => setForm({...form, name: e.target.value})} 
                        required 
                        placeholder="Enter item name"
                        data-testid="item-name-input" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SKU (Auto-generated if empty)</Label>
                      <Input 
                        value={form.sku} 
                        onChange={(e) => setForm({...form, sku: e.target.value})} 
                        placeholder="SKU001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Style Code</Label>
                      <Input 
                        value={form.style_code} 
                        onChange={(e) => setForm({...form, style_code: e.target.value})} 
                        placeholder="Optional style code"
                      />
                    </div>
                    
                    {/* Category with + button */}
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <div className="flex gap-2">
                        <Select value={form.category_id} onValueChange={(v) => setForm({...form, category_id: v})}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button 
                          type="button" 
                          size="icon" 
                          variant="outline"
                          onClick={() => setShowQuickAddCategory(true)}
                          className="shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Brand with + button */}
                    <div className="space-y-2">
                      <Label>Brand</Label>
                      <div className="flex gap-2">
                        <Select value={form.brand_id} onValueChange={(v) => setForm({...form, brand_id: v})}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Select brand" /></SelectTrigger>
                          <SelectContent>
                            {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button 
                          type="button" 
                          size="icon" 
                          variant="outline"
                          onClick={() => setShowQuickAddBrand(true)}
                          className="shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select value={form.unit} onValueChange={(v) => setForm({...form, unit: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pcs">Pieces</SelectItem>
                          <SelectItem value="kg">Kilograms</SelectItem>
                          <SelectItem value="g">Grams</SelectItem>
                          <SelectItem value="m">Meters</SelectItem>
                          <SelectItem value="l">Liters</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
                          <SelectItem value="pair">Pair</SelectItem>
                          <SelectItem value="set">Set</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <textarea 
                      value={form.description} 
                      onChange={(e) => setForm({...form, description: e.target.value})}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background min-h-[80px] resize-none"
                      placeholder="Enter item description..."
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={form.allow_returns} 
                        onChange={(e) => setForm({...form, allow_returns: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-sm">Allow Returns</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={form.allow_discounts} 
                        onChange={(e) => setForm({...form, allow_discounts: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-sm">Allow Discounts</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className="space-y-4">
                  <div className="p-4 bg-accent/50 rounded-lg">
                    <p className="text-sm font-medium mb-1">Product Images</p>
                    <p className="text-xs text-muted-foreground">Upload multiple images for your product. First image will be the main display image.</p>
                  </div>
                  
                  {/* Upload Area */}
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Click to upload images</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, GIF up to 10MB each</p>
                    {uploading && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-primary">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Uploading...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* AI Buttons Row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Single AI Image Generator Button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-200 hover:border-purple-400 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20"
                      onClick={() => setShowAIGenerator(true)}
                      data-testid="ai-image-generator-btn"
                    >
                      <Wand2 className="w-4 h-4 text-purple-600" />
                      <span className="text-purple-700 dark:text-purple-300 font-medium text-sm">Generate AI Image</span>
                    </Button>
                  </div>
                  
                  {/* Image URL Input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Or paste image URL..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const url = e.target.value.trim();
                          if (url) {
                            setForm(prev => ({ ...prev, images: [...prev.images, url] }));
                            e.target.value = '';
                            toast.success('Image URL added');
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        const input = e.target.previousSibling;
                        const url = input?.value?.trim();
                        if (url) {
                          setForm(prev => ({ ...prev, images: [...prev.images, url] }));
                          input.value = '';
                          toast.success('Image URL added');
                        }
                      }}
                    >
                      Add URL
                    </Button>
                  </div>
                  
                  {/* Images Grid */}
                  {form.images.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {form.images.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                          <img loading="lazy" src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                          {idx === 0 && (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] rounded">
                              Main
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No images added yet</p>
                      <p className="text-xs">Upload or add URL to add product images</p>
                    </div>
                  )}
                </div>
              )}

              {/* Pricing & Tax Tab */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>MRP *</Label>
                      <Input 
                        type="number" 
                        value={form.mrp} 
                        onChange={(e) => setForm({...form, mrp: parseFloat(e.target.value) || 0})} 
                        required 
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Selling Price *</Label>
                      <Input 
                        type="number" 
                        value={form.selling_price} 
                        onChange={(e) => setForm({...form, selling_price: parseFloat(e.target.value) || 0})} 
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Wholesale Price</Label>
                      <Input 
                        type="number" 
                        value={form.wholesale_price} 
                        onChange={(e) => setForm({...form, wholesale_price: parseFloat(e.target.value) || 0})}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost Price</Label>
                      <Input 
                        type="number" 
                        value={form.cost_price} 
                        onChange={(e) => setForm({...form, cost_price: parseFloat(e.target.value) || 0})}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>HSN Code</Label>
                      <Input 
                        value={form.hsn_code} 
                        onChange={(e) => setForm({...form, hsn_code: e.target.value})}
                        placeholder="e.g., 6109"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>GST Slab *</Label>
                      <Select 
                        value={form.gst_slab_id || form.gst_rate.toString()} 
                        onValueChange={(v) => {
                          // Check if it's a slab ID or a legacy rate
                          const slab = gstSlabs.find(s => s.id === v);
                          if (slab) {
                            setForm({...form, gst_slab_id: v, gst_rate: slab.total_rate});
                          } else {
                            setForm({...form, gst_slab_id: '', gst_rate: parseFloat(v)});
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select GST Slab" /></SelectTrigger>
                        <SelectContent>
                          {gstSlabs.length > 0 ? (
                            gstSlabs.filter(s => s.is_active).map(slab => (
                              <SelectItem key={slab.id} value={slab.id}>
                                {slab.name} ({slab.total_rate}%)
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="5">5%</SelectItem>
                              <SelectItem value="12">12%</SelectItem>
                              <SelectItem value="18">18%</SelectItem>
                              <SelectItem value="28">28%</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">GST is auto-calculated from master</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={form.gst_inclusive} 
                        onChange={(e) => setForm({...form, gst_inclusive: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-sm">Prices are GST inclusive</span>
                    </label>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Min Stock Alert Level</Label>
                      <Input 
                        type="number" 
                        value={form.min_stock_alert} 
                        onChange={(e) => setForm({...form, min_stock_alert: parseInt(e.target.value) || 0})}
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground">Alert when stock falls below this</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Quality</Label>
                      <Select value={form.quality} onValueChange={(v) => setForm({...form, quality: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="economy">Economy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Variants Tab */}
              {activeTab === 'variants' && (
                <div className="space-y-4">
                  <div className="p-4 bg-accent/50 rounded-lg">
                    <p className="text-sm font-medium mb-1">Add Product Variants</p>
                    <p className="text-xs text-muted-foreground">Create variants for different sizes, colors, or other attributes</p>
                  </div>

                  {/* Add New Variant */}
                  <div className="grid grid-cols-7 gap-3 items-end p-4 border rounded-lg bg-card">
                    {/* Size Input with + Button */}
                    <div className="space-y-2">
                      <Label className="text-xs">Size</Label>
                      <div className="flex gap-1">
                        <Input 
                          value={newVariant.size} 
                          onChange={(e) => setNewVariant({...newVariant, size: e.target.value})}
                          placeholder="S, M, L..."
                          className="h-9 flex-1"
                        />
                        <Button 
                          type="button" 
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 p-0 bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                          onClick={() => setShowSizeSelector(!showSizeSelector)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {showSizeSelector && (
                        <div className="absolute z-50 mt-1 p-3 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-w-xs">
                          <p className="text-xs font-medium mb-2">Quick Select Size</p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {PREDEFINED_SIZES.map(size => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => {
                                  setNewVariant({...newVariant, size});
                                  setShowSizeSelector(false);
                                }}
                                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <Input 
                              value={customSize}
                              onChange={(e) => setCustomSize(e.target.value)}
                              placeholder="Custom size..."
                              className="h-8 text-xs"
                            />
                            <Button 
                              type="button" 
                              size="sm" 
                              className="h-8"
                              onClick={() => {
                                if (customSize) {
                                  setNewVariant({...newVariant, size: customSize});
                                  setCustomSize('');
                                  setShowSizeSelector(false);
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Color Input with + Button */}
                    <div className="space-y-2">
                      <Label className="text-xs">Color</Label>
                      <div className="flex gap-1">
                        <Input 
                          value={newVariant.color} 
                          onChange={(e) => setNewVariant({...newVariant, color: e.target.value})}
                          placeholder="Red, Blue..."
                          className="h-9 flex-1"
                        />
                        <Button 
                          type="button" 
                          size="sm"
                          variant="outline"
                          className="h-9 w-9 p-0 bg-green-500 hover:bg-green-600 text-white border-green-500"
                          onClick={() => setShowColorSelector(!showColorSelector)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {showColorSelector && (
                        <div className="absolute z-50 mt-1 p-3 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-w-xs">
                          <p className="text-xs font-medium mb-2">Quick Select Color</p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {PREDEFINED_COLORS.map(color => (
                              <button
                                key={color.name}
                                type="button"
                                onClick={() => {
                                  setNewVariant({...newVariant, color: color.name});
                                  setShowColorSelector(false);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 rounded"
                              >
                                <span 
                                  className="w-3 h-3 rounded-full border border-gray-300" 
                                  style={{ backgroundColor: color.hex }}
                                />
                                {color.name}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <Input 
                              value={customColor}
                              onChange={(e) => setCustomColor(e.target.value)}
                              placeholder="Custom color..."
                              className="h-8 text-xs"
                            />
                            <Button 
                              type="button" 
                              size="sm" 
                              className="h-8"
                              onClick={() => {
                                if (customColor) {
                                  setNewVariant({...newVariant, color: customColor});
                                  setCustomColor('');
                                  setShowColorSelector(false);
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Barcode</Label>
                      <Input 
                        value={newVariant.barcode} 
                        onChange={(e) => setNewVariant({...newVariant, barcode: e.target.value})}
                        placeholder="Optional"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">MRP (Optional)</Label>
                      <Input 
                        type="number"
                        value={newVariant.mrp} 
                        onChange={(e) => setNewVariant({...newVariant, mrp: e.target.value})}
                        placeholder={form.mrp.toString()}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Selling (Optional)</Label>
                      <Input 
                        type="number"
                        value={newVariant.selling_price} 
                        onChange={(e) => setNewVariant({...newVariant, selling_price: e.target.value})}
                        placeholder={form.selling_price.toString()}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Quantity</Label>
                      <Input 
                        type="number"
                        value={newVariant.quantity} 
                        onChange={(e) => setNewVariant({...newVariant, quantity: e.target.value})}
                        placeholder="0"
                        className="h-9"
                        min="0"
                        data-testid="variant-quantity-input"
                      />
                    </div>
                    <Button type="button" onClick={addVariant} className="h-9">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>

                  {/* Variants List */}
                  {form.variants.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No variants added yet</p>
                      <p className="text-xs">Add variants above to create different product options</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-accent">
                          <tr>
                            <th className="p-3 text-left">Size</th>
                            <th className="p-3 text-left">Color</th>
                            <th className="p-3 text-left">Barcode</th>
                            <th className="p-3 text-right">MRP</th>
                            <th className="p-3 text-right">Selling</th>
                            <th className="p-3 text-right">Qty</th>
                            <th className="p-3 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.variants.map((variant, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="p-3">{variant.size || '-'}</td>
                              <td className="p-3">{variant.color || '-'}</td>
                              <td className="p-3 font-mono text-xs">{variant.barcode || '-'}</td>
                              <td className="p-3 text-right font-mono">{formatWithConversion(variant.mrp || form.mrp)}</td>
                              <td className="p-3 text-right font-mono">{formatWithConversion(variant.selling_price || form.selling_price)}</td>
                              <td className="p-3 text-right font-mono">{variant.quantity || 0}</td>
                              <td className="p-3">
                                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => removeVariant(idx)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t bg-accent/30">
              <div className="text-sm text-muted-foreground">
                {form.variants.length > 0 && (
                  <span>{form.variants.length} variant(s) will be created</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" data-testid="save-item-btn">
                  {editItem ? 'Update' : 'Create'} Item
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Barcode Label Generator */}
      <BarcodeLabelGenerator
        isOpen={showBarcodeGenerator}
        onClose={() => setShowBarcodeGenerator(false)}
        items={selectedItemsForBarcode}
      />

      {/* View Item Modal - Clean Catalogue View */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Product View
            </DialogTitle>
          </DialogHeader>
          
          {viewItem && (
            <div className="space-y-6">
              {/* Main Product Image */}
              <div className="space-y-3">
                {/* Main Display Area */}
                <div className="relative aspect-video bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl overflow-hidden">
                  {viewItem.images?.[0] ? (
                    <img loading="lazy" src={viewItem.images[0]} alt={viewItem.name} className="w-full h-full object-contain transition-opacity duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Package className="w-16 h-16 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-400">No image available</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Thumbnail Strip - Show all uploaded images */}
                {viewItem.images?.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {viewItem.images.map((img, idx) => (
                      <button
                        key={idx}
                        className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-300"
                      >
                        <img loading="lazy" src={img} alt={`${viewItem.name} ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Product Info - Simplified for Catalogue */}
              <div className="space-y-4">
                {/* Brand */}
                {viewItem.brand_id && (
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                    {getBrandName(viewItem.brand_id)}
                  </p>
                )}
                
                {/* Name */}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{viewItem.name}</h2>
                
                {/* Size & Color */}
                <div className="flex flex-wrap gap-4">
                  {viewItem.variants?.length > 0 && (
                    <>
                      <div>
                        <span className="text-xs text-gray-500 font-medium">Size Available:</span>
                        <div className="flex gap-1 mt-1">
                          {[...new Set(viewItem.variants.map(v => v.size).filter(Boolean))].map((size, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{size}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 font-medium">Colour:</span>
                        <div className="flex gap-1 mt-1">
                          {[...new Set(viewItem.variants.map(v => v.color).filter(Boolean))].map((color, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{color}</Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Quantity */}
                <div>
                  <span className="text-xs text-gray-500 font-medium">Quantity:</span>
                  <span className={`ml-2 font-semibold ${
                    viewItem.current_stock <= 0 ? 'text-red-600' : 
                    viewItem.current_stock <= (viewItem.min_stock_alert || 5) ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {viewItem.current_stock <= 0 ? 'Out of Stock' : `${viewItem.current_stock} pieces left`}
                  </span>
                </div>
                
                {/* Pricing - MRP & Selling Price */}
                <div className="flex items-end gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">MRP</p>
                    <p className="text-lg text-gray-400 line-through">{formatWithConversion(viewItem.mrp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Selling Price</p>
                    <p className="text-3xl font-bold text-emerald-600">{formatWithConversion(viewItem.selling_price)}</p>
                  </div>
                  {viewItem.mrp > viewItem.selling_price && (
                    <Badge className="bg-red-500 text-white">
                      {Math.round((1 - viewItem.selling_price / viewItem.mrp) * 100)}% OFF
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Actions - Purchase Flow */}
              <div className="space-y-3 pt-4 border-t">
                {/* Virtual Try-On Button - Full Width */}
                {viewItem.images?.[0] && (
                  <Button 
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white h-12 text-base gap-2"
                    onClick={() => {
                      setShowViewModal(false);
                      // Navigate to Virtual Trial Room with selected product
                      window.location.href = `/virtual-trial-room?product=${viewItem.id}`;
                    }}
                    data-testid="virtual-tryon-btn"
                  >
                    <Sparkles className="w-5 h-5" /> Virtual Try-On (AI)
                  </Button>
                )}
                
                <div className="flex gap-3">
                  <Button 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
                    onClick={() => addToCart(viewItem)}
                    disabled={addingToCart || viewItem.current_stock <= 0}
                    data-testid="add-to-cart-btn"
                  >
                    {addingToCart ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Adding...</>
                    ) : (
                      <><ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart</>
                    )}
                  </Button>
                  <Button 
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-12 text-base"
                    onClick={async () => {
                      await addToCart(viewItem);
                      setShowViewModal(false);
                      window.dispatchEvent(new CustomEvent('open-cart'));
                    }}
                    disabled={addingToCart || viewItem.current_stock <= 0}
                    data-testid="buy-now-btn"
                  >
                    <CreditCard className="w-5 h-5 mr-2" /> Buy Now
                  </Button>
                  <Button variant="outline" className="h-12" onClick={() => setShowViewModal(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Category Modal */}
      <Dialog open={showQuickAddCategory} onOpenChange={setShowQuickAddCategory}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={quickAddCategoryName}
                onChange={(e) => setQuickAddCategoryName(e.target.value)}
                placeholder="Enter category name"
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAddCategory()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowQuickAddCategory(false)}>
                Cancel
              </Button>
              <Button onClick={handleQuickAddCategory} disabled={!quickAddCategoryName.trim()}>
                <Plus className="w-4 h-4 mr-2" /> Add Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Brand Modal */}
      <Dialog open={showQuickAddBrand} onOpenChange={setShowQuickAddBrand}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Brand
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input
                value={quickAddBrandName}
                onChange={(e) => setQuickAddBrandName(e.target.value)}
                placeholder="Enter brand name"
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAddBrand()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowQuickAddBrand(false)}>
                Cancel
              </Button>
              <Button onClick={handleQuickAddBrand} disabled={!quickAddBrandName.trim()}>
                <Plus className="w-4 h-4 mr-2" /> Add Brand
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Image Generator Modal */}
      <Dialog open={showAIGenerator} onOpenChange={setShowAIGenerator}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              AI Product Image Generator
              <Sparkles className="w-4 h-4 text-pink-500" />
            </DialogTitle>
            <DialogDescription>
              Describe your product and let AI create a professional product image for your catalogue.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Product Name Context */}
            {form.name && (
              <div className="p-3 bg-accent/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Generating image for:</p>
                <p className="font-medium">{form.name}</p>
              </div>
            )}
            
            {/* Prompt Input */}
            <div className="space-y-2">
              <Label>Describe Your Product</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="E.g., A premium cotton t-shirt in navy blue color, folded neatly..."
                rows={3}
                disabled={generatingAI}
                data-testid="ai-prompt-input"
              />
            </div>
            
            {/* Style Selection */}
            <div className="space-y-2">
              <Label>Image Style</Label>
              <Select value={aiStyle} onValueChange={setAiStyle} disabled={generatingAI}>
                <SelectTrigger data-testid="ai-style-select">
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product Photography (White Background)</SelectItem>
                  <SelectItem value="lifestyle">Lifestyle (Natural Setting)</SelectItem>
                  <SelectItem value="minimal">Minimalist (Clean & Simple)</SelectItem>
                  <SelectItem value="vibrant">Vibrant (Colorful & Bold)</SelectItem>
                  <SelectItem value="luxury">Luxury (Premium & Elegant)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Generated Image Preview */}
            {generatedImage && (
              <div className="space-y-2">
                <Label>Generated Image</Label>
                <div className="relative border rounded-lg overflow-hidden bg-muted aspect-square max-w-xs mx-auto">
                  <img loading="lazy" 
                    src={generatedImage.base64 || generatedImage.url} 
                    alt="AI Generated" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
            
            {/* Generation in Progress */}
            {generatingAI && (
              <div className="text-center py-6">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 border-4 border-purple-200 rounded-full" />
                  <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin" />
                  <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Generating your AI image...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take up to 30 seconds</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAIGenerator(false);
                setGeneratedImage(null);
                setAiPrompt('');
              }}
              disabled={generatingAI}
            >
              Cancel
            </Button>
            
            {generatedImage ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleGenerateAIImage}
                  disabled={generatingAI}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </Button>
                <Button 
                  onClick={useGeneratedImage}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  data-testid="use-ai-image-btn"
                >
                  <Sparkles className="w-4 h-4" /> Use This Image
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleGenerateAIImage}
                disabled={generatingAI || !aiPrompt.trim()}
                className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                data-testid="generate-ai-image-btn"
              >
                {generatingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" /> Generate Image
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* E-Commerce Store Dashboard Dialog */}
      <Dialog open={showEcommerceDashboard} onOpenChange={setShowEcommerceDashboard}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Store Dashboard
              <Badge variant="outline" className="ml-2 text-xs">Orders, Settings & Blog</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <EcommercePage />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-600" />
              Bulk Import Items
            </DialogTitle>
            <DialogDescription>
              Import multiple items from an Excel (.xlsx) or CSV file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File Upload Area */}
            <div 
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => bulkImportFileRef.current?.click()}
            >
              <input
                ref={bulkImportFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {importFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-green-600" />
                  <p className="font-medium">{importFile.name}</p>
                  <p className="text-sm text-muted-foreground">{importPreview.length} items ready to import</p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImportFile(null);
                      setImportPreview([]);
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <p className="font-medium">Click to upload or drag & drop</p>
                  <p className="text-sm text-muted-foreground">Excel (.xlsx, .xls) or CSV files</p>
                </div>
              )}
            </div>

            {/* Preview Table */}
            {importPreview.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b flex justify-between items-center">
                  <span className="font-medium">Preview (First 5 items)</span>
                  <Badge variant="secondary">{importPreview.length} total</Badge>
                </div>
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">SKU</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">MRP</th>
                        <th className="text-right p-2">Selling Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 5).map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 font-mono text-xs">{item.sku || '-'}</td>
                          <td className="p-2">{item.category || '-'}</td>
                          <td className="p-2 text-right">{formatWithConversion(item.mrp || 0)}</td>
                          <td className="p-2 text-right">{formatWithConversion(item.selling_price || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Download Template Link */}
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <span className="text-sm">Need a template?</span>
              </div>
              <Button variant="link" size="sm" onClick={downloadTemplate}>
                Download Sample Template
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkImport(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkImport}
              disabled={importing || importPreview.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Import {importPreview.length} Items</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
