import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { usePermissions } from '../contexts/PermissionContext';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Users, Phone, Mail, MapPin, Star, Download, Share2, Building2, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import MembershipCardButton from '../components/MembershipCardButton';

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

export default function CustomersPage() {
  const { api } = useAuth();
  const { canPerformAction } = usePermissions();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  // Avoid initializing to null to prevent a null->object transition that can cause a brief visual flash
  // when the modal/form renders conditionally based on edit state.
  const [editCustomer, setEditCustomer] = useState({});
  const [form, setForm] = useState({ 
    name: '', phone: '', email: '', address: '', customer_type: 'retail', 
    loyalty_enrolled: false, gst_number: '', state: '', city: '', pincode: '' 
  });
  const [fetchingGST, setFetchingGST] = useState(false);

  const fetchData = async () => {
    try {
      const data = await api(`/api/customers?search=${search}`);
      setCustomers(data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search]);

  // Auto-fetch customer details from GST number
  const fetchCustomerByGST = async (gstNumber) => {
    if (!gstNumber || gstNumber.length !== 15) return;

    // Validate GST format
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gstNumber.toUpperCase())) {
      toast.error('Invalid GST number format');
      return;
    }

    setFetchingGST(true);
    try {
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
      }
    } catch (err) {
      const stateInfo = getStateFromGST(gstNumber);
      if (stateInfo) {
        setForm(prev => ({ ...prev, state: stateInfo.name }));
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
    
    if (upperValue.length === 15) {
      fetchCustomerByGST(upperValue);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCustomer) {
        await api(`/api/customers/${editCustomer.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('Customer updated');
      } else {
        await api('/api/customers', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Customer created');
      }
      setShowModal(false);
      setEditCustomer(null);
      setForm({ name: '', phone: '', email: '', address: '', customer_type: 'retail', loyalty_enrolled: false, gst_number: '', state: '', city: '', pincode: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this customer to Recycle Bin?\n\nYou can restore it within 30 days.')) return;
    try {
      await api(`/api/customers/${id}`, { method: 'DELETE' });
      toast.success('Customer moved to Recycle Bin');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEdit = (customer) => {
    setEditCustomer(customer);
    setForm({ 
      name: customer.name, 
      phone: customer.phone || '', 
      email: customer.email || '', 
      address: customer.address || '', 
      customer_type: customer.customer_type || 'retail', 
      loyalty_enrolled: customer.loyalty_enrolled || false,
      gst_number: customer.gst_number || '',
      state: customer.state || '',
      city: customer.city || '',
      pincode: customer.pincode || ''
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6" data-testid="customers-page">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={() => { setEditCustomer(null); setForm({ name: '', phone: '', email: '', address: '', customer_type: 'retail', loyalty_enrolled: false, gst_number: '', state: '', city: '', pincode: '' }); setShowModal(true); }} data-testid="add-customer-btn" disabled={!canPerformAction('customers', 'create')} className={!canPerformAction('customers', 'create') ? 'hidden' : ''}>
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No customers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-bold">
                    {customer.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex gap-2">
                    {customer.loyalty_enrolled && (
                      <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Loyalty
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded capitalize ${customer.customer_type === 'wholesale' ? 'status-info' : 'status-success'}`}>
                      {customer.customer_type}
                    </span>
                  </div>
                </div>
                <h3 className="font-bold text-lg">{customer.name}</h3>
                
                {customer.phone && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span className="font-mono-data">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2 mt-1 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{customer.address}</span>
                  </div>
                )}
                {customer.gst_number && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span className="font-mono text-xs">{customer.gst_number}</span>
                  </div>
                )}
                
                {customer.loyalty_enrolled && (
                  <div className="mt-3 p-2 rounded bg-accent/50">
                    <p className="text-sm">Loyalty Points: <span className="font-mono-data font-bold">{customer.loyalty_points || 0}</span></p>
                    <p className="text-xs text-muted-foreground capitalize">Tier: {customer.loyalty_tier || 'standard'}</p>
                    <div className="mt-2">
                      <MembershipCardButton customer={customer} variant="outline" size="sm" showPreview={true} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  {canPerformAction('customers', 'edit') && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(customer)}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  )}
                  {canPerformAction('customers', 'delete') && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(customer.id)}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* GST Number with Auto-fetch */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                GST Number (Optional - Auto-fills details)
              </Label>
              <div className="relative">
                <Input 
                  value={form.gst_number} 
                  onChange={(e) => handleGSTChange(e.target.value)}
                  placeholder="Enter 15-digit GSTIN"
                  maxLength={15}
                  className="uppercase font-mono"
                />
                {fetchingGST && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Enter GSTIN to auto-fill business name, address, and state
              </p>
            </div>

            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({...form, state: e.target.value})} placeholder="State" />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({...form, pincode: e.target.value})} placeholder="Pincode" maxLength={6} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Customer Type</Label>
              <Select value={form.customer_type} onValueChange={(v) => setForm({...form, customer_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.loyalty_enrolled} onCheckedChange={(c) => setForm({...form, loyalty_enrolled: c})} />
              <Label>Enroll in Loyalty Program</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{editCustomer ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
