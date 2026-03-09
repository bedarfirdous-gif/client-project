import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { usePermissions } from '../contexts/PermissionContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Store, MapPin, Phone, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';

export default function StoresPage() {
  const { api } = useAuth();
  const { canPerformAction } = usePermissions();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  // FIX: avoid `null` initial state (can cause a brief UI flash when the modal/form derives UI from this value).
  // Use an explicit "no edit" sentinel object instead; create vs edit is still determined by presence of `editStore.id`.
  const EMPTY_EDIT_STORE = { id: null };
  const [editStore, setEditStore] = useState(EMPTY_EDIT_STORE);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', manager_name: '', is_warehouse: false });

  const fetchData = async () => {
    try {
      const data = await api('/api/stores');
      setStores(data);
    } catch (err) {
      toast.error('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editStore) {
        await api(`/api/stores/${editStore.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('Store updated');
      } else {
        await api('/api/stores', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Store created');
      }
      setShowModal(false);
      setEditStore(null);
      setForm({ name: '', code: '', address: '', phone: '', manager_name: '', is_warehouse: false });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this store?')) return;
    try {
      await api(`/api/stores/${id}`, { method: 'DELETE' });
      toast.success('Store deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (store) => {
    setEditStore(store);
    setForm({ name: store.name, code: store.code, address: store.address || '', phone: store.phone || '', manager_name: store.manager_name || '', is_warehouse: store.is_warehouse || false });
    setShowModal(true);
  };

  return (
    <div className="space-y-6" data-testid="stores-page">
      <div className="flex justify-end">
        {canPerformAction('stores', 'create') && (
          <Button onClick={() => { setEditStore(null); setForm({ name: '', code: '', address: '', phone: '', manager_name: '', is_warehouse: false }); setShowModal(true); }} data-testid="add-store-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Store
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No stores found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-accent">
                    <Store className="w-6 h-6" />
                  </div>
                  {store.is_warehouse && (
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      Warehouse
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-lg">{store.name}</h3>
                <p className="text-sm text-muted-foreground font-mono-data">Code: {store.code}</p>
                
                {store.address && (
                  <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{store.address}</span>
                  </div>
                )}
                {store.phone && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span className="font-mono-data">{store.phone}</span>
                  </div>
                )}
                {store.manager_name && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>{store.manager_name}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  {canPerformAction('stores', 'edit') && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(store)}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  )}
                  {canPerformAction('stores', 'delete') && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(store.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editStore ? 'Edit Store' : 'Add New Store'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Store Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Store Code *</Label>
                <Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Manager Name</Label>
                <Input value={form.manager_name} onChange={(e) => setForm({...form, manager_name: e.target.value})} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_warehouse} onCheckedChange={(c) => setForm({...form, is_warehouse: c})} />
              <Label>Is Warehouse</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{editStore ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
