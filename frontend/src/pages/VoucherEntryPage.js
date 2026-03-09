import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  FileText, Plus, Edit2, Trash2, Search, Check, X, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw, Filter, Calendar,
  Save, ChevronDown, Eye, CheckCircle, XCircle, AlertCircle,
  CreditCard, Wallet, BookOpen, ShoppingCart, Package, ArrowLeftRight,
  Keyboard
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useCurrency } from '../contexts/CurrencyContext';
import { Textarea } from '../components/ui/textarea';

// Voucher type icons, colors and keyboard shortcuts (Tally-style)
const VOUCHER_ICONS = {
  payment: { icon: ArrowUpRight, color: 'text-red-600', bg: 'bg-red-50', label: 'Payment', shortcut: 'F5' },
  receipt: { icon: ArrowDownRight, color: 'text-green-600', bg: 'bg-green-50', label: 'Receipt', shortcut: 'F6' },
  journal: { icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Journal', shortcut: 'F7' },
  contra: { icon: ArrowLeftRight, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Contra', shortcut: 'F4' },
  sales: { icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Sales', shortcut: 'F8' },
  purchase: { icon: Package, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Purchase', shortcut: 'F9' }
};

// Shortcut to voucher type mapping
const SHORTCUT_TO_TYPE = {
  'F4': 'contra',
  'F5': 'payment',
  'F6': 'receipt',
  'F7': 'journal',
  'F8': 'sales',
  'F9': 'purchase'
};

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle }
};

// Indian states with codes for GST
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
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' }
];

// GST rates commonly used
const GST_RATES = [0, 5, 12, 18, 28];

export default function VoucherEntryPage() {
  const { api } = useAuth();
  const { formatCurrency } = useCurrency();
  
  // State
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Dialog states
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [rejectingVoucher, setRejectingVoucher] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Default line item structure (with GST fields)
  const defaultLineItem = { 
    ledger_id: '', ledger_name: '', debit: 0, credit: 0, narration: '',
    hsn_code: '', gst_rate: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0, cess: 0
  };
  
  // Form state
  const [voucherForm, setVoucherForm] = useState({
    voucher_type: 'payment',
    date: new Date().toISOString().split('T')[0],
    line_items: [{ ...defaultLineItem }, { ...defaultLineItem }],
    narration: '',
    reference_number: '',
    reference_date: '',
    // GST fields
    party_gstin: '',
    place_of_supply: '',
    supply_type: 'intrastate'
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vouchersRes, ledgersRes, statsRes] = await Promise.all([
        api(`/api/accounting-vouchers?limit=500${filterType ? `&voucher_type=${filterType}` : ''}${filterStatus ? `&status=${filterStatus}` : ''}`),
        api('/api/ledger-management/ledgers?active_only=true&limit=1000'),
        api('/api/accounting-vouchers/summary/stats')
      ]);
      
      setVouchers(vouchersRes.vouchers || []);
      setLedgers(ledgersRes.ledgers || []);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load voucher data:', err);
      toast.error('Failed to load voucher data');
    } finally {
      setLoading(false);
    }
  }, [api, filterType, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for external voucher type event (from TallyShortcutBar)
  useEffect(() => {
    const handleOpenVoucherType = (e) => {
      const { voucherType } = e.detail;
      if (voucherType && VOUCHER_ICONS[voucherType]) {
        setEditingVoucher(null);
        setVoucherForm({
          voucher_type: voucherType,
          date: new Date().toISOString().split('T')[0],
          line_items: [{ ...defaultLineItem }, { ...defaultLineItem }],
          narration: '',
          reference_number: '',
          reference_date: '',
          party_gstin: '',
          place_of_supply: '',
          supply_type: 'intrastate'
        });
        setShowVoucherDialog(true);
      }
    };

    window.addEventListener('open-voucher-type', handleOpenVoucherType);
    return () => window.removeEventListener('open-voucher-type', handleOpenVoucherType);
  }, []);

  // Tally-style keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // When dialog is open - these should work inside the dialog
      if (showVoucherDialog) {
        // F4-F9: Change voucher type within dialog
        if (e.key in SHORTCUT_TO_TYPE) {
          e.preventDefault();
          e.stopPropagation();
          const voucherType = SHORTCUT_TO_TYPE[e.key];
          setVoucherForm(prev => {
            // Only update if type is changing
            if (prev.voucher_type !== voucherType) {
              toast.info(`Switched to ${VOUCHER_ICONS[voucherType].label}`, { duration: 1500 });
              return { ...prev, voucher_type: voucherType };
            }
            return prev;
          });
          return;
        }
        
        // Ctrl+S: Save voucher
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          e.stopPropagation();
          handleSubmitVoucher();
          return;
        }
        
        // Alt+A: Add line item (Add Row)
        if (e.altKey && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          e.stopPropagation();
          addLineItem();
          toast.info('Row added', { duration: 1000 });
          return;
        }
        
        // Escape: Close dialog
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowVoucherDialog(false);
          return;
        }
      } else {
        // F4-F9: Open new voucher with specific type (when dialog is closed)
        if (e.key in SHORTCUT_TO_TYPE) {
          e.preventDefault();
          const voucherType = SHORTCUT_TO_TYPE[e.key];
          setEditingVoucher(null);
          setVoucherForm({
            voucher_type: voucherType,
            date: new Date().toISOString().split('T')[0],
            line_items: [{ ...defaultLineItem }, { ...defaultLineItem }],
            narration: '',
            reference_number: '',
            reference_date: '',
            party_gstin: '',
            place_of_supply: '',
            supply_type: 'intrastate'
          });
          setShowVoucherDialog(true);
          toast.info(`Creating ${VOUCHER_ICONS[voucherType].label} Voucher`, { duration: 1500 });
        }
        
        // Alt+C: Create new voucher (general)
        if (e.altKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          resetVoucherForm();
          setShowVoucherDialog(true);
        }
      }
    };
    
    // Use capture phase to ensure we get the event first
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showVoucherDialog]);

  // Add line item
  const addLineItem = () => {
    setVoucherForm(prev => ({
      ...prev,
      line_items: [...prev.line_items, { ...defaultLineItem }]
    }));
  };

  // Remove line item
  const removeLineItem = (index) => {
    if (voucherForm.line_items.length <= 2) {
      toast.error('Minimum 2 line items required');
      return;
    }
    setVoucherForm(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  // Update line item with GST auto-calculation
  const updateLineItem = (index, field, value) => {
    setVoucherForm(prev => {
      const items = [...prev.line_items];
      items[index] = { ...items[index], [field]: value };
      
      // If ledger changed, update ledger_name
      if (field === 'ledger_id') {
        const ledger = ledgers.find(l => l.id === value);
        items[index].ledger_name = ledger?.name || '';
      }
      
      // Auto-calculate GST when taxable_value or gst_rate changes (for Sales/Purchase)
      if ((field === 'taxable_value' || field === 'gst_rate') && 
          (prev.voucher_type === 'sales' || prev.voucher_type === 'purchase')) {
        const taxableValue = field === 'taxable_value' ? parseFloat(value) || 0 : parseFloat(items[index].taxable_value) || 0;
        const gstRate = field === 'gst_rate' ? parseFloat(value) || 0 : parseFloat(items[index].gst_rate) || 0;
        
        if (prev.supply_type === 'interstate') {
          // IGST for interstate
          items[index].igst = (taxableValue * gstRate / 100);
          items[index].cgst = 0;
          items[index].sgst = 0;
        } else {
          // CGST + SGST for intrastate
          items[index].cgst = (taxableValue * gstRate / 100 / 2);
          items[index].sgst = (taxableValue * gstRate / 100 / 2);
          items[index].igst = 0;
        }
        
        // Auto-fill debit/credit based on voucher type
        const totalTax = items[index].cgst + items[index].sgst + items[index].igst;
        const totalAmount = taxableValue + totalTax;
        if (prev.voucher_type === 'sales') {
          items[index].credit = totalAmount;
          items[index].debit = 0;
        } else if (prev.voucher_type === 'purchase') {
          items[index].debit = totalAmount;
          items[index].credit = 0;
        }
      }
      
      return { ...prev, line_items: items };
    });
  };
  
  // Update supply type and recalculate GST
  const updateSupplyType = (supplyType) => {
    setVoucherForm(prev => {
      const updatedItems = prev.line_items.map(item => {
        if ((prev.voucher_type === 'sales' || prev.voucher_type === 'purchase') && 
            item.taxable_value && item.gst_rate) {
          const taxableValue = parseFloat(item.taxable_value) || 0;
          const gstRate = parseFloat(item.gst_rate) || 0;
          
          if (supplyType === 'interstate') {
            return {
              ...item,
              igst: (taxableValue * gstRate / 100),
              cgst: 0,
              sgst: 0,
              debit: prev.voucher_type === 'purchase' ? taxableValue + (taxableValue * gstRate / 100) : 0,
              credit: prev.voucher_type === 'sales' ? taxableValue + (taxableValue * gstRate / 100) : 0
            };
          } else {
            return {
              ...item,
              cgst: (taxableValue * gstRate / 100 / 2),
              sgst: (taxableValue * gstRate / 100 / 2),
              igst: 0,
              debit: prev.voucher_type === 'purchase' ? taxableValue + (taxableValue * gstRate / 100) : 0,
              credit: prev.voucher_type === 'sales' ? taxableValue + (taxableValue * gstRate / 100) : 0
            };
          }
        }
        return item;
      });
      
      return { ...prev, supply_type: supplyType, line_items: updatedItems };
    });
  };

  // Calculate totals
  const totalDebit = voucherForm.line_items.reduce((sum, item) => sum + (parseFloat(item.debit) || 0), 0);
  const totalCredit = voucherForm.line_items.reduce((sum, item) => sum + (parseFloat(item.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Handle form submit
  const handleSubmitVoucher = async () => {
    if (!voucherForm.voucher_type) {
      toast.error('Please select voucher type');
      return;
    }
    
    if (!voucherForm.date) {
      toast.error('Please select date');
      return;
    }
    
    // Validate line items
    const validItems = voucherForm.line_items.filter(item => 
      item.ledger_id && (item.debit > 0 || item.credit > 0)
    );
    
    if (validItems.length < 2) {
      toast.error('At least 2 valid line items required');
      return;
    }
    
    if (!isBalanced) {
      toast.error(`Debit (${formatCurrency(totalDebit)}) must equal Credit (${formatCurrency(totalCredit)})`);
      return;
    }
    
    try {
      const payload = {
        ...voucherForm,
        line_items: validItems.map(item => ({
          ...item,
          debit: parseFloat(item.debit) || 0,
          credit: parseFloat(item.credit) || 0
        }))
      };
      
      if (editingVoucher) {
        await api(`/api/accounting-vouchers/${editingVoucher.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('Voucher updated successfully');
      } else {
        await api('/api/accounting-vouchers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('Voucher created successfully');
      }
      
      setShowVoucherDialog(false);
      setEditingVoucher(null);
      resetVoucherForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save voucher');
    }
  };

  // Reset form
  const resetVoucherForm = () => {
    setVoucherForm({
      voucher_type: 'payment',
      date: new Date().toISOString().split('T')[0],
      line_items: [{ ...defaultLineItem }, { ...defaultLineItem }],
      narration: '',
      reference_number: '',
      reference_date: '',
      party_gstin: '',
      place_of_supply: '',
      supply_type: 'intrastate'
    });
  };

  // Open edit dialog
  const openEditVoucher = (voucher) => {
    if (voucher.status !== 'pending') {
      toast.error('Can only edit pending vouchers');
      return;
    }
    setEditingVoucher(voucher);
    setVoucherForm({
      voucher_type: voucher.voucher_type,
      date: voucher.date,
      line_items: voucher.line_items.length > 0 ? voucher.line_items.map(item => ({
        ...defaultLineItem,
        ...item
      })) : [{ ...defaultLineItem }, { ...defaultLineItem }],
      narration: voucher.narration || '',
      reference_number: voucher.reference_number || '',
      reference_date: voucher.reference_date || '',
      party_gstin: voucher.party_gstin || '',
      place_of_supply: voucher.place_of_supply || '',
      supply_type: voucher.supply_type || 'intrastate'
    });
    setShowVoucherDialog(true);
  };

  // View voucher detail
  const viewVoucher = async (voucherId) => {
    try {
      const detail = await api(`/api/accounting-vouchers/${voucherId}`);
      setViewingVoucher(detail);
      setShowDetailDialog(true);
    } catch (err) {
      toast.error('Failed to load voucher details');
    }
  };

  // Approve voucher
  const approveVoucher = async (voucherId) => {
    if (!window.confirm('Are you sure you want to approve this voucher? It will be posted to ledgers.')) return;
    
    try {
      await api(`/api/accounting-vouchers/${voucherId}/approve`, { method: 'POST' });
      toast.success('Voucher approved and posted to ledgers');
      fetchData();
      setShowDetailDialog(false);
    } catch (err) {
      toast.error(err.message || 'Failed to approve voucher');
    }
  };

  // Reject voucher
  const rejectVoucher = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    try {
      await api(`/api/accounting-vouchers/${rejectingVoucher.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason })
      });
      toast.success('Voucher rejected');
      setShowRejectDialog(false);
      setRejectingVoucher(null);
      setRejectReason('');
      fetchData();
      setShowDetailDialog(false);
    } catch (err) {
      toast.error(err.message || 'Failed to reject voucher');
    }
  };

  // Delete voucher
  const deleteVoucher = async (voucherId) => {
    if (!window.confirm('Are you sure you want to delete this voucher?')) return;
    
    try {
      await api(`/api/accounting-vouchers/${voucherId}`, { method: 'DELETE' });
      toast.success('Voucher deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete voucher');
    }
  };

  // Filter vouchers
  const filteredVouchers = vouchers.filter(v => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!v.voucher_number?.toLowerCase().includes(search) &&
          !v.narration?.toLowerCase().includes(search) &&
          !v.reference_number?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (activeTab !== 'all' && v.status !== activeTab) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="voucher-entry-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Voucher Entry
          </h1>
          <p className="text-gray-500 mt-1">Create and manage vouchers with approval workflow</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Keyboard Shortcuts Hint */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500 mr-2">
            <Keyboard className="w-4 h-4" />
            <span className="flex gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">F4</kbd>Contra
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">F5</kbd>Payment
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">F6</kbd>Receipt
            </span>
          </div>
          <Button variant="outline" onClick={fetchData} data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setEditingVoucher(null);
              resetVoucherForm();
              setShowVoucherDialog(true);
            }}
            data-testid="create-voucher-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Voucher (Alt+C)
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-yellow-600 uppercase">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">{stats.pending || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-green-600 uppercase">Approved</p>
            <p className="text-2xl font-bold text-green-700">{stats.approved || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-red-600 uppercase">Rejected</p>
            <p className="text-2xl font-bold text-red-700">{stats.rejected || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Today</p>
            <p className="text-2xl font-bold text-blue-600">{stats.today || 0}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500 uppercase mb-2">By Type</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_type || {}).map(([type, count]) => {
                const config = VOUCHER_ICONS[type];
                return (
                  <Badge key={type} variant="outline" className={`${config?.bg} ${config?.color}`}>
                    {config?.label}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Tabs */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending" className="text-yellow-600">
              <Clock className="w-4 h-4 mr-1" /> Pending
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" /> Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-red-600">
              <XCircle className="w-4 h-4 mr-1" /> Rejected
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search vouchers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-vouchers"
            />
          </div>
          <Select value={filterType || "all"} onValueChange={(val) => setFilterType(val === "all" ? "" : val)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(VOUCHER_ICONS).map(([type, config]) => (
                <SelectItem key={type} value={type}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Voucher List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Voucher No.</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Narration</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No vouchers found</p>
                      <Button 
                        variant="link" 
                        onClick={() => setShowVoucherDialog(true)}
                        className="mt-2"
                      >
                        Create your first voucher
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map(voucher => {
                    const typeConfig = VOUCHER_ICONS[voucher.voucher_type] || VOUCHER_ICONS.journal;
                    const statusConfig = STATUS_COLORS[voucher.status] || STATUS_COLORS.pending;
                    const TypeIcon = typeConfig.icon;
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <tr key={voucher.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono font-medium text-gray-900">{voucher.voucher_number}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${typeConfig.bg}`}>
                              <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                            </div>
                            <span className="text-sm">{voucher.voucher_type_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{voucher.date}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-medium">{formatCurrency(voucher.total_debit || 0)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600 truncate max-w-[200px] block">
                            {voucher.narration || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={`${statusConfig.bg} ${statusConfig.text}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {voucher.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewVoucher(voucher.id)}
                              data-testid={`view-voucher-${voucher.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {voucher.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => approveVoucher(voucher.id)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  data-testid={`approve-voucher-${voucher.id}`}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditVoucher(voucher)}
                                  data-testid={`edit-voucher-${voucher.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteVoucher(voucher.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`delete-voucher-${voucher.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* Create/Edit Voucher Dialog */}
      <Dialog open={showVoucherDialog} onOpenChange={setShowVoucherDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {editingVoucher ? 'Edit Voucher' : 'Create New Voucher'}
              <span className="ml-auto text-xs font-normal text-gray-500 flex items-center gap-1">
                <Keyboard className="w-3 h-3" />
                Press F4-F9 to switch type
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Voucher Type Selection with Keyboard Shortcuts */}
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(VOUCHER_ICONS).map(([type, config]) => {
                const Icon = config.icon;
                const isSelected = voucherForm.voucher_type === type;
                return (
                  <button
                    key={type}
                    onClick={() => setVoucherForm({ ...voucherForm, voucher_type: type })}
                    className={`p-3 rounded-lg border-2 transition-all relative ${
                      isSelected 
                        ? `border-blue-500 ${config.bg}` 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`voucher-type-${type}`}
                    title={`${config.label} (${config.shortcut})`}
                  >
                    <span className="absolute -top-2 -right-2 bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                      {config.shortcut}
                    </span>
                    <Icon className={`w-6 h-6 mx-auto ${config.color}`} />
                    <p className={`text-xs mt-1 font-medium ${isSelected ? config.color : 'text-gray-600'}`}>
                      {config.label}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Date and Reference */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Date *</label>
                <Input
                  type="date"
                  value={voucherForm.date}
                  onChange={(e) => setVoucherForm({ ...voucherForm, date: e.target.value })}
                  data-testid="voucher-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reference No.</label>
                <Input
                  value={voucherForm.reference_number}
                  onChange={(e) => setVoucherForm({ ...voucherForm, reference_number: e.target.value })}
                  placeholder="Bill/Invoice No."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reference Date</label>
                <Input
                  type="date"
                  value={voucherForm.reference_date}
                  onChange={(e) => setVoucherForm({ ...voucherForm, reference_date: e.target.value })}
                />
              </div>
            </div>

            {/* GST Details (only for Sales/Purchase) */}
            {(voucherForm.voucher_type === 'sales' || voucherForm.voucher_type === 'purchase') && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  GST Details
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Party GSTIN</label>
                    <Input
                      value={voucherForm.party_gstin}
                      onChange={(e) => setVoucherForm({ ...voucherForm, party_gstin: e.target.value.toUpperCase() })}
                      placeholder="e.g., 27AABCU9603R1ZM"
                      className="font-mono text-sm"
                      maxLength={15}
                      data-testid="party-gstin"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Place of Supply</label>
                    <Select
                      value={voucherForm.place_of_supply}
                      onValueChange={(val) => setVoucherForm({ ...voucherForm, place_of_supply: val })}
                    >
                      <SelectTrigger data-testid="place-of-supply">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map(state => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.code} - {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Supply Type</label>
                    <Select
                      value={voucherForm.supply_type}
                      onValueChange={updateSupplyType}
                    >
                      <SelectTrigger data-testid="supply-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="intrastate">Intrastate (CGST + SGST)</SelectItem>
                        <SelectItem value="interstate">Interstate (IGST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Line Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-gray-700">Line Items</label>
                <Button size="sm" variant="outline" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-1" /> Add Line
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-2 text-sm font-medium w-48">Ledger Account</th>
                      {(voucherForm.voucher_type === 'sales' || voucherForm.voucher_type === 'purchase') && (
                        <>
                          <th className="text-left py-2 px-2 text-sm font-medium w-24">HSN Code</th>
                          <th className="text-right py-2 px-2 text-sm font-medium w-20">Taxable</th>
                          <th className="text-center py-2 px-2 text-sm font-medium w-16">GST %</th>
                          {voucherForm.supply_type === 'interstate' ? (
                            <th className="text-right py-2 px-2 text-sm font-medium w-20 text-blue-600">IGST</th>
                          ) : (
                            <>
                              <th className="text-right py-2 px-2 text-sm font-medium w-20 text-green-600">CGST</th>
                              <th className="text-right py-2 px-2 text-sm font-medium w-20 text-purple-600">SGST</th>
                            </>
                          )}
                        </>
                      )}
                      <th className="text-right py-2 px-2 text-sm font-medium w-24">Debit</th>
                      <th className="text-right py-2 px-2 text-sm font-medium w-24">Credit</th>
                      <th className="text-left py-2 px-2 text-sm font-medium">Narration</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucherForm.line_items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="py-2 px-2">
                          <Select
                            value={item.ledger_id}
                            onValueChange={(val) => updateLineItem(index, 'ledger_id', val)}
                          >
                            <SelectTrigger className="w-full text-sm" data-testid={`line-item-ledger-${index}`}>
                              <SelectValue placeholder="Select ledger" />
                            </SelectTrigger>
                            <SelectContent>
                              {ledgers.map(ledger => (
                                <SelectItem key={ledger.id} value={ledger.id}>
                                  {ledger.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {(voucherForm.voucher_type === 'sales' || voucherForm.voucher_type === 'purchase') && (
                          <>
                            <td className="py-2 px-2">
                              <Input
                                value={item.hsn_code || ''}
                                onChange={(e) => updateLineItem(index, 'hsn_code', e.target.value)}
                                placeholder="HSN"
                                className="text-sm font-mono"
                                data-testid={`line-item-hsn-${index}`}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                value={item.taxable_value || ''}
                                onChange={(e) => updateLineItem(index, 'taxable_value', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="text-right text-sm"
                                data-testid={`line-item-taxable-${index}`}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Select
                                value={String(item.gst_rate || 0)}
                                onValueChange={(val) => updateLineItem(index, 'gst_rate', parseFloat(val))}
                              >
                                <SelectTrigger className="w-16 text-sm" data-testid={`line-item-gst-rate-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GST_RATES.map(rate => (
                                    <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            {voucherForm.supply_type === 'interstate' ? (
                              <td className="py-2 px-2 text-right text-sm text-blue-600 font-mono">
                                {formatCurrency(item.igst || 0)}
                              </td>
                            ) : (
                              <>
                                <td className="py-2 px-2 text-right text-sm text-green-600 font-mono">
                                  {formatCurrency(item.cgst || 0)}
                                </td>
                                <td className="py-2 px-2 text-right text-sm text-purple-600 font-mono">
                                  {formatCurrency(item.sgst || 0)}
                                </td>
                              </>
                            )}
                          </>
                        )}
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.debit || ''}
                            onChange={(e) => updateLineItem(index, 'debit', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="text-right text-sm"
                            data-testid={`line-item-debit-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={item.credit || ''}
                            onChange={(e) => updateLineItem(index, 'credit', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="text-right text-sm"
                            data-testid={`line-item-credit-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={item.narration || ''}
                            onChange={(e) => updateLineItem(index, 'narration', e.target.value)}
                            placeholder="Particulars"
                            className="text-sm"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeLineItem(index)}
                            className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-gray-50">
                      <td className="py-2 px-3 text-right font-medium">Total:</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-mono font-bold ${totalDebit > 0 ? 'text-green-600' : ''}`}>
                          {formatCurrency(totalDebit)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-mono font-bold ${totalCredit > 0 ? 'text-red-600' : ''}`}>
                          {formatCurrency(totalCredit)}
                        </span>
                      </td>
                      <td colSpan={2} className="py-2 px-3">
                        {!isBalanced && totalDebit > 0 && totalCredit > 0 && (
                          <span className="text-red-600 text-sm flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                          </span>
                        )}
                        {isBalanced && totalDebit > 0 && (
                          <span className="text-green-600 text-sm flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Balanced
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Narration */}
            <div>
              <label className="text-sm font-medium text-gray-700">Narration</label>
              <Textarea
                value={voucherForm.narration}
                onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                placeholder="Enter voucher narration..."
                rows={2}
                data-testid="voucher-narration"
              />
            </div>

            {/* Keyboard Shortcuts Bar - Now Clickable */}
            <div className="bg-gray-100 -mx-6 -mb-6 px-6 py-3 mt-4 border-t text-xs text-gray-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setVoucherForm(prev => ({ ...prev, voucher_type: 'contra' }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${voucherForm.voucher_type === 'contra' ? 'bg-purple-200 text-purple-800' : 'hover:bg-gray-200'}`}
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">F4</kbd> Contra
                </button>
                <button 
                  onClick={() => setVoucherForm(prev => ({ ...prev, voucher_type: 'payment' }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${voucherForm.voucher_type === 'payment' ? 'bg-red-200 text-red-800' : 'hover:bg-gray-200'}`}
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">F5</kbd> Payment
                </button>
                <button 
                  onClick={() => setVoucherForm(prev => ({ ...prev, voucher_type: 'receipt' }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${voucherForm.voucher_type === 'receipt' ? 'bg-green-200 text-green-800' : 'hover:bg-gray-200'}`}
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">F6</kbd> Receipt
                </button>
                <button 
                  onClick={() => setVoucherForm(prev => ({ ...prev, voucher_type: 'journal' }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${voucherForm.voucher_type === 'journal' ? 'bg-blue-200 text-blue-800' : 'hover:bg-gray-200'}`}
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">F7</kbd> Journal
                </button>
                <button 
                  onClick={() => setVoucherForm(prev => ({ ...prev, voucher_type: 'sales' }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${voucherForm.voucher_type === 'sales' ? 'bg-orange-200 text-orange-800' : 'hover:bg-gray-200'}`}
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">F8</kbd> Sales
                </button>
                <button 
                  onClick={() => setVoucherForm(prev => ({ ...prev, voucher_type: 'purchase' }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${voucherForm.voucher_type === 'purchase' ? 'bg-amber-200 text-amber-800' : 'hover:bg-gray-200'}`}
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">F9</kbd> Purchase
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={addLineItem}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">Alt+A</kbd> Add Row
                </button>
                <button 
                  onClick={handleSubmitVoucher}
                  disabled={!isBalanced || totalDebit === 0}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-green-200 text-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">Ctrl+S</kbd> Save
                </button>
                <button 
                  onClick={() => setShowVoucherDialog(false)}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-200 text-red-700 transition-colors"
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-300 rounded font-mono text-[10px]">Esc</kbd> Close
                </button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVoucherDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitVoucher} disabled={!isBalanced || totalDebit === 0} data-testid="save-voucher-btn">
              <Save className="w-4 h-4 mr-2" />
              {editingVoucher ? 'Update Voucher' : 'Create Voucher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Voucher Details
              </span>
              {viewingVoucher?.voucher && (
                <Badge className={`${STATUS_COLORS[viewingVoucher.voucher.status]?.bg} ${STATUS_COLORS[viewingVoucher.voucher.status]?.text}`}>
                  {viewingVoucher.voucher.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {viewingVoucher?.voucher && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Voucher Number</p>
                  <p className="font-mono font-bold">{viewingVoucher.voucher.voucher_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium">{viewingVoucher.voucher.voucher_type_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{viewingVoucher.voucher.date}</p>
                </div>
                {viewingVoucher.voucher.reference_number && (
                  <div>
                    <p className="text-xs text-gray-500">Reference No.</p>
                    <p className="font-medium">{viewingVoucher.voucher.reference_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Created By</p>
                  <p className="font-medium">{viewingVoucher.voucher.created_by_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Created At</p>
                  <p className="font-medium">{new Date(viewingVoucher.voucher.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-semibold mb-2">Line Items</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 text-sm">Ledger</th>
                        <th className="text-right py-2 px-3 text-sm">Debit</th>
                        <th className="text-right py-2 px-3 text-sm">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingVoucher.voucher.line_items?.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-2 px-3">{item.ledger_name || item.ledger_id}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-gray-50 font-bold">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-right font-mono text-green-600">
                          {formatCurrency(viewingVoucher.voucher.total_debit || 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-red-600">
                          {formatCurrency(viewingVoucher.voucher.total_credit || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Narration */}
              {viewingVoucher.voucher.narration && (
                <div>
                  <h4 className="font-semibold mb-2">Narration</h4>
                  <p className="text-gray-600 p-3 bg-gray-50 rounded-lg">{viewingVoucher.voucher.narration}</p>
                </div>
              )}

              {/* Approval History */}
              {viewingVoucher.approvals?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Approval History</h4>
                  <div className="space-y-2">
                    {viewingVoucher.approvals.map((approval, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Badge className={approval.action === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {approval.action}
                        </Badge>
                        <span className="text-sm text-gray-600">by {approval.user_name}</span>
                        <span className="text-xs text-gray-400">{new Date(approval.created_at).toLocaleString()}</span>
                        {approval.remarks && (
                          <span className="text-sm text-gray-500 italic">- {approval.remarks}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {viewingVoucher.voucher.status === 'rejected' && viewingVoucher.voucher.rejection_reason && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-1">Rejection Reason</h4>
                  <p className="text-red-700">{viewingVoucher.voucher.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
            {viewingVoucher?.voucher?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => {
                    setRejectingVoucher(viewingVoucher.voucher);
                    setShowRejectDialog(true);
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => approveVoucher(viewingVoucher.voucher.id)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject Voucher
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Rejecting voucher: <strong>{rejectingVoucher?.voucher_number}</strong>
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700">Reason for Rejection *</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                data-testid="reject-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectReason('');
            }}>Cancel</Button>
            <Button variant="destructive" onClick={rejectVoucher} data-testid="confirm-reject-btn">
              Reject Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
