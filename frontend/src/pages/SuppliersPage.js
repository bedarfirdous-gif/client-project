import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { usePermissions } from '../contexts/PermissionContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Building2, Phone, Mail, User, MoreHorizontal, Eye, Search, Loader2, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

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

// Get state name from GST number (first 2 digits)
const getStateFromGST = (gstNumber) => {
  if (!gstNumber || gstNumber.length < 2) return null;
  const stateCode = gstNumber.substring(0, 2);
  return INDIAN_STATES.find(s => s.code === stateCode);
};

export default function SuppliersPage() {
  const { api } = useAuth();
  const { canPerformAction } = usePermissions();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  // FIX: Use a stable explicit "empty" value (null) for editSupplier.
  // This avoids an initial `undefined` state that can briefly render a different UI path
  // before we set the actual supplier object, which may cause a visible flash.
  // Keep existing logic (`if (editSupplier)`) working as-is.
  const [editSupplier, setEditSupplier] = useState(null);
  const [form, setForm] = useState({ 
    name: '', contact_person: '', phone: '', email: '', address: '', 
    gst_number: '', state: '', city: '', pincode: '' 
  });
  const [fetchingGST, setFetchingGST] = useState(false);

  const fetchData = async () => {
    try {
      const data = await api('/api/suppliers');
      setSuppliers(data);
    } catch (err) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-fetch supplier details from GST number
  const fetchSupplierByGST = async (gstNumber) => {
    if (!gstNumber || gstNumber.length !== 15) {
      return;
    }

    // Validate GST format
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gstNumber.toUpperCase())) {
      toast.error('Invalid GST number format');
      return;
    }

    setFetchingGST(true);
    try {
      // Use backend GST lookup API (enhanced with multiple sources)
      const response = await api(`/api/gst/lookup/${gstNumber}`);
      
      if (response && response.valid) {
        setForm(prev => ({
          ...prev,
          name: response.trade_name || response.legal_name || prev.name,
          address: response.address || prev.address,
          state: response.state_name || prev.state,
          city: response.city || prev.city,
          pincode: response.pincode || prev.pincode,
        }));
        
        // Show detailed success message based on what was fetched
        if (response.legal_name || response.trade_name) {
          const details = [];
          if (response.legal_name) details.push(`Legal: ${response.legal_name}`);
          if (response.trade_name && response.trade_name !== response.legal_name) details.push(`Trade: ${response.trade_name}`);
          if (response.status) details.push(`Status: ${response.status}`);
          
          toast.success('GST Details Fetched Successfully!', {
            duration: 5000,
            description: details.join(' | ')
          });
        } else {
          toast.info(`State detected: ${response.state_name}`, {
            description: 'Business details not available in free API'
          });
        }
      } else {
        toast.error('Could not verify GSTIN');
      }
    } catch (err) {
      console.log('GST fetch error:', err);
      // Fallback: Extract state from GST number locally
      const stateInfo = getStateFromGST(gstNumber);
      if (stateInfo) {
        setForm(prev => ({
          ...prev,
          state: stateInfo.name
        }));
        toast.info(`State detected from GST: ${stateInfo.name}`);
      }
    } finally {
      setFetchingGST(false);
    }
  };

  // Handle GST number change with auto-fetch
  const handleGSTChange = (value) => {
    const upperValue = value.toUpperCase();
    setForm(prev => ({ ...prev, gst_number: upperValue }));
    
    // Auto-fetch when GST number is complete (15 characters)
    if (upperValue.length === 15) {
      fetchSupplierByGST(upperValue);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editSupplier) {
        await api(`/api/suppliers/${editSupplier.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('Supplier updated');
      } else {
        await api('/api/suppliers', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Supplier created');
      }
      setShowModal(false);
      setEditSupplier(null);
      setForm({ name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', state: '', city: '', pincode: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await api(`/api/suppliers/${id}`, { method: 'DELETE' });
      toast.success('Supplier deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (supplier) => {
    setEditSupplier(supplier);
    setForm({ 
      name: supplier.name, 
      contact_person: supplier.contact_person || '', 
      phone: supplier.phone || '', 
      email: supplier.email || '', 
      address: supplier.address || '', 
      gst_number: supplier.gst_number || '',
      state: supplier.state || '',
      city: supplier.city || '',
      pincode: supplier.pincode || ''
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6" data-testid="suppliers-page">
      <div className="flex justify-end">
        {canPerformAction('suppliers', 'create') && (
          <Button onClick={() => { setEditSupplier(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', state: '', city: '', pincode: '' }); setShowModal(true); }} data-testid="add-supplier-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Supplier
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No suppliers found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>State</TableHead>
                <TableHead>GST Number</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contact_person || '-'}</TableCell>
                  <TableCell className="font-mono-data">{supplier.phone || '-'}</TableCell>
                  <TableCell>{supplier.state || '-'}</TableCell>
                  <TableCell className="font-mono-data">{supplier.gst_number || '-'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`supplier-actions-${supplier.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(supplier)} data-testid={`view-supplier-${supplier.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {canPerformAction('suppliers', 'edit') && (
                          <DropdownMenuItem onClick={() => openEdit(supplier)} data-testid={`edit-supplier-${supplier.id}`}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Supplier
                          </DropdownMenuItem>
                        )}
                        {canPerformAction('suppliers', 'delete') && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(supplier.id)} 
                              className="text-destructive focus:text-destructive"
                              data-testid={`delete-supplier-${supplier.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Supplier
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* GST Number with Auto-Fetch */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                GST Number
                {fetchingGST && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </Label>
              <div className="relative">
                <Input 
                  value={form.gst_number} 
                  onChange={(e) => handleGSTChange(e.target.value)}
                  placeholder="e.g., 29ABCDE1234F1Z5"
                  maxLength={15}
                  className="uppercase font-mono"
                />
                {form.gst_number.length === 15 && !fetchingGST && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                    onClick={() => fetchSupplierByGST(form.gst_number)}
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Fetch
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Enter 15-digit GST number to auto-fetch supplier details
              </p>
            </div>

            <div className="space-y-2">
              <Label>Supplier Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({...form, contact_person: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={form.state} onValueChange={(v) => setForm({...form, state: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(state => (
                      <SelectItem key={state.code} value={state.name}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({...form, pincode: e.target.value})} maxLength={6} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{editSupplier ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
