import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  BookOpen, Save, X, ChevronDown, Building2, Phone, Mail, 
  MapPin, CreditCard, FileText, Keyboard, Plus
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

// Modern Tally-style Ledger Creation with keyboard shortcuts
export default function TallyLedgerCreation({ onClose, onSuccess, editingLedger = null }) {
  const { api } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    alias: '',
    group_id: '',
    group_name: '',
    // Mailing Details
    mailing_name: '',
    address: '',
    state: '',
    country: 'India',
    pincode: '',
    mobile: '',
    email: '',
    contact_person: '',
    // Banking Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch: '',
    // Tax Registration
    pan_number: '',
    registration_type: 'regular',
    gstin: '',
    // Opening Balance
    opening_balance: '',
    balance_type: 'dr'
  });

  // Indian States
  const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
    'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Jammu & Kashmir', 'Ladakh',
    'Delhi', 'Puducherry', 'Chandigarh'
  ];

  const GST_REGISTRATION_TYPES = [
    { value: 'regular', label: 'Regular' },
    { value: 'composition', label: 'Composition' },
    { value: 'unregistered', label: 'Unregistered' },
    { value: 'consumer', label: 'Consumer' },
    { value: 'overseas', label: 'Overseas' },
    { value: 'sez', label: 'SEZ' }
  ];

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await api('/api/ledger-management/groups');
        setGroups(res.groups || []);
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      }
    };
    fetchGroups();
  }, [api]);

  // Load editing ledger data
  useEffect(() => {
    if (editingLedger) {
      setForm({
        name: editingLedger.name || '',
        alias: editingLedger.alias || '',
        group_id: editingLedger.group_id || '',
        group_name: editingLedger.group_name || '',
        mailing_name: editingLedger.contact_person || '',
        address: editingLedger.address || '',
        state: editingLedger.state || '',
        country: editingLedger.country || 'India',
        pincode: editingLedger.pincode || '',
        mobile: editingLedger.phone || '',
        email: editingLedger.email || '',
        contact_person: editingLedger.contact_person || '',
        bank_name: editingLedger.bank_name || '',
        account_number: editingLedger.account_number || '',
        ifsc_code: editingLedger.ifsc_code || '',
        branch: editingLedger.branch || '',
        pan_number: editingLedger.pan_number || '',
        registration_type: editingLedger.gst_registration_type || 'regular',
        gstin: editingLedger.gstin || '',
        opening_balance: editingLedger.opening_balance?.toString() || '',
        balance_type: editingLedger.opening_balance_type || 'dr'
      });
    }
  }, [editingLedger]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S: Save
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      }
      // Escape: Close
      if (e.key === 'Escape') {
        onClose?.();
      }
      // Alt+1/2/3/4: Switch tabs
      if (e.altKey) {
        switch (e.key) {
          case '1': setActiveTab('basic'); break;
          case '2': setActiveTab('mailing'); break;
          case '3': setActiveTab('banking'); break;
          case '4': setActiveTab('tax'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Ledger Name is required');
      setActiveTab('basic');
      return;
    }
    if (!form.group_id) {
      toast.error('Please select a Group');
      setActiveTab('basic');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        alias: form.alias,
        group_id: form.group_id,
        opening_balance: parseFloat(form.opening_balance) || 0,
        opening_balance_type: form.balance_type,
        contact_person: form.mailing_name || form.contact_person,
        address: form.address,
        city: '',
        state: form.state,
        pincode: form.pincode,
        country: form.country,
        phone: form.mobile,
        email: form.email,
        gstin: form.gstin,
        gst_registration_type: form.registration_type,
        bank_name: form.bank_name,
        account_number: form.account_number,
        ifsc_code: form.ifsc_code,
        branch: form.branch,
        pan_number: form.pan_number,
        notes: '',
        is_active: true
      };

      if (editingLedger) {
        await api(`/api/ledger-management/ledgers/${editingLedger.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('Ledger updated successfully');
      } else {
        await api('/api/ledger-management/ledgers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('Ledger created successfully');
      }
      
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save ledger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            {editingLedger ? 'Edit Ledger' : 'Create New Ledger'}
            <span className="ml-auto text-xs font-normal text-gray-500 flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              Alt+1/2/3/4 to switch tabs | Ctrl+S to save
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Basic (Alt+1)
            </TabsTrigger>
            <TabsTrigger value="mailing" className="text-xs">
              <MapPin className="w-3 h-3 mr-1" />
              Mailing (Alt+2)
            </TabsTrigger>
            <TabsTrigger value="banking" className="text-xs">
              <CreditCard className="w-3 h-3 mr-1" />
              Banking (Alt+3)
            </TabsTrigger>
            <TabsTrigger value="tax" className="text-xs">
              <Building2 className="w-3 h-3 mr-1" />
              Tax (Alt+4)
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Ledger Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter ledger name"
                  autoFocus
                  data-testid="ledger-name"
                />
              </div>
              <div>
                <Label>Alias</Label>
                <Input
                  value={form.alias}
                  onChange={(e) => setForm(prev => ({ ...prev, alias: e.target.value }))}
                  placeholder="Short name or alias"
                />
              </div>
              <div>
                <Label>Under Group *</Label>
                <Select
                  value={form.group_id}
                  onValueChange={(value) => {
                    const group = groups.find(g => g.id === value);
                    setForm(prev => ({ ...prev, group_id: value, group_name: group?.name || '' }));
                  }}
                >
                  <SelectTrigger data-testid="ledger-group">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Opening Balance */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Opening Balance</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={form.opening_balance}
                      onChange={(e) => setForm(prev => ({ ...prev, opening_balance: e.target.value }))}
                      placeholder="0.00"
                      className="text-right font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, balance_type: 'dr' }))}
                      className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                        form.balance_type === 'dr' 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Dr
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, balance_type: 'cr' }))}
                      className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                        form.balance_type === 'cr' 
                          ? 'bg-red-600 text-white border-red-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Cr
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mailing Details Tab */}
          <TabsContent value="mailing" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Mailing Name</Label>
                <Input
                  value={form.mailing_name}
                  onChange={(e) => setForm(prev => ({ ...prev, mailing_name: e.target.value }))}
                  placeholder="Name for correspondence"
                />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address"
                />
              </div>
              <div>
                <Label>State</Label>
                <Select
                  value={form.state}
                  onValueChange={(value) => setForm(prev => ({ ...prev, state: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) => setForm(prev => ({ ...prev, pincode: e.target.value }))}
                  placeholder="PIN code"
                  maxLength={6}
                />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm(prev => ({ ...prev, mobile: e.target.value }))}
                  placeholder="Mobile number"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address"
                />
              </div>
            </div>
          </TabsContent>

          {/* Banking Details Tab */}
          <TabsContent value="banking" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Bank Name</Label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setForm(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="Bank name"
                />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input
                  value={form.account_number}
                  onChange={(e) => setForm(prev => ({ ...prev, account_number: e.target.value }))}
                  placeholder="Account number"
                />
              </div>
              <div>
                <Label>IFSC Code</Label>
                <Input
                  value={form.ifsc_code}
                  onChange={(e) => setForm(prev => ({ ...prev, ifsc_code: e.target.value.toUpperCase() }))}
                  placeholder="IFSC code"
                  maxLength={11}
                />
              </div>
              <div className="col-span-2">
                <Label>Branch</Label>
                <Input
                  value={form.branch}
                  onChange={(e) => setForm(prev => ({ ...prev, branch: e.target.value }))}
                  placeholder="Branch name"
                />
              </div>
            </div>
          </TabsContent>

          {/* Tax Registration Tab */}
          <TabsContent value="tax" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>PAN Number</Label>
                <Input
                  value={form.pan_number}
                  onChange={(e) => setForm(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
                  placeholder="PAN number"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>GST Registration Type</Label>
                <Select
                  value={form.registration_type}
                  onValueChange={(value) => setForm(prev => ({ ...prev, registration_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_REGISTRATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>GSTIN/UIN</Label>
                <Input
                  value={form.gstin}
                  onChange={(e) => setForm(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                  placeholder="GSTIN or UIN number"
                  maxLength={15}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Keyboard Shortcuts Bar */}
        <div className="bg-gray-100 -mx-6 -mb-6 px-6 py-2 mt-4 border-t text-xs text-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Alt+1</kbd> Basic
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Alt+2</kbd> Mailing
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Alt+3</kbd> Banking
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Alt+4</kbd> Tax
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Ctrl+S</kbd> Save
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Esc</kbd> Close
            </span>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onClose?.()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} data-testid="save-ledger-btn">
            <Save className="w-4 h-4 mr-2" />
            {editingLedger ? 'Update Ledger' : 'Create Ledger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
