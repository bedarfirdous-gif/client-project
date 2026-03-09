import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import {
  Scissors, Upload, Plus, Search, Filter, Grid, List, Edit2, Trash2,
  Image as ImageIcon, Package, Tag, Ruler, ShoppingBag, ChevronRight,
  X, Check, Loader2, Eye, Palette, Layers, Shirt, FileText, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import SyncBar from '../components/SyncBar';

const CLOTHING_TYPES = [
  { id: 'tops', label: 'Tops (Shirts, T-Shirts, Polos)' },
  { id: 'bottoms', label: 'Bottoms (Pants, Trousers, Jeans)' },
  { id: 'dresses', label: 'Dresses' },
  { id: 'outerwear', label: 'Outerwear (Jackets, Coats)' },
  { id: 'ethnic', label: 'Ethnic Wear (Kurta, Sherwani)' },
  { id: 'winter_blazer', label: 'Winter Blazer' },
  { id: 'summer_blazer', label: 'Summer Blazer' },
  { id: 'wedding_suit', label: 'Wedding Coat & Suits' },
  { id: 'formal_suit', label: 'Formal Coat & Suits' },
  { id: 'waistcoat', label: 'Waistcoat' },
  { id: 'coat', label: 'Coat' },
  { id: 'pant', label: 'Formal Pants' }
];

const PATTERNS = [
  { id: 'solid', label: 'Solid' },
  { id: 'striped', label: 'Striped' },
  { id: 'checkered', label: 'Checkered' },
  { id: 'printed', label: 'Printed' },
  { id: 'floral', label: 'Floral' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'paisley', label: 'Paisley' }
];

export default function FabricCataloguePage() {
  const { api, user } = useAuth();
  const { currencySymbol } = useCurrency();
  const fileInputRef = useRef(null);
  
  // State
  const [fabrics, setFabrics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [activeTab, setActiveTab] = useState('catalogue');
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showStitchDialog, setShowStitchDialog] = useState(false);

  // Fix: avoid initializing to null (can cause a flash when UI does `selectedFabric && ...` / `editingFabric && ...`).
  // Keep a stable object shape and use explicit loaded/active flags instead.
  const [isSelectedFabric, setIsSelectedFabric] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState({});
  const [isEditingFabric, setIsEditingFabric] = useState(false);
  const [editingFabric, setEditingFabric] = useState({});

  const [uploading, setUploading] = useState(false);
  
  // Stitch requests
  const [stitchRequests, setStitchRequests] = useState([]);
  
  // Form state
  const [fabricForm, setFabricForm] = useState({
    name: '',
    category: '',
    description: '',
    color: '',
    pattern: 'solid',
    price_per_meter: 0,
    available_quantity: 0,
    image_url: '',
    suitable_for: [],
    care_instructions: '',
    composition: ''
  });
  
  // Stitch request form
  const [stitchForm, setStitchForm] = useState({
    clothing_type: '',
    design_notes: '',
    quantity: 1,
    urgency: 'normal',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address: ''
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [selectedCategory, searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const [fabricsData, categoriesData] = await Promise.all([
        api(`/api/fabrics?${params.toString()}`),
        api('/api/fabrics/categories')
      ]);
      
      setFabrics(fabricsData.fabrics || []);
      setCategories(categoriesData.categories || []);
    } catch (err) {
      console.error('Failed to fetch fabrics:', err);
      toast.error('Failed to load fabrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchStitchRequests = async () => {
    try {
      const data = await api('/api/fabrics/custom-stitch-requests');
      setStitchRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch stitch requests:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchStitchRequests();
    }
  }, [activeTab]);

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/fabrics/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      setFabricForm({ ...fabricForm, image_url: data.image_url });
      toast.success('Image uploaded');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // Save fabric
  const saveFabric = async () => {
    if (!fabricForm.name || !fabricForm.category) {
      toast.error('Please fill in required fields');
      return;
    }
    
    try {
      if (editingFabric) {
        await api(`/api/fabrics/${editingFabric.id}`, {
          method: 'PUT',
          body: JSON.stringify(fabricForm)
        });
        toast.success('Fabric updated');
      } else {
        await api('/api/fabrics', {
          method: 'POST',
          body: JSON.stringify(fabricForm)
        });
        toast.success('Fabric added');
      }
      
      setShowAddDialog(false);
      setEditingFabric(null);
      resetFabricForm();
      fetchData();
    } catch (err) {
      toast.error('Failed to save fabric');
    }
  };

  // Delete fabric
  const deleteFabric = async (fabricId) => {
    if (!window.confirm('Are you sure you want to delete this fabric?')) return;
    
    try {
      await api(`/api/fabrics/${fabricId}`, { method: 'DELETE' });
      toast.success('Fabric deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete fabric');
    }
  };

  // Submit stitch request
  const submitStitchRequest = async () => {
    if (!selectedFabric || !stitchForm.clothing_type || !stitchForm.customer_name || !stitchForm.customer_phone) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      const requestData = {
        fabric_id: selectedFabric.id,
        ...stitchForm,
        measurements: {} // Can be enhanced to include actual measurements
      };
      
      const result = await api('/api/fabrics/custom-stitch-request', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });
      
      toast.success(`Stitch request created! Estimated: ${currencySymbol}${result.estimated_price}`);
      setShowStitchDialog(false);
      setSelectedFabric(null);
      resetStitchForm();
      
      // Switch to requests tab
      setActiveTab('requests');
      fetchStitchRequests();
    } catch (err) {
      toast.error('Failed to create stitch request');
    }
  };

  // Update request status
  const updateRequestStatus = async (requestId, status) => {
    try {
      await api(`/api/fabrics/custom-stitch-requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      toast.success(`Status updated to ${status}`);
      fetchStitchRequests();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const resetFabricForm = () => {
    setFabricForm({
      name: '', category: '', description: '', color: '', pattern: 'solid',
      price_per_meter: 0, available_quantity: 0, image_url: '',
      suitable_for: [], care_instructions: '', composition: ''
    });
  };

  const resetStitchForm = () => {
    setStitchForm({
      clothing_type: '', design_notes: '', quantity: 1, urgency: 'normal',
      customer_name: '', customer_phone: '', customer_email: '', delivery_address: ''
    });
  };

  const openEditDialog = (fabric) => {
    setEditingFabric(fabric);
    setFabricForm({
      name: fabric.name || '',
      category: fabric.category || '',
      description: fabric.description || '',
      color: fabric.color || '',
      pattern: fabric.pattern || 'solid',
      price_per_meter: fabric.price_per_meter || 0,
      available_quantity: fabric.available_quantity || 0,
      image_url: fabric.image_url || '',
      suitable_for: fabric.suitable_for || [],
      care_instructions: fabric.care_instructions || '',
      composition: fabric.composition || ''
    });
    setShowAddDialog(true);
  };

  const openStitchDialog = (fabric) => {
    setSelectedFabric(fabric);
    setStitchForm({
      ...stitchForm,
      customer_name: user?.name || '',
      customer_email: user?.email || ''
    });
    setShowStitchDialog(true);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6" data-testid="fabric-catalogue-page">
      {/* Sync Bar */}
      <SyncBar api={api} onSyncComplete={fetchData} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-7 h-7 text-purple-600" />
            Fabric Catalogue
          </h1>
          <p className="text-gray-500 mt-1">Browse fabrics and request custom stitching</p>
        </div>
        
        {isAdmin && (
          <Button onClick={() => { resetFabricForm(); setEditingFabric(null); setShowAddDialog(true); }} className="bg-purple-600 hover:bg-purple-700" data-testid="add-fabric-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Fabric
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="catalogue" className="gap-2">
            <Layers className="w-4 h-4" />
            Fabric Catalogue
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Scissors className="w-4 h-4" />
            Stitch Requests
          </TabsTrigger>
        </TabsList>

        {/* Catalogue Tab */}
        <TabsContent value="catalogue" className="mt-4">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search fabrics..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="search-fabric"
                    />
                  </div>
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48" data-testid="category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex gap-1 border rounded-lg p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fabrics Grid/List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : fabrics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-600">No fabrics found</h3>
                <p className="text-gray-500 mt-2">
                  {isAdmin ? 'Add your first fabric to get started' : 'Check back later for new fabrics'}
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {fabrics.map(fabric => (
                <Card key={fabric.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                  <div className="relative aspect-square bg-gray-100">
                    {fabric.image_url ? (
                      <img loading="lazy"
                        src={fabric.image_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${fabric.image_url}` : fabric.image_url}
                        alt={fabric.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Layers className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    
                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openStitchDialog(fabric)} data-testid={`stitch-btn-${fabric.id}`}>
                        <Scissors className="w-4 h-4 mr-1" />
                        Custom Stitch
                      </Button>
                      {isAdmin && (
                        <>
                          <Button size="icon" variant="secondary" onClick={() => openEditDialog(fabric)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => deleteFabric(fabric.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{fabric.name}</h3>
                      <Badge variant="outline">{fabric.category}</Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      {fabric.color && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Palette className="w-3 h-3" />
                          {fabric.color}
                        </div>
                      )}
                      {fabric.pattern && (
                        <Badge variant="secondary" className="text-xs">{fabric.pattern}</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{fabric.description}</p>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-purple-600">
                        {currencySymbol}{fabric.price_per_meter}/m
                      </span>
                      <span className="text-xs text-gray-400">
                        {fabric.available_quantity}m available
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {fabrics.map(fabric => (
                <Card key={fabric.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {fabric.image_url ? (
                          <img loading="lazy"
                            src={fabric.image_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${fabric.image_url}` : fabric.image_url}
                            alt={fabric.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Layers className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-lg">{fabric.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{fabric.category}</Badge>
                              {fabric.pattern && <Badge variant="secondary" className="text-xs">{fabric.pattern}</Badge>}
                              {fabric.color && <span className="text-sm text-gray-500">{fabric.color}</span>}
                            </div>
                          </div>
                          <span className="text-xl font-bold text-purple-600">{currencySymbol}{fabric.price_per_meter}/m</span>
                        </div>
                        
                        <p className="text-sm text-gray-500 mt-2 line-clamp-1">{fabric.description}</p>
                        
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xs text-gray-400">{fabric.available_quantity}m available</span>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => openStitchDialog(fabric)}>
                              <Scissors className="w-4 h-4 mr-1" />
                              Custom Stitch
                            </Button>
                            {isAdmin && (
                              <>
                                <Button size="icon" variant="outline" onClick={() => openEditDialog(fabric)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => deleteFabric(fabric.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Stitch Requests Tab */}
        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-purple-600" />
                Custom Stitch Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stitchRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Scissors className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No stitch requests yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stitchRequests.map(request => (
                    <div key={request.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold">{request.fabric_name}</h4>
                          <p className="text-sm text-gray-500">{CLOTHING_TYPES.find(t => t.id === request.clothing_type)?.label || request.clothing_type}</p>
                        </div>
                        <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Quantity:</span> {request.quantity}
                        </div>
                        <div>
                          <span className="text-gray-500">Urgency:</span> {request.urgency}
                        </div>
                        <div>
                          <span className="text-gray-500">Est. Price:</span> {currencySymbol}{request.estimated_price}
                        </div>
                        <div>
                          <span className="text-gray-500">Est. Days:</span> {request.estimated_delivery_days}
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t flex justify-between items-center">
                        <div className="text-xs text-gray-400">
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                        {isAdmin && request.status !== 'completed' && request.status !== 'cancelled' && (
                          <div className="flex gap-2">
                            {request.status === 'pending' && (
                              <Button size="sm" onClick={() => updateRequestStatus(request.id, 'confirmed')}>
                                Confirm
                              </Button>
                            )}
                            {request.status === 'confirmed' && (
                              <Button size="sm" onClick={() => updateRequestStatus(request.id, 'in_progress')}>
                                Start Work
                              </Button>
                            )}
                            {request.status === 'in_progress' && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateRequestStatus(request.id, 'completed')}>
                                Mark Complete
                              </Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => updateRequestStatus(request.id, 'cancelled')}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Fabric Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFabric ? 'Edit Fabric' : 'Add New Fabric'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Image Upload */}
            <div>
              <Label>Fabric Image</Label>
              <div className="mt-2 flex gap-4 items-center">
                <div className="w-32 h-32 border-2 border-dashed rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
                  {fabricForm.image_url ? (
                    <img loading="lazy"
                      src={fabricForm.image_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${fabricForm.image_url}` : fabricForm.image_url}
                      alt="Fabric"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload Image
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={fabricForm.name}
                  onChange={(e) => setFabricForm({ ...fabricForm, name: e.target.value })}
                  placeholder="e.g., Premium Cotton"
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={fabricForm.category} onValueChange={(v) => setFabricForm({ ...fabricForm, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={fabricForm.description}
                onChange={(e) => setFabricForm({ ...fabricForm, description: e.target.value })}
                placeholder="Describe the fabric..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Color</Label>
                <Input
                  value={fabricForm.color}
                  onChange={(e) => setFabricForm({ ...fabricForm, color: e.target.value })}
                  placeholder="e.g., Navy Blue"
                />
              </div>
              <div>
                <Label>Pattern</Label>
                <Select value={fabricForm.pattern} onValueChange={(v) => setFabricForm({ ...fabricForm, pattern: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATTERNS.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Composition</Label>
                <Input
                  value={fabricForm.composition}
                  onChange={(e) => setFabricForm({ ...fabricForm, composition: e.target.value })}
                  placeholder="e.g., 100% Cotton"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price per Meter ({currencySymbol})</Label>
                <Input
                  type="number"
                  value={fabricForm.price_per_meter}
                  onChange={(e) => setFabricForm({ ...fabricForm, price_per_meter: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Available Quantity (meters)</Label>
                <Input
                  type="number"
                  value={fabricForm.available_quantity}
                  onChange={(e) => setFabricForm({ ...fabricForm, available_quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div>
              <Label>Suitable For</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CLOTHING_TYPES.map(type => (
                  <Badge
                    key={type.id}
                    variant={fabricForm.suitable_for.includes(type.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const newSuitableFor = fabricForm.suitable_for.includes(type.id)
                        ? fabricForm.suitable_for.filter(t => t !== type.id)
                        : [...fabricForm.suitable_for, type.id];
                      setFabricForm({ ...fabricForm, suitable_for: newSuitableFor });
                    }}
                  >
                    {type.label.split(' ')[0]}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Care Instructions</Label>
              <Textarea
                value={fabricForm.care_instructions}
                onChange={(e) => setFabricForm({ ...fabricForm, care_instructions: e.target.value })}
                placeholder="e.g., Machine wash cold, tumble dry low"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={saveFabric} className="bg-purple-600 hover:bg-purple-700">
              {editingFabric ? 'Update' : 'Add'} Fabric
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Stitch Dialog */}
      <Dialog open={showStitchDialog} onOpenChange={setShowStitchDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-purple-600" />
              Custom Stitching Request
            </DialogTitle>
            <DialogDescription>
              Request custom tailoring with {selectedFabric?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedFabric && (
              <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-20 h-20 rounded overflow-hidden">
                  {selectedFabric.image_url ? (
                    <img loading="lazy"
                      src={selectedFabric.image_url.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${selectedFabric.image_url}` : selectedFabric.image_url}
                      alt={selectedFabric.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold">{selectedFabric.name}</h4>
                  <p className="text-sm text-gray-500">{selectedFabric.category}</p>
                  <p className="text-purple-600 font-bold">{currencySymbol}{selectedFabric.price_per_meter}/m</p>
                </div>
              </div>
            )}
            
            <div>
              <Label>Clothing Type *</Label>
              <Select value={stitchForm.clothing_type} onValueChange={(v) => setStitchForm({ ...stitchForm, clothing_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="What do you want stitched?" />
                </SelectTrigger>
                <SelectContent>
                  {CLOTHING_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={stitchForm.quantity}
                  onChange={(e) => setStitchForm({ ...stitchForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Urgency</Label>
                <Select value={stitchForm.urgency} onValueChange={(v) => setStitchForm({ ...stitchForm, urgency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal (7 days)</SelectItem>
                    <SelectItem value="express">Express (3 days) +50%</SelectItem>
                    <SelectItem value="urgent">Urgent (1 day) +100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Design Notes</Label>
              <Textarea
                value={stitchForm.design_notes}
                onChange={(e) => setStitchForm({ ...stitchForm, design_notes: e.target.value })}
                placeholder="Any specific design requirements..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Your Name *</Label>
                <Input
                  value={stitchForm.customer_name}
                  onChange={(e) => setStitchForm({ ...stitchForm, customer_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={stitchForm.customer_phone}
                  onChange={(e) => setStitchForm({ ...stitchForm, customer_phone: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={stitchForm.customer_email}
                onChange={(e) => setStitchForm({ ...stitchForm, customer_email: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Delivery Address</Label>
              <Textarea
                value={stitchForm.delivery_address}
                onChange={(e) => setStitchForm({ ...stitchForm, delivery_address: e.target.value })}
                placeholder="Full address for delivery"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStitchDialog(false)}>Cancel</Button>
            <Button onClick={submitStitchRequest} className="bg-purple-600 hover:bg-purple-700">
              <Scissors className="w-4 h-4 mr-2" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
