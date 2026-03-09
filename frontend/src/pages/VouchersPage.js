import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, BadgePercent, Calendar, Percent, Gift, Share2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import VoucherImageGenerator from '../components/VoucherImageGenerator';

export default function VouchersPage() {
  const { api, user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // FIX: avoid `null` initial state which can cause a one-frame flash when the Share modal
  // mounts and reads selectedVoucher before it's set.
  const [selectedVoucher, setSelectedVoucher] = useState({});

  // FIX: keep the selected voucher state stable by clearing it whenever the share modal closes.
  // This prevents stale/empty intermediate UI states from flashing on subsequent opens.
  useEffect(() => {
    if (!showShareModal) setSelectedVoucher({});
  }, [showShareModal]);

  const [form, setForm] = useState({
    code: '', voucher_type: 'gift', value: 0, is_percentage: false,
    min_purchase: 0, max_discount: '', valid_from: '', valid_until: '',
    usage_limit: 1, per_customer_limit: 1, description: '', active: true
  });

  const fetchData = async () => {
    try {
      const data = await api('/api/vouchers');
      setVouchers(data);
    } catch (err) {
      toast.error('Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/vouchers', { method: 'POST', body: JSON.stringify({
        ...form,
        max_discount: form.max_discount ? parseFloat(form.max_discount) : null
      }) });
      toast.success('Voucher created');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this voucher?')) return;
    try {
      await api(`/api/vouchers/${id}`, { method: 'DELETE' });
      toast.success('Voucher deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setForm({
      code: '', voucher_type: 'gift', value: 0, is_percentage: false,
      min_purchase: 0, max_discount: '', valid_from: '', valid_until: '',
      usage_limit: 1, per_customer_limit: 1, description: '', active: true
    });
  };

  const isExpired = (voucher) => {
    const today = new Date().toISOString().split('T')[0];
    return voucher.valid_until < today;
  };

  const isUpcoming = (voucher) => {
    const today = new Date().toISOString().split('T')[0];
    return voucher.valid_from > today;
  };

  return (
    <div className="space-y-6" data-testid="vouchers-page">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowModal(true); }} data-testid="add-voucher-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Voucher
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vouchers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BadgePercent className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No vouchers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vouchers.map((voucher) => (
            <Card key={voucher.id} className={`hover:shadow-lg transition-shadow ${isExpired(voucher) ? 'opacity-60' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-lg bg-accent">
                    {voucher.voucher_type === 'gift' ? (
                      <Gift className="w-6 h-6" />
                    ) : (
                      <Percent className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!voucher.active && <Badge variant="secondary">Inactive</Badge>}
                    {isExpired(voucher) && <Badge variant="destructive">Expired</Badge>}
                    {isUpcoming(voucher) && <Badge variant="outline">Upcoming</Badge>}
                  </div>
                </div>
                
                <h3 className="font-bold text-xl font-mono-data">{voucher.code}</h3>
                <p className="text-2xl font-bold mt-2">
                  {voucher.is_percentage ? (
                    <span className="font-mono-data">{voucher.value}% OFF</span>
                  ) : (
                    <span className="font-mono-data">{currencySymbol}{voucher.value} OFF</span>
                  )}
                </p>
                
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{voucher.valid_from} to {voucher.valid_until}</span>
                  </div>
                  <p>Min Purchase: <span className="font-mono-data">{currencySymbol}{voucher.min_purchase}</span></p>
                  <p>Usage: <span className="font-mono-data">{voucher.used_count}/{voucher.usage_limit}</span></p>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      setSelectedVoucher({
                        code: voucher.code,
                        discount_value: voucher.value,
                        discount_type: voucher.is_percentage ? 'percentage' : 'amount',
                        min_order: voucher.min_purchase,
                        max_uses: voucher.usage_limit,
                        used_count: voucher.used_count,
                        valid_until: voucher.valid_until
                      });
                      setShowShareModal(true);
                    }}
                  >
                    <Share2 className="w-3 h-3 mr-1" /> Share
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => handleDelete(voucher.id)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Voucher</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Voucher Code *</Label>
                <Input 
                  value={form.code} 
                  onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} 
                  required 
                  placeholder="e.g., SAVE20"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.voucher_type} onValueChange={(v) => setForm({...form, voucher_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gift">Gift / Fixed</SelectItem>
                    <SelectItem value="percent">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value *</Label>
                <Input 
                  type="number" 
                  value={form.value} 
                  onChange={(e) => setForm({...form, value: parseFloat(e.target.value) || 0})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Min Purchase</Label>
                <Input 
                  type="number" 
                  value={form.min_purchase} 
                  onChange={(e) => setForm({...form, min_purchase: parseFloat(e.target.value) || 0})} 
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch 
                checked={form.is_percentage} 
                onCheckedChange={(c) => setForm({...form, is_percentage: c})} 
              />
              <Label>Percentage Discount</Label>
            </div>

            {form.is_percentage && (
              <div className="space-y-2">
                <Label>Max Discount (Optional)</Label>
                <Input 
                  type="number" 
                  value={form.max_discount} 
                  onChange={(e) => setForm({...form, max_discount: e.target.value})} 
                  placeholder="Maximum discount amount"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From *</Label>
                <Input 
                  type="date" 
                  value={form.valid_from} 
                  onChange={(e) => setForm({...form, valid_from: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until *</Label>
                <Input 
                  type="date" 
                  value={form.valid_until} 
                  onChange={(e) => setForm({...form, valid_until: e.target.value})} 
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Usage Limit</Label>
                <Input 
                  type="number" 
                  value={form.usage_limit} 
                  onChange={(e) => setForm({...form, usage_limit: parseInt(e.target.value) || 1})} 
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Per Customer Limit</Label>
                <Input 
                  type="number" 
                  value={form.per_customer_limit} 
                  onChange={(e) => setForm({...form, per_customer_limit: parseInt(e.target.value) || 1})} 
                  min={1}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Create Voucher</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Voucher Image Generator for Sharing */}
      <VoucherImageGenerator
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        voucher={selectedVoucher}
        storeName={user?.business_name || 'Your Store'}
      />
    </div>
  );
}
