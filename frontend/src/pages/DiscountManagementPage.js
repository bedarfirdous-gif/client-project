import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Plus, Trash2, Gift, Tag, Layers, X, Edit2, Percent, DollarSign, 
  Package, CheckSquare, Square, Search, Filter, ChevronDown, ChevronUp,
  ShoppingBag, Check, Globe, List, Building2, Zap, ShoppingCart, Monitor, Wifi, FileText
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import { Switch } from '../components/ui/switch';

const today = new Date().toISOString().split('T')[0];
const nextMonth = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

// Centralized discount default settings
const centralizedDefaults = {
  is_global: true,              // Applies to all branches by default
  auto_apply: true,             // Auto-applies when conditions are met
  allow_branch_override: false, // Branches cannot override by default
  applicable_store_ids: [],     // Empty = all stores
  excluded_store_ids: [],       // No exclusions by default
  apply_on: ['pos', 'online', 'invoice'],  // Where discount applies
};

const emptyItemDiscount = {
  name: '',
  discount_type: 'percentage', 
  discount_value: 10, 
  min_quantity: 1,
  valid_from: today, 
  valid_until: nextMonth, 
  description: '', 
  active: true,
  applies_to: 'all', // 'all' or 'selected'
  selected_items: [], // array of item IDs
  ...centralizedDefaults,
};

const emptyBogo = {
  name: '', 
  buy_quantity: 2, 
  get_quantity: 1, 
  get_discount_percent: 100,
  valid_from: today, 
  valid_until: nextMonth, 
  description: '', 
  active: true,
  applies_to: 'all',
  selected_items: [],
  ...centralizedDefaults,
};

const emptyTiered = {
  name: '', 
  discount_type: 'cart_total',
  tiers: [{ min: 1000, discount: 100, is_percent: false }],
  valid_from: today, 
  valid_until: nextMonth, 
  stackable: false, 
  description: '', 
  active: true,
  applies_to: 'all',
  selected_items: [],
  ...centralizedDefaults,
};

export default function DiscountManagementPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [itemDiscounts, setItemDiscounts] = useState([]);
  const [bogoOffers, setBogoOffers] = useState([]);
  const [tieredDiscounts, setTieredDiscounts] = useState([]);
  
  const [showItemModal, setShowItemModal] = useState(false);
  const [showBogoModal, setShowBogoModal] = useState(false);
  const [showTieredModal, setShowTieredModal] = useState(false);

  // Fix: avoid initializing with `null` (null→object transitions can cause a brief UI flash
  // in conditional rendering paths). Use a stable non-null sentinel object instead.
  // Treat `editingDiscount.id` as the source of truth for "editing".
  const [editingDiscount, setEditingDiscount] = useState({});
  
  const [itemForm, setItemForm] = useState(emptyItemDiscount);
  const [bogoForm, setBogoForm] = useState(emptyBogo);
  const [tieredForm, setTieredForm] = useState(emptyTiered);
  
  const [itemSearch, setItemSearch] = useState('');
  const [showItemSelector, setShowItemSelector] = useState(false);

  // Use a non-null sentinel for initial state to prevent a null->value re-render flash.
  // "" means "no form type selected yet".
  const [currentFormType, setCurrentFormType] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [d1, d2, d3, itemsData, storesData] = await Promise.all([
        api('/api/item-discounts?active_only=false'),
        api('/api/bogo-offers?active_only=false'),
        api('/api/tiered-discounts?active_only=false'),
        api('/api/items'),
        api('/api/stores'),
      ]);
      setItemDiscounts(d1);
      setBogoOffers(d2);
      setTieredDiscounts(d3);
      setItems(itemsData);
      setStores(storesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteDiscount = async (type, id) => {
    if (!window.confirm('Delete this discount?')) return;
    try {
      await api(`/api/${type}/${id}`, { method: 'DELETE' });
      toast.success('Discount deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleActive = async (type, discount) => {
    try {
      await api(`/api/${type}/${discount.id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ ...discount, active: !discount.active }) 
      });
      toast.success(discount.active ? 'Discount deactivated' : 'Discount activated');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Item Discount Functions
  const openItemModal = (discount = null) => {
    if (discount) {
      setItemForm({
        ...discount,
        applies_to: discount.applies_to || (discount.selected_items?.length > 0 ? 'selected' : 'all'),
        selected_items: discount.selected_items || [],
      });
      setEditingDiscount(discount);
    } else {
      setItemForm(emptyItemDiscount);
      setEditingDiscount(null);
    }
    setShowItemModal(true);
  };

  const saveItemDiscount = async (e) => {
    e.preventDefault();
    if (!itemForm.name) { toast.error('Name is required'); return; }
    try {
      const data = {
        ...itemForm,
        selected_items: itemForm.applies_to === 'all' ? [] : itemForm.selected_items,
      };
      
      if (editingDiscount) {
        await api(`/api/item-discounts/${editingDiscount.id}`, { method: 'PUT', body: JSON.stringify(data) });
        toast.success('Item discount updated!');
      } else {
        await api('/api/item-discounts', { method: 'POST', body: JSON.stringify(data) });
        toast.success('Item discount created!');
      }
      setShowItemModal(false);
      setItemForm(emptyItemDiscount);
      setEditingDiscount(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // BOGO Functions
  const openBogoModal = (offer = null) => {
    if (offer) {
      setBogoForm({
        ...offer,
        applies_to: offer.applies_to || (offer.selected_items?.length > 0 ? 'selected' : 'all'),
        selected_items: offer.selected_items || [],
      });
      setEditingDiscount(offer);
    } else {
      setBogoForm(emptyBogo);
      setEditingDiscount(null);
    }
    setShowBogoModal(true);
  };

  const saveBogo = async (e) => {
    e.preventDefault();
    if (!bogoForm.name) { toast.error('Name is required'); return; }
    try {
      const data = {
        ...bogoForm,
        selected_items: bogoForm.applies_to === 'all' ? [] : bogoForm.selected_items,
      };
      
      if (editingDiscount) {
        await api(`/api/bogo-offers/${editingDiscount.id}`, { method: 'PUT', body: JSON.stringify(data) });
        toast.success('BOGO offer updated!');
      } else {
        await api('/api/bogo-offers', { method: 'POST', body: JSON.stringify(data) });
        toast.success('BOGO offer created!');
      }
      setShowBogoModal(false);
      setBogoForm(emptyBogo);
      setEditingDiscount(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Tiered Functions
  const openTieredModal = (discount = null) => {
    if (discount) {
      setTieredForm({
        ...discount,
        applies_to: discount.applies_to || (discount.selected_items?.length > 0 ? 'selected' : 'all'),
        selected_items: discount.selected_items || [],
      });
      setEditingDiscount(discount);
    } else {
      setTieredForm(emptyTiered);
      setEditingDiscount(null);
    }
    setShowTieredModal(true);
  };

  const saveTiered = async (e) => {
    e.preventDefault();
    if (!tieredForm.name) { toast.error('Name is required'); return; }
    if (tieredForm.tiers.length === 0) { toast.error('Add at least one tier'); return; }
    try {
      const data = {
        ...tieredForm,
        selected_items: tieredForm.applies_to === 'all' ? [] : tieredForm.selected_items,
      };
      
      if (editingDiscount) {
        await api(`/api/tiered-discounts/${editingDiscount.id}`, { method: 'PUT', body: JSON.stringify(data) });
        toast.success('Tiered discount updated!');
      } else {
        await api('/api/tiered-discounts', { method: 'POST', body: JSON.stringify(data) });
        toast.success('Tiered discount created!');
      }
      setShowTieredModal(false);
      setTieredForm(emptyTiered);
      setEditingDiscount(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addTier = () => {
    const lastTier = tieredForm.tiers[tieredForm.tiers.length - 1];
    const newMin = lastTier ? lastTier.min + 1000 : 1000;
    setTieredForm({ ...tieredForm, tiers: [...tieredForm.tiers, { min: newMin, discount: 100, is_percent: false }] });
  };

  const updateTier = (idx, field, value) => {
    const updated = [...tieredForm.tiers];
    updated[idx][field] = value;
    setTieredForm({ ...tieredForm, tiers: updated });
  };

  const removeTier = (idx) => {
    setTieredForm({ ...tieredForm, tiers: tieredForm.tiers.filter((_, i) => i !== idx) });
  };

  // Item Selection Functions
  const toggleItemSelection = (itemId, formType) => {
    const form = formType === 'item' ? itemForm : formType === 'bogo' ? bogoForm : tieredForm;
    const setForm = formType === 'item' ? setItemForm : formType === 'bogo' ? setBogoForm : setTieredForm;
    
    const currentItems = form.selected_items || [];
    const newItems = currentItems.includes(itemId) 
      ? currentItems.filter(id => id !== itemId)
      : [...currentItems, itemId];
    
    setForm({ ...form, selected_items: newItems });
  };

  const selectAllItems = (formType) => {
    const setForm = formType === 'item' ? setItemForm : formType === 'bogo' ? setBogoForm : setTieredForm;
    const form = formType === 'item' ? itemForm : formType === 'bogo' ? bogoForm : tieredForm;
    setForm({ ...form, selected_items: items.map(i => i.id) });
  };

  const clearAllItems = (formType) => {
    const setForm = formType === 'item' ? setItemForm : formType === 'bogo' ? setBogoForm : setTieredForm;
    const form = formType === 'item' ? itemForm : formType === 'bogo' ? bogoForm : tieredForm;
    setForm({ ...form, selected_items: [] });
  };

  const getItemName = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item?.name || 'Unknown Item';
  };

  const filteredItems = items.filter(item => 
    item.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.sku?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  // Item Selector Component
  const ItemSelector = ({ formType, currentForm, setForm }) => {
    const selectedItems = currentForm.selected_items || [];
    
    return (
      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" /> Applicable Items
          </Label>
        </div>
        
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={currentForm.applies_to === 'all'}
              onChange={() => setForm({ ...currentForm, applies_to: 'all', selected_items: [] })}
              className="w-4 h-4 text-primary"
            />
            <Globe className="w-4 h-4 text-blue-500" />
            <span className="font-medium">All Items</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={currentForm.applies_to === 'selected'}
              onChange={() => setForm({ ...currentForm, applies_to: 'selected' })}
              className="w-4 h-4 text-primary"
            />
            <List className="w-4 h-4 text-purple-500" />
            <span className="font-medium">Selected Items</span>
          </label>
        </div>

        {currentForm.applies_to === 'selected' && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => selectAllItems(formType)}>
                Select All
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => clearAllItems(formType)}>
                Clear
              </Button>
            </div>

            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground">Selected ({selectedItems.length}):</span>
                {selectedItems.slice(0, 5).map(id => (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {getItemName(id)}
                    <X 
                      className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive" 
                      onClick={() => toggleItemSelection(id, formType)}
                    />
                  </Badge>
                ))}
                {selectedItems.length > 5 && (
                  <Badge variant="outline" className="text-xs">+{selectedItems.length - 5} more</Badge>
                )}
              </div>
            )}

            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredItems.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground text-sm">No items found</p>
                ) : (
                  filteredItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedItems.includes(item.id) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleItemSelection(item.id, formType)}
                    >
                      <Checkbox checked={selectedItems.includes(item.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku || 'No SKU'} • {currencySymbol}{item.selling_price || item.price || 0}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  // Applies To Badge Component
  const AppliesToBadge = ({ discount }) => {
    const appliesTo = discount.applies_to || (discount.selected_items?.length > 0 ? 'selected' : 'all');
    const selectedCount = discount.selected_items?.length || 0;
    
    if (appliesTo === 'all') {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
          <Globe className="w-3 h-3 mr-1" /> All Items
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50">
        <List className="w-3 h-3 mr-1" /> {selectedCount} Items
      </Badge>
    );
  };

  // Centralized Settings Badge Component  
  const CentralizedBadge = ({ discount }) => {
    const isGlobal = discount.is_global !== false;
    const autoApply = discount.auto_apply !== false;
    const applyOn = discount.apply_on || ['pos', 'online', 'invoice'];
    
    return (
      <div className="flex flex-wrap gap-1">
        {isGlobal && (
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">
            <Globe className="w-3 h-3 mr-1" /> Global
          </Badge>
        )}
        {autoApply && (
          <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 text-xs">
            Auto-Apply
          </Badge>
        )}
        {applyOn.map(channel => (
          <Badge key={channel} variant="outline" className="text-gray-600 border-gray-300 bg-gray-50 text-xs capitalize">
            {channel}
          </Badge>
        ))}
      </div>
    );
  };

  // Centralized Settings Section Component
  const CentralizedSettingsSection = ({ currentForm, setForm }) => {
    const toggleApplyOn = (channel) => {
      const currentApplyOn = currentForm.apply_on || ['pos', 'online', 'invoice'];
      const newApplyOn = currentApplyOn.includes(channel)
        ? currentApplyOn.filter(c => c !== channel)
        : [...currentApplyOn, channel];
      setForm({ ...currentForm, apply_on: newApplyOn });
    };

    const toggleStoreSelection = (storeId, field) => {
      const currentList = currentForm[field] || [];
      const newList = currentList.includes(storeId)
        ? currentList.filter(id => id !== storeId)
        : [...currentList, storeId];
      setForm({ ...currentForm, [field]: newList });
    };

    return (
      <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-green-50/50 to-blue-50/50">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Globe className="w-5 h-5 text-green-600" />
          <Label className="text-base font-semibold">Centralized Discount Settings</Label>
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs ml-auto">
            Auto-Sync to All Branches
          </Badge>
        </div>

        {/* Global Toggle */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-sm">Global Discount</p>
              <p className="text-xs text-muted-foreground">Applies to all branches by default</p>
            </div>
          </div>
          <Switch 
            checked={currentForm.is_global !== false}
            onCheckedChange={(checked) => setForm({ ...currentForm, is_global: checked })}
          />
        </div>

        {/* Auto-Apply Toggle */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-sm">Auto-Apply</p>
              <p className="text-xs text-muted-foreground">Automatically applies when conditions are met</p>
            </div>
          </div>
          <Switch 
            checked={currentForm.auto_apply !== false}
            onCheckedChange={(checked) => setForm({ ...currentForm, auto_apply: checked })}
          />
        </div>

        {/* Allow Branch Override Toggle */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium text-sm">Allow Branch Override</p>
              <p className="text-xs text-muted-foreground">Let branches customize this discount</p>
            </div>
          </div>
          <Switch 
            checked={currentForm.allow_branch_override === true}
            onCheckedChange={(checked) => setForm({ ...currentForm, allow_branch_override: checked })}
          />
        </div>

        {/* Apply On Channels */}
        <div className="p-3 bg-white rounded-lg border space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <Label className="font-medium text-sm">Apply On Channels</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'pos', label: 'POS', icon: <Monitor className="w-4 h-4" /> },
              { id: 'online', label: 'Online Orders', icon: <Wifi className="w-4 h-4" /> },
              { id: 'invoice', label: 'Manual Invoice', icon: <FileText className="w-4 h-4" /> },
            ].map(channel => (
              <Button
                key={channel.id}
                type="button"
                variant={(currentForm.apply_on || ['pos', 'online', 'invoice']).includes(channel.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleApplyOn(channel.id)}
                className="gap-2"
              >
                {channel.icon}
                {channel.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Store Exclusions (only show if not global or has exclusions) */}
        {(!currentForm.is_global || (currentForm.excluded_store_ids?.length > 0)) && stores.length > 0 && (
          <div className="p-3 bg-white rounded-lg border space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-600" />
              <Label className="font-medium text-sm">Exclude Stores</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {stores.map(store => (
                <Button
                  key={store.id}
                  type="button"
                  variant={(currentForm.excluded_store_ids || []).includes(store.id) ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => toggleStoreSelection(store.id, 'excluded_store_ids')}
                  className="gap-1"
                >
                  <Building2 className="w-3 h-3" />
                  {store.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="discount-management-page">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Tag className="w-8 h-8 text-blue-600" />
              <Button size="sm" onClick={() => openItemModal()} data-testid="add-item-discount-btn" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Item Discounts</p>
            <p className="text-3xl font-bold text-blue-600">{itemDiscounts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Percentage or fixed discounts</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Gift className="w-8 h-8 text-purple-600" />
              <Button size="sm" onClick={() => openBogoModal()} data-testid="add-bogo-btn" className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">BOGO Offers</p>
            <p className="text-3xl font-bold text-purple-600">{bogoOffers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Buy X Get Y offers</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Layers className="w-8 h-8 text-emerald-600" />
              <Button size="sm" onClick={() => openTieredModal()} data-testid="add-tiered-btn" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Tiered Discounts</p>
            <p className="text-3xl font-bold text-emerald-600">{tieredDiscounts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Spend more, save more</p>
          </CardContent>
        </Card>
      </div>

      {/* Discount Lists */}
      <Tabs defaultValue="item" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="item" className="flex items-center gap-2">
            <Tag className="w-4 h-4" /> Item Discounts ({itemDiscounts.length})
          </TabsTrigger>
          <TabsTrigger value="bogo" className="flex items-center gap-2">
            <Gift className="w-4 h-4" /> BOGO ({bogoOffers.length})
          </TabsTrigger>
          <TabsTrigger value="tiered" className="flex items-center gap-2">
            <Layers className="w-4 h-4" /> Tiered ({tieredDiscounts.length})
          </TabsTrigger>
        </TabsList>

        {/* Item Discounts Tab */}
        <TabsContent value="item">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                Item Discounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {itemDiscounts.length === 0 ? (
                <div className="text-center py-12">
                  <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No item discounts created yet</p>
                  <Button className="mt-4" onClick={() => openItemModal()}>
                    <Plus className="w-4 h-4 mr-2" /> Create Item Discount
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Discount</th>
                        <th className="text-left p-3 font-medium">Applies To</th>
                        <th className="text-left p-3 font-medium">Channels</th>
                        <th className="text-left p-3 font-medium">Validity</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemDiscounts.map((d) => (
                        <tr key={d.id} className="border-t hover:bg-muted/30">
                          <td className="p-3">
                            <p className="font-semibold">{d.name || 'Unnamed Discount'}</p>
                            <p className="text-xs text-muted-foreground">{d.description || 'No description'}</p>
                          </td>
                          <td className="p-3">
                            <Badge className={d.discount_type === 'percentage' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                              {d.discount_type === 'percentage' ? <Percent className="w-3 h-3 mr-1" /> : <DollarSign className="w-3 h-3 mr-1" />}
                              {d.discount_value}{d.discount_type === 'percentage' ? '%' : ` ${currencySymbol}`} OFF
                            </Badge>
                          </td>
                          <td className="p-3">
                            <AppliesToBadge discount={d} />
                          </td>
                          <td className="p-3">
                            <CentralizedBadge discount={d} />
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {d.valid_from} → {d.valid_until}
                          </td>
                          <td className="p-3 text-center">
                            <Badge 
                              variant={d.active ? 'default' : 'secondary'}
                              className={`cursor-pointer ${d.active ? 'bg-green-500' : ''}`}
                              onClick={() => toggleActive('item-discounts', d)}
                            >
                              {d.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => openItemModal(d)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDiscount('item-discounts', d.id)}>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOGO Tab */}
        <TabsContent value="bogo">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" />
                BOGO Offers (Buy One Get One)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bogoOffers.length === 0 ? (
                <div className="text-center py-12">
                  <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No BOGO offers created yet</p>
                  <Button className="mt-4" onClick={() => openBogoModal()}>
                    <Plus className="w-4 h-4 mr-2" /> Create BOGO Offer
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Offer</th>
                        <th className="text-left p-3 font-medium">Applies To</th>
                        <th className="text-left p-3 font-medium">Validity</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bogoOffers.map((o) => (
                        <tr key={o.id} className="border-t hover:bg-muted/30">
                          <td className="p-3">
                            <p className="font-semibold">{o.name}</p>
                            <p className="text-xs text-muted-foreground">{o.description || 'No description'}</p>
                          </td>
                          <td className="p-3">
                            <Badge className="bg-purple-100 text-purple-700">
                              <ShoppingBag className="w-3 h-3 mr-1" />
                              Buy {o.buy_quantity} Get {o.get_quantity} {o.get_discount_percent === 100 ? 'FREE' : `@ ${100 - o.get_discount_percent}%`}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <AppliesToBadge discount={o} />
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {o.valid_from} → {o.valid_until}
                          </td>
                          <td className="p-3 text-center">
                            <Badge 
                              variant={o.active ? 'default' : 'secondary'}
                              className={`cursor-pointer ${o.active ? 'bg-green-500' : ''}`}
                              onClick={() => toggleActive('bogo-offers', o)}
                            >
                              {o.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => openBogoModal(o)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDiscount('bogo-offers', o.id)}>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tiered Tab */}
        <TabsContent value="tiered">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                Tiered Discounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tieredDiscounts.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No tiered discounts created yet</p>
                  <Button className="mt-4" onClick={() => openTieredModal()}>
                    <Plus className="w-4 h-4 mr-2" /> Create Tiered Discount
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tieredDiscounts.map((d) => (
                    <div key={d.id} className="p-4 border rounded-lg bg-gradient-to-r from-emerald-50/50 to-transparent">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">{d.name}</h3>
                            <AppliesToBadge discount={d} />
                          </div>
                          <p className="text-sm text-muted-foreground">{d.description || 'Spend more, save more'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={d.active ? 'default' : 'secondary'}
                            className={`cursor-pointer ${d.active ? 'bg-green-500' : ''}`}
                            onClick={() => toggleActive('tiered-discounts', d)}
                          >
                            {d.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {d.stackable && <Badge variant="outline">Stackable</Badge>}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        {(d.tiers || []).map((t, i) => (
                          <div key={i} className="p-2 bg-white rounded border text-center">
                            <p className="text-xs text-muted-foreground">Spend ≥ {currencySymbol}{t.min?.toLocaleString()}</p>
                            <p className="text-lg font-bold text-emerald-600">
                              {t.is_percent ? `${t.discount}%` : `${currencySymbol}${t.discount}`} OFF
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="text-xs text-muted-foreground">{d.valid_from} → {d.valid_until}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openTieredModal(d)}>
                            <Edit2 className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDiscount('tiered-discounts', d.id)}>
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Item Discount Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              {editingDiscount ? 'Edit Item Discount' : 'New Item Discount'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveItemDiscount} className="space-y-4">
            <div className="space-y-2">
              <Label>Discount Name *</Label>
              <Input 
                value={itemForm.name} 
                onChange={(e) => setItemForm({...itemForm, name: e.target.value})} 
                placeholder="e.g., Summer Sale 20% Off"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select value={itemForm.discount_type} onValueChange={(v) => setItemForm({...itemForm, discount_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ({currencySymbol})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value *</Label>
                <Input 
                  type="number" 
                  min="0" 
                  value={itemForm.discount_value} 
                  onChange={(e) => setItemForm({...itemForm, discount_value: parseFloat(e.target.value) || 0})} 
                />
              </div>
            </div>

            <ItemSelector formType="item" currentForm={itemForm} setForm={setItemForm} />
            
            {/* Centralized Discount Settings */}
            <CentralizedSettingsSection currentForm={itemForm} setForm={setItemForm} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From *</Label>
                <Input type="date" value={itemForm.valid_from} onChange={(e) => setItemForm({...itemForm, valid_from: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Valid Until *</Label>
                <Input type="date" value={itemForm.valid_until} onChange={(e) => setItemForm({...itemForm, valid_until: e.target.value})} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={itemForm.description} onChange={(e) => setItemForm({...itemForm, description: e.target.value})} placeholder="Brief description of this discount" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowItemModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="create-item-discount-btn">
                {editingDiscount ? 'Update' : 'Create'} Discount
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BOGO Modal */}
      <Dialog open={showBogoModal} onOpenChange={setShowBogoModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" />
              {editingDiscount ? 'Edit BOGO Offer' : 'New BOGO Offer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveBogo} className="space-y-4">
            <div className="space-y-2">
              <Label>Offer Name *</Label>
              <Input value={bogoForm.name} onChange={(e) => setBogoForm({...bogoForm, name: e.target.value})} placeholder="e.g., Buy 2 Get 1 Free" required />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Buy Quantity *</Label>
                <Input type="number" min="1" value={bogoForm.buy_quantity} onChange={(e) => setBogoForm({...bogoForm, buy_quantity: parseInt(e.target.value) || 1})} />
              </div>
              <div className="space-y-2">
                <Label>Get Quantity *</Label>
                <Input type="number" min="1" value={bogoForm.get_quantity} onChange={(e) => setBogoForm({...bogoForm, get_quantity: parseInt(e.target.value) || 1})} />
              </div>
              <div className="space-y-2">
                <Label>Discount % on "Get" *</Label>
                <Input type="number" min="0" max="100" value={bogoForm.get_discount_percent} onChange={(e) => setBogoForm({...bogoForm, get_discount_percent: parseFloat(e.target.value) || 100})} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground bg-purple-50 p-2 rounded">
              <strong>Preview:</strong> Buy {bogoForm.buy_quantity}, Get {bogoForm.get_quantity} 
              {bogoForm.get_discount_percent === 100 ? ' FREE' : ` at ${100 - bogoForm.get_discount_percent}% of original price`}
            </p>

            <ItemSelector formType="bogo" currentForm={bogoForm} setForm={setBogoForm} />
            
            {/* Centralized Discount Settings */}
            <CentralizedSettingsSection currentForm={bogoForm} setForm={setBogoForm} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From *</Label>
                <Input type="date" value={bogoForm.valid_from} onChange={(e) => setBogoForm({...bogoForm, valid_from: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Valid Until *</Label>
                <Input type="date" value={bogoForm.valid_until} onChange={(e) => setBogoForm({...bogoForm, valid_until: e.target.value})} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={bogoForm.description} onChange={(e) => setBogoForm({...bogoForm, description: e.target.value})} placeholder="e.g., Buy any 2 items and get 1 free" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBogoModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700" data-testid="create-bogo-btn">
                {editingDiscount ? 'Update' : 'Create'} Offer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tiered Discount Modal */}
      <Dialog open={showTieredModal} onOpenChange={setShowTieredModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              {editingDiscount ? 'Edit Tiered Discount' : 'New Tiered Discount'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTiered} className="space-y-4">
            <div className="space-y-2">
              <Label>Discount Name *</Label>
              <Input value={tieredForm.name} onChange={(e) => setTieredForm({...tieredForm, name: e.target.value})} placeholder="e.g., Spend More Save More" required />
            </div>

            <div className="border rounded-lg p-4 space-y-3 bg-emerald-50/30">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Discount Tiers</Label>
                <Button type="button" size="sm" variant="outline" onClick={addTier}>
                  <Plus className="w-4 h-4 mr-1" /> Add Tier
                </Button>
              </div>
              {tieredForm.tiers.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">No tiers added. Click "Add Tier" to create one.</p>
              ) : (
                <div className="space-y-2">
                  {tieredForm.tiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-3 rounded border">
                      <span className="text-sm font-medium text-emerald-600">Tier {idx + 1}:</span>
                      <span className="text-sm text-muted-foreground">Spend ≥ {currencySymbol}</span>
                      <Input type="number" className="w-28" min="0" value={tier.min} onChange={(e) => updateTier(idx, 'min', parseFloat(e.target.value) || 0)} />
                      <span className="text-sm text-muted-foreground">→ Get</span>
                      <Input type="number" className="w-20" min="0" value={tier.discount} onChange={(e) => updateTier(idx, 'discount', parseFloat(e.target.value) || 0)} />
                      <Select value={tier.is_percent ? 'percent' : 'fixed'} onValueChange={(v) => updateTier(idx, 'is_percent', v === 'percent')}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">{currencySymbol} OFF</SelectItem>
                          <SelectItem value="percent">% OFF</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeTier(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ItemSelector formType="tiered" currentForm={tieredForm} setForm={setTieredForm} />
            
            {/* Centralized Discount Settings */}
            <CentralizedSettingsSection currentForm={tieredForm} setForm={setTieredForm} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From *</Label>
                <Input type="date" value={tieredForm.valid_from} onChange={(e) => setTieredForm({...tieredForm, valid_from: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Valid Until *</Label>
                <Input type="date" value={tieredForm.valid_until} onChange={(e) => setTieredForm({...tieredForm, valid_until: e.target.value})} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={tieredForm.description} onChange={(e) => setTieredForm({...tieredForm, description: e.target.value})} placeholder="e.g., Tiered discount based on cart total" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTieredModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="create-tiered-btn">
                {editingDiscount ? 'Update' : 'Create'} Discount
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
