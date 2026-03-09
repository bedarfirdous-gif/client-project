import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Plus, Edit2, Trash2, RefreshCw, Search, AlertCircle, 
  CheckCircle, FileText, Calculator, Download, Filter,
  ChevronDown, ChevronRight, Database, BookOpen
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';

export default function GSTMasterPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  // State for GST Slabs
  const [gstSlabs, setGstSlabs] = useState([]);
  const [hsnCodes, setHsnCodes] = useState([]);
  const [gstLedger, setGstLedger] = useState([]);
  // FIX: avoid null initial state (can cause a flash when UI conditionally renders on null vs object)
  // Use a stable empty object instead; UI can still show "no data" without a null->object transition.
  const [gstSummary, setGstSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('config');
  
  // GST Configuration state
  const [gstConfig, setGstConfig] = useState({
    default_gst_rate: 5,
    seller_state: '',
    seller_gstin: '',
    enable_interstate_gst: true,
    auto_apply_hsn_gst: true,
    available_rates: [0, 5, 12, 18, 28]
  });
  
  // Form states
  const [showSlabDialog, setShowSlabDialog] = useState(false);
  const [showHsnDialog, setShowHsnDialog] = useState(false);
  // FIX: avoid null initial state to prevent a brief null->object transition
  // that can cause conditional UI (and controlled form fields) to flicker.
  // Use stable empty objects and rely on presence of `.id` to detect "edit" mode.
  const [editingSlab, setEditingSlab] = useState({});
  const [editingHsn, setEditingHsn] = useState({});
  
  // Filter states
  const [hsnSearch, setHsnSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState({ type: '', fromDate: '', toDate: '' });
  
  // Form data
  const [slabForm, setSlabForm] = useState({
    code: '',
    name: '',
    total_rate: 0,
    cgst_rate: 0,
    sgst_rate: 0,
    igst_rate: 0,
    cess_rate: 0,
    description: '',
    is_active: true
  });
  
  const [hsnForm, setHsnForm] = useState({
    code: '',
    description: '',
    gst_slab_id: '',
    category: '',
    is_active: true
  });
  
  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [slabsData, hsnData, configData] = await Promise.all([
        api('/api/gst-slabs?active_only=false'),
        api('/api/hsn-codes'),
        api('/api/gst-config')
      ]);
      setGstSlabs(slabsData);
      setHsnCodes(hsnData);
      if (configData && !configData.error) {
        setGstConfig(prev => ({ ...prev, ...configData }));
      }
    } catch (error) {
      console.error('Error fetching GST data:', error);
      toast.error('Failed to load GST data');
    } finally {
      setLoading(false);
    }
  };
  
  // Save GST Configuration
  const saveGstConfig = async () => {
    try {
      await api('/api/gst-config', {
        method: 'PUT',
        body: JSON.stringify(gstConfig)
      });
      toast.success('GST Configuration saved successfully!');
    } catch (error) {
      toast.error('Failed to save GST configuration');
    }
  };
  
  const fetchGstLedger = async () => {
    try {
      const params = new URLSearchParams();
      if (ledgerFilter.type) params.append('entry_type', ledgerFilter.type);
      if (ledgerFilter.fromDate) params.append('from_date', ledgerFilter.fromDate);
      if (ledgerFilter.toDate) params.append('to_date', ledgerFilter.toDate);
      
      const [ledgerData, summaryData] = await Promise.all([
        api(`/api/gst-ledger?${params.toString()}`),
        api(`/api/gst-ledger/summary?${params.toString()}`)
      ]);
      setGstLedger(ledgerData);
      setGstSummary(summaryData);
    } catch (error) {
      console.error('Error fetching GST ledger:', error);
      toast.error('Failed to load GST ledger');
    }
  };
  
  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchGstLedger();
    }
  }, [activeTab, ledgerFilter]);
  
  // Initialize default GST slabs
  const initializeDefaultSlabs = async () => {
    try {
      const result = await api('/api/gst-slabs/initialize', { method: 'POST' });
      toast.success(result.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to initialize GST slabs');
    }
  };
  
  // Handle rate change - auto-calculate CGST/SGST/IGST
  const handleRateChange = (totalRate) => {
    const rate = parseFloat(totalRate) || 0;
    setSlabForm({
      ...slabForm,
      total_rate: rate,
      cgst_rate: rate / 2,
      sgst_rate: rate / 2,
      igst_rate: rate
    });
  };
  
  // Save GST Slab
  const saveGstSlab = async () => {
    if (!slabForm.code || !slabForm.name) {
      toast.error('Please fill required fields');
      return;
    }
    
    try {
      if (editingSlab) {
        await api(`/api/gst-slabs/${editingSlab.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: slabForm.name,
            description: slabForm.description,
            is_active: slabForm.is_active,
            cess_rate: slabForm.cess_rate
          })
        });
        toast.success('GST slab updated');
      } else {
        await api('/api/gst-slabs', {
          method: 'POST',
          body: JSON.stringify({
            ...slabForm,
            effective_from: new Date().toISOString().split('T')[0]
          })
        });
        toast.success('GST slab created');
      }
      setShowSlabDialog(false);
      setEditingSlab(null);
      resetSlabForm();
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to save GST slab');
    }
  };
  
  // Save HSN Code
  const saveHsnCode = async () => {
    if (!hsnForm.code || !hsnForm.description || !hsnForm.gst_slab_id) {
      toast.error('Please fill required fields');
      return;
    }
    
    try {
      if (editingHsn) {
        await api(`/api/hsn-codes/${editingHsn.id}`, {
          method: 'PUT',
          body: JSON.stringify(hsnForm)
        });
        toast.success('HSN code updated');
      } else {
        await api('/api/hsn-codes', {
          method: 'POST',
          body: JSON.stringify(hsnForm)
        });
        toast.success('HSN code created');
      }
      setShowHsnDialog(false);
      setEditingHsn(null);
      resetHsnForm();
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to save HSN code');
    }
  };
  
  // Delete GST Slab
  const deleteGstSlab = async (slab) => {
    if (!window.confirm('Are you sure? This will deactivate the GST slab.')) return;
    
    try {
      await api(`/api/gst-slabs/${slab.id}`, { method: 'DELETE' });
      toast.success('GST slab deactivated');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete GST slab');
    }
  };
  
  // Delete HSN Code
  const deleteHsnCode = async (hsn) => {
    if (!window.confirm('Are you sure you want to delete this HSN code?')) return;
    
    try {
      await api(`/api/hsn-codes/${hsn.id}`, { method: 'DELETE' });
      toast.success('HSN code deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete HSN code');
    }
  };
  
  // Reset forms
  const resetSlabForm = () => {
    setSlabForm({
      code: '',
      name: '',
      total_rate: 0,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cess_rate: 0,
      description: '',
      is_active: true
    });
  };
  
  const resetHsnForm = () => {
    setHsnForm({
      code: '',
      description: '',
      gst_slab_id: '',
      category: '',
      is_active: true
    });
  };
  
  // Edit handlers
  const handleEditSlab = (slab) => {
    setEditingSlab(slab);
    setSlabForm({
      code: slab.code,
      name: slab.name,
      total_rate: slab.total_rate,
      cgst_rate: slab.cgst_rate,
      sgst_rate: slab.sgst_rate,
      igst_rate: slab.igst_rate,
      cess_rate: slab.cess_rate || 0,
      description: slab.description || '',
      is_active: slab.is_active
    });
    setShowSlabDialog(true);
  };
  
  const handleEditHsn = (hsn) => {
    setEditingHsn(hsn);
    setHsnForm({
      code: hsn.code,
      description: hsn.description,
      gst_slab_id: hsn.gst_slab_id,
      category: hsn.category || '',
      is_active: hsn.is_active
    });
    setShowHsnDialog(true);
  };
  
  // Filter HSN codes
  const filteredHsnCodes = hsnCodes.filter(hsn => 
    hsn.code?.toLowerCase().includes(hsnSearch.toLowerCase()) ||
    hsn.description?.toLowerCase().includes(hsnSearch.toLowerCase())
  );
  
  // Get slab badge color
  const getSlabBadgeColor = (rate) => {
    if (rate === 0) return 'bg-green-100 text-green-800';
    if (rate === 5) return 'bg-blue-100 text-blue-800';
    if (rate === 12) return 'bg-yellow-100 text-yellow-800';
    if (rate === 18) return 'bg-orange-100 text-orange-800';
    if (rate === 28) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Master</h1>
          <p className="text-gray-500 mt-1">Centralized GST management - Single source of truth</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {gstSlabs.length === 0 && (
            <Button onClick={initializeDefaultSlabs}>
              <Database className="h-4 w-4 mr-2" />
              Initialize Default Slabs
            </Button>
          )}
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">GST Slabs</p>
                <p className="text-2xl font-bold">{gstSlabs.filter(s => s.is_active).length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Calculator className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">HSN Codes</p>
                <p className="text-2xl font-bold">{hsnCodes.length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <BookOpen className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Output GST</p>
                <p className="text-2xl font-bold text-red-600">
                  {currencySymbol}{(gstSummary?.output_gst?.total || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <ChevronRight className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Input GST (ITC)</p>
                <p className="text-2xl font-bold text-green-600">
                  {currencySymbol}{(gstSummary?.input_gst?.total || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <ChevronDown className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="slabs">GST Slabs</TabsTrigger>
          <TabsTrigger value="hsn">HSN Codes</TabsTrigger>
          <TabsTrigger value="ledger">GST Ledger</TabsTrigger>
        </TabsList>
        
        {/* GST Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>GST Configuration</CardTitle>
              <CardDescription>Centralized GST settings - applies to all Sales and Purchases</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default GST Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Default GST Rate (%)</Label>
                  <Select 
                    value={String(gstConfig.default_gst_rate)} 
                    onValueChange={(v) => setGstConfig(prev => ({ ...prev, default_gst_rate: Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">Auto-applied when item has no HSN-based GST</p>
                </div>
                
                <div>
                  <Label>Seller GSTIN</Label>
                  <Input 
                    value={gstConfig.seller_gstin || ''} 
                    onChange={(e) => setGstConfig(prev => ({ ...prev, seller_gstin: e.target.value.toUpperCase() }))}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                  <p className="text-xs text-gray-500 mt-1">Your business GSTIN for interstate detection</p>
                </div>
              </div>
              
              {/* Seller State & Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Seller State</Label>
                  <Select 
                    value={gstConfig.seller_state || ''} 
                    onValueChange={(v) => setGstConfig(prev => ({ ...prev, seller_state: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">Jammu & Kashmir</SelectItem>
                      <SelectItem value="02">Himachal Pradesh</SelectItem>
                      <SelectItem value="03">Punjab</SelectItem>
                      <SelectItem value="04">Chandigarh</SelectItem>
                      <SelectItem value="05">Uttarakhand</SelectItem>
                      <SelectItem value="06">Haryana</SelectItem>
                      <SelectItem value="07">Delhi</SelectItem>
                      <SelectItem value="08">Rajasthan</SelectItem>
                      <SelectItem value="09">Uttar Pradesh</SelectItem>
                      <SelectItem value="10">Bihar</SelectItem>
                      <SelectItem value="19">West Bengal</SelectItem>
                      <SelectItem value="21">Odisha</SelectItem>
                      <SelectItem value="27">Maharashtra</SelectItem>
                      <SelectItem value="29">Karnataka</SelectItem>
                      <SelectItem value="32">Kerala</SelectItem>
                      <SelectItem value="33">Tamil Nadu</SelectItem>
                      <SelectItem value="36">Telangana</SelectItem>
                      <SelectItem value="37">Andhra Pradesh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-4 pt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={gstConfig.auto_apply_hsn_gst || false}
                      onChange={(e) => setGstConfig(prev => ({ ...prev, auto_apply_hsn_gst: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Use HSN-based GST when available</span>
                  </label>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={gstConfig.enable_interstate_gst || false}
                    onChange={(e) => setGstConfig(prev => ({ ...prev, enable_interstate_gst: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Enable Interstate GST (IGST) detection</span>
                </label>
              </div>
              
              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">How GST is Applied:</h4>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li><strong>Item has HSN code:</strong> GST rate from HSN-linked slab is used</li>
                  <li><strong>Item has custom GST rate:</strong> Item's GST rate is used</li>
                  <li><strong>Neither:</strong> Default GST rate ({gstConfig.default_gst_rate}%) is applied</li>
                  <li><strong>Interstate sale:</strong> IGST is charged (instead of CGST+SGST)</li>
                </ul>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={saveGstConfig} className="bg-green-600 hover:bg-green-700">
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* GST Summary */}
          <Card>
            <CardHeader>
              <CardTitle>GST Summary (Current Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">Output CGST</p>
                  <p className="text-xl font-bold text-green-700">{currencySymbol}{(gstConfig.gst_slabs?.reduce((s, sl) => s, 0) || 0).toLocaleString()}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">Output SGST</p>
                  <p className="text-xl font-bold text-green-700">{currencySymbol}0</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">Input CGST</p>
                  <p className="text-xl font-bold text-blue-700">{currencySymbol}0</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">Input SGST</p>
                  <p className="text-xl font-bold text-blue-700">{currencySymbol}0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* GST Slabs Tab */}
        <TabsContent value="slabs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">GST Rate Slabs</h2>
            <Button onClick={() => { resetSlabForm(); setEditingSlab(null); setShowSlabDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add GST Slab
            </Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Rate</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">CGST</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">SGST</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">IGST</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cess</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {gstSlabs.map(slab => (
                    <tr key={slab.id} className={`hover:bg-gray-50 ${!slab.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <Badge className={getSlabBadgeColor(slab.total_rate)}>{slab.code}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{slab.name}</td>
                      <td className="px-4 py-3 text-center font-bold">{slab.total_rate}%</td>
                      <td className="px-4 py-3 text-center">{slab.cgst_rate}%</td>
                      <td className="px-4 py-3 text-center">{slab.sgst_rate}%</td>
                      <td className="px-4 py-3 text-center">{slab.igst_rate}%</td>
                      <td className="px-4 py-3 text-center">{slab.cess_rate || 0}%</td>
                      <td className="px-4 py-3 text-center">
                        {slab.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditSlab(slab)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteGstSlab(slab)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {gstSlabs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No GST slabs configured</p>
                        <Button className="mt-2" onClick={initializeDefaultSlabs}>
                          Initialize Default Indian GST Slabs
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
          
          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">GST Rate Rules</h4>
                  <ul className="text-sm text-blue-700 mt-1 space-y-1">
                    <li>• GST rates cannot be modified once created (for audit safety)</li>
                    <li>• Create a new slab if rates change - old invoices remain unchanged</li>
                    <li>• CGST + SGST = Total Rate (for intra-state transactions)</li>
                    <li>• IGST = Total Rate (for inter-state transactions)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* HSN Codes Tab */}
        <TabsContent value="hsn" className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search HSN codes..."
                value={hsnSearch}
                onChange={(e) => setHsnSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => { resetHsnForm(); setEditingHsn(null); setShowHsnDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add HSN Code
            </Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HSN Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">GST Slab</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredHsnCodes.map(hsn => (
                    <tr key={hsn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium">{hsn.code}</td>
                      <td className="px-4 py-3">{hsn.description}</td>
                      <td className="px-4 py-3 text-gray-500">{hsn.category || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {hsn.gst_slab && (
                          <Badge className={getSlabBadgeColor(hsn.gst_slab.total_rate)}>
                            {hsn.gst_slab.total_rate}%
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditHsn(hsn)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteHsnCode(hsn)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredHsnCodes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No HSN codes found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* GST Ledger Tab */}
        <TabsContent value="ledger" className="space-y-4">
          {/* GST Summary */}
          {gstSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium text-red-700">Output GST (Sales)</h4>
                  <p className="text-2xl font-bold text-red-800 mt-1">
                    {currencySymbol}{gstSummary.output_gst?.total?.toLocaleString() || 0}
                  </p>
                  <div className="text-xs text-red-600 mt-2 space-y-1">
                    <p>CGST: {currencySymbol}{gstSummary.output_gst?.cgst?.toLocaleString() || 0}</p>
                    <p>SGST: {currencySymbol}{gstSummary.output_gst?.sgst?.toLocaleString() || 0}</p>
                    <p>Invoices: {gstSummary.output_gst?.count || 0}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium text-green-700">Input GST (Purchases)</h4>
                  <p className="text-2xl font-bold text-green-800 mt-1">
                    {currencySymbol}{gstSummary.input_gst?.total?.toLocaleString() || 0}
                  </p>
                  <div className="text-xs text-green-600 mt-2 space-y-1">
                    <p>CGST: {currencySymbol}{gstSummary.input_gst?.cgst?.toLocaleString() || 0}</p>
                    <p>SGST: {currencySymbol}{gstSummary.input_gst?.sgst?.toLocaleString() || 0}</p>
                    <p>Invoices: {gstSummary.input_gst?.count || 0}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={`${gstSummary.net_gst_liability > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                <CardContent className="pt-4">
                  <h4 className={`text-sm font-medium ${gstSummary.net_gst_liability > 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                    Net GST Liability
                  </h4>
                  <p className={`text-2xl font-bold mt-1 ${gstSummary.net_gst_liability > 0 ? 'text-orange-800' : 'text-blue-800'}`}>
                    {currencySymbol}{Math.abs(gstSummary.net_gst_liability || 0).toLocaleString()}
                  </p>
                  <div className={`text-xs mt-2 ${gstSummary.net_gst_liability > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                    {gstSummary.net_gst_liability > 0 ? (
                      <p>GST Payable: {currencySymbol}{gstSummary.gst_payable?.toLocaleString()}</p>
                    ) : (
                      <p>ITC Carryforward: {currencySymbol}{gstSummary.itc_carryforward?.toLocaleString()}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={ledgerFilter.type} onValueChange={(v) => setLedgerFilter({...ledgerFilter, type: v === 'all' ? '' : v})}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="OUTPUT">Output (Sales)</SelectItem>
                      <SelectItem value="INPUT">Input (Purchases)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">From Date</Label>
                  <Input
                    type="date"
                    value={ledgerFilter.fromDate}
                    onChange={(e) => setLedgerFilter({...ledgerFilter, fromDate: e.target.value})}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label className="text-xs">To Date</Label>
                  <Input
                    type="date"
                    value={ledgerFilter.toDate}
                    onChange={(e) => setLedgerFilter({...ledgerFilter, toDate: e.target.value})}
                    className="w-40"
                  />
                </div>
                <Button variant="outline" onClick={() => setLedgerFilter({ type: '', fromDate: '', toDate: '' })}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Ledger Table */}
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Party</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taxable</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CGST</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">SGST</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {gstLedger.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={entry.entry_type === 'OUTPUT' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                          {entry.entry_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {entry.reference_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{entry.party_name}</div>
                        {entry.party_gstin && (
                          <div className="text-xs text-gray-500">{entry.party_gstin}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {currencySymbol}{entry.taxable_amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {currencySymbol}{entry.cgst_amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {currencySymbol}{entry.sgst_amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {currencySymbol}{entry.total_gst?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {gstLedger.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No GST entries found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* GST Slab Dialog */}
      <Dialog open={showSlabDialog} onOpenChange={setShowSlabDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSlab ? 'Edit GST Slab' : 'Add GST Slab'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code *</Label>
                <Input
                  value={slabForm.code}
                  onChange={(e) => setSlabForm({...slabForm, code: e.target.value})}
                  placeholder="GST_18"
                  disabled={!!editingSlab}
                />
              </div>
              <div>
                <Label>Name *</Label>
                <Input
                  value={slabForm.name}
                  onChange={(e) => setSlabForm({...slabForm, name: e.target.value})}
                  placeholder="18% GST"
                />
              </div>
            </div>
            
            <div>
              <Label>Total GST Rate (%) *</Label>
              <Input
                type="number"
                value={slabForm.total_rate}
                onChange={(e) => handleRateChange(e.target.value)}
                disabled={!!editingSlab}
                min="0"
                max="100"
                step="0.5"
              />
              <p className="text-xs text-gray-500 mt-1">
                CGST and SGST will be auto-calculated (50% each)
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>CGST %</Label>
                <Input value={slabForm.cgst_rate} disabled className="bg-gray-50" />
              </div>
              <div>
                <Label>SGST %</Label>
                <Input value={slabForm.sgst_rate} disabled className="bg-gray-50" />
              </div>
              <div>
                <Label>IGST %</Label>
                <Input value={slabForm.igst_rate} disabled className="bg-gray-50" />
              </div>
            </div>
            
            <div>
              <Label>Cess Rate (%)</Label>
              <Input
                type="number"
                value={slabForm.cess_rate}
                onChange={(e) => setSlabForm({...slabForm, cess_rate: parseFloat(e.target.value) || 0})}
                min="0"
                step="0.5"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={slabForm.description}
                onChange={(e) => setSlabForm({...slabForm, description: e.target.value})}
                placeholder="Applicable to most goods & services"
                rows={2}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="slab_active"
                checked={slabForm.is_active}
                onChange={(e) => setSlabForm({...slabForm, is_active: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="slab_active" className="cursor-pointer">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlabDialog(false)}>Cancel</Button>
            <Button onClick={saveGstSlab}>
              {editingSlab ? 'Update' : 'Create'} GST Slab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* HSN Code Dialog */}
      <Dialog open={showHsnDialog} onOpenChange={setShowHsnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHsn ? 'Edit HSN Code' : 'Add HSN Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>HSN Code *</Label>
              <Input
                value={hsnForm.code}
                onChange={(e) => setHsnForm({...hsnForm, code: e.target.value})}
                placeholder="6109"
                maxLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">4-8 digit HSN/SAC code</p>
            </div>
            
            <div>
              <Label>Description *</Label>
              <Textarea
                value={hsnForm.description}
                onChange={(e) => setHsnForm({...hsnForm, description: e.target.value})}
                placeholder="T-shirts, singlets and other vests"
                rows={2}
              />
            </div>
            
            <div>
              <Label>GST Slab *</Label>
              <Select value={hsnForm.gst_slab_id} onValueChange={(v) => setHsnForm({...hsnForm, gst_slab_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select GST Slab" />
                </SelectTrigger>
                <SelectContent>
                  {gstSlabs.filter(s => s.is_active).map(slab => (
                    <SelectItem key={slab.id} value={slab.id}>
                      {slab.name} ({slab.total_rate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Category</Label>
              <Input
                value={hsnForm.category}
                onChange={(e) => setHsnForm({...hsnForm, category: e.target.value})}
                placeholder="Clothing, Electronics, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHsnDialog(false)}>Cancel</Button>
            <Button onClick={saveHsnCode}>
              {editingHsn ? 'Update' : 'Create'} HSN Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
