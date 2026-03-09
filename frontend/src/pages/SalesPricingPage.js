import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { DollarSign, Tag, Percent, TrendingUp, Save, Edit2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export default function SalesPricingPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fix: avoid null-initialized state that can cause a brief flash when the UI conditionally renders
  // based on `editingVariant`. Use an explicit boolean to control the dialog open state, and keep
  // `editingVariant` as a stable (non-null) object.
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState({});

  const [priceForm, setPriceForm] = useState({ selling_price: 0, cost_price: 0, mrp: 0 });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [i, v, c] = await Promise.all([
        api('/api/items'),
        api('/api/variants'),
        api('/api/categories').catch(() => [])
      ]);
      setItems(i);
      setVariants(v);
      setCategories(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getItemName = (id) => items.find(i => i.id === id)?.name || 'Unknown';
  const getItemCategory = (itemId) => {
    const item = items.find(i => i.id === itemId);
    return item?.category_id;
  };

  const filteredVariants = variants.filter(v => {
    const item = items.find(i => i.id === v.item_id);
    const matchesSearch = !searchTerm || 
      item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || getItemCategory(v.item_id) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openPriceEdit = (variant) => {
    setEditingVariant(variant);
    setPriceForm({
      selling_price: variant.selling_price || 0,
      cost_price: variant.cost_price || 0,
      mrp: variant.mrp || variant.selling_price || 0
    });
  };

  const savePricing = async () => {
    try {
      await api(`/api/variants/${editingVariant.id}`, {
        method: 'PUT',
        body: JSON.stringify(priceForm)
      });
      toast.success('Pricing updated!');
      setEditingVariant(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const bulkUpdateMargin = async (marginPercent) => {
    if (!window.confirm(`Apply ${marginPercent}% margin to all filtered products?`)) return;
    try {
      for (const v of filteredVariants) {
        const newPrice = v.cost_price * (1 + marginPercent / 100);
        await api(`/api/variants/${v.id}`, {
          method: 'PUT',
          body: JSON.stringify({ selling_price: Math.round(newPrice) })
        });
      }
      toast.success('Bulk pricing updated!');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const calcMargin = (selling, cost) => {
    if (!cost || cost === 0) return 0;
    return ((selling - cost) / cost * 100).toFixed(1);
  };

  const avgMargin = () => {
    const withCost = variants.filter(v => v.cost_price > 0);
    if (withCost.length === 0) return 0;
    const totalMargin = withCost.reduce((sum, v) => sum + parseFloat(calcMargin(v.selling_price, v.cost_price)), 0);
    return (totalMargin / withCost.length).toFixed(1);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="sales-pricing-page">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <Tag className="w-8 h-8 text-blue-600 mb-2" />
          <p className="text-sm text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold">{variants.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <Percent className="w-8 h-8 text-emerald-600 mb-2" />
          <p className="text-sm text-muted-foreground">Avg Margin</p>
          <p className="text-2xl font-bold text-emerald-600">{avgMargin()}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
          <p className="text-sm text-muted-foreground">High Margin (&gt;50%)</p>
          <p className="text-2xl font-bold text-purple-600">{variants.filter(v => parseFloat(calcMargin(v.selling_price, v.cost_price)) > 50).length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <DollarSign className="w-8 h-8 text-amber-600 mb-2" />
          <p className="text-sm text-muted-foreground">Low Margin (&lt;20%)</p>
          <p className="text-2xl font-bold text-amber-600">{variants.filter(v => v.cost_price > 0 && parseFloat(calcMargin(v.selling_price, v.cost_price)) < 20).length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <CardTitle>Product Pricing</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => bulkUpdateMargin(30)}>Apply 30% Margin</Button>
              <Button variant="outline" size="sm" onClick={() => bulkUpdateMargin(50)}>Apply 50% Margin</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input 
              placeholder="Search products..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">SKU</th>
                <th className="text-right p-3">Cost Price</th>
                <th className="text-right p-3">Selling Price</th>
                <th className="text-right p-3">MRP</th>
                <th className="text-right p-3">Margin</th>
                <th className="text-right p-3">Actions</th>
              </tr></thead>
              <tbody>
                {filteredVariants.map((v) => {
                  const margin = calcMargin(v.selling_price, v.cost_price);
                  return (
                    <tr key={v.id} className="border-b hover:bg-accent/30">
                      <td className="p-3 font-medium">{getItemName(v.item_id)}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{v.sku || '-'}</td>
                      <td className="p-3 text-right">{currencySymbol}{v.cost_price?.toLocaleString() || 0}</td>
                      <td className="p-3 text-right font-bold">{currencySymbol}{v.selling_price?.toLocaleString() || 0}</td>
                      <td className="p-3 text-right text-muted-foreground">{currencySymbol}{v.mrp?.toLocaleString() || v.selling_price?.toLocaleString() || 0}</td>
                      <td className="p-3 text-right">
                        <Badge variant={parseFloat(margin) > 40 ? 'default' : parseFloat(margin) > 20 ? 'secondary' : 'destructive'}>
                          {margin}%
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => openPriceEdit(v)}>
                          <Edit2 className="w-4 h-4 mr-1" /> Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Pricing Modal */}
      <Dialog open={!!editingVariant} onOpenChange={() => setEditingVariant(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Pricing - {getItemName(editingVariant?.item_id)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">SKU: {editingVariant?.sku}</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cost Price ({currencySymbol})</Label>
                <Input type="number" min="0" value={priceForm.cost_price} onChange={(e) => setPriceForm({...priceForm, cost_price: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Selling Price ({currencySymbol})</Label>
                <Input type="number" min="0" value={priceForm.selling_price} onChange={(e) => setPriceForm({...priceForm, selling_price: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>MRP ({currencySymbol})</Label>
                <Input type="number" min="0" value={priceForm.mrp} onChange={(e) => setPriceForm({...priceForm, mrp: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="bg-accent/50 p-3 rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margin:</span>
                <span className="font-bold">{calcMargin(priceForm.selling_price, priceForm.cost_price)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit:</span>
                <span className="font-bold text-emerald-600">{currencySymbol}{(priceForm.selling_price - priceForm.cost_price).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingVariant(null)}>Cancel</Button>
              <Button onClick={savePricing}><Save className="w-4 h-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
