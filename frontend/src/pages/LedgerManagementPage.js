import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  BookOpen, Plus, Edit2, Trash2, Search, ChevronRight, ChevronDown,
  Building2, Users, Wallet, CreditCard, TrendingUp, TrendingDown,
  FileText, ArrowUpRight, ArrowDownRight, X, Save, RefreshCw,
  FolderTree, Layers, DollarSign, Percent, Phone, Mail, MapPin,
  Building, Globe, CreditCard as CardIcon, Hash, Calendar, Keyboard
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
import TallyLedgerCreation from './TallyLedgerCreation';

// Group type icons and colors
const GROUP_ICONS = {
  asset: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  liability: { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
  income: { icon: ArrowUpRight, color: 'text-blue-600', bg: 'bg-blue-50' },
  expense: { icon: ArrowDownRight, color: 'text-orange-600', bg: 'bg-orange-50' }
};

export default function LedgerManagementPage() {
  const { api } = useAuth();
  const { formatCurrency } = useCurrency();
  
  // State
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [summary, setSummary] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [activeTab, setActiveTab] = useState('groups');
  
  // Dialog states
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [showTallyLedgerDialog, setShowTallyLedgerDialog] = useState(false);
  const [showLedgerDetailDialog, setShowLedgerDetailDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingLedger, setEditingLedger] = useState(null);
  const [ledgerDetail, setLedgerDetail] = useState(null);
  
  // Form states
  const [groupForm, setGroupForm] = useState({
    name: '',
    parent_group_id: '',
    description: '',
    affects_gross_profit: false
  });
  
  const [ledgerForm, setLedgerForm] = useState({
    name: '',
    group_id: '',
    opening_balance: 0,
    opening_balance_type: 'dr',
    contact_person: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    phone: '',
    email: '',
    gstin: '',
    gst_registration_type: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch: '',
    credit_limit: 0,
    credit_days: 0,
    is_active: true,
    pan_number: '',
    notes: ''
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, ledgersRes, summaryRes] = await Promise.all([
        api('/api/ledger-management/groups'),
        api('/api/ledger-management/ledgers?active_only=false'),
        api('/api/ledger-management/summary')
      ]);
      
      setGroups(groupsRes.groups || []);
      setLedgers(ledgersRes.ledgers || []);
      setSummary(summaryRes);
      
      // Auto-expand primary groups
      const expanded = {};
      (groupsRes.groups || []).forEach(g => {
        if (g.primary) expanded[g.id] = true;
      });
      setExpandedGroups(expanded);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keyboard shortcut: Alt+C to create new ledger (Tally style)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setEditingLedger(null);
        setShowTallyLedgerDialog(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build hierarchical group tree
  const buildGroupTree = () => {
    const primaryGroups = groups.filter(g => g.primary);
    
    const getChildren = (parentId) => {
      return groups.filter(g => g.parent_group_id === parentId);
    };
    
    const getLedgersForGroup = (groupId) => {
      return ledgers.filter(l => l.group_id === groupId);
    };
    
    return primaryGroups.map(group => ({
      ...group,
      children: getChildren(group.id),
      ledgers: getLedgersForGroup(group.id),
      allChildren: getAllDescendants(group.id, getChildren)
    }));
  };
  
  const getAllDescendants = (groupId, getChildren) => {
    const children = getChildren(groupId);
    let all = [...children];
    children.forEach(child => {
      all = [...all, ...getAllDescendants(child.id, getChildren)];
    });
    return all;
  };

  // Toggle group expansion
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Handle group form
  const handleGroupSubmit = async () => {
    if (!groupForm.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (!groupForm.parent_group_id) {
      toast.error('Please select a parent group');
      return;
    }
    
    try {
      if (editingGroup) {
        await api(`/api/ledger-management/groups/${editingGroup.id}`, {
          method: 'PUT',
          body: JSON.stringify(groupForm)
        });
        toast.success('Group updated successfully');
      } else {
        await api('/api/ledger-management/groups', {
          method: 'POST',
          body: JSON.stringify(groupForm)
        });
        toast.success('Group created successfully');
      }
      
      setShowGroupDialog(false);
      setEditingGroup(null);
      setGroupForm({ name: '', parent_group_id: '', description: '', affects_gross_profit: false });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save group');
    }
  };

  // Handle ledger form
  const handleLedgerSubmit = async () => {
    if (!ledgerForm.name.trim()) {
      toast.error('Ledger name is required');
      return;
    }
    if (!ledgerForm.group_id) {
      toast.error('Please select a group');
      return;
    }
    
    try {
      if (editingLedger) {
        await api(`/api/ledger-management/ledgers/${editingLedger.id}`, {
          method: 'PUT',
          body: JSON.stringify(ledgerForm)
        });
        toast.success('Ledger updated successfully');
      } else {
        await api('/api/ledger-management/ledgers', {
          method: 'POST',
          body: JSON.stringify(ledgerForm)
        });
        toast.success('Ledger created successfully');
      }
      
      setShowLedgerDialog(false);
      setEditingLedger(null);
      resetLedgerForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save ledger');
    }
  };

  const resetLedgerForm = () => {
    setLedgerForm({
      name: '',
      group_id: selectedGroup?.id || '',
      opening_balance: 0,
      opening_balance_type: 'dr',
      contact_person: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      phone: '',
      email: '',
      gstin: '',
      gst_registration_type: '',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      branch: '',
      credit_limit: 0,
      credit_days: 0,
      is_active: true,
      pan_number: '',
      notes: ''
    });
  };

  // Delete handlers
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    
    try {
      await api(`/api/ledger-management/groups/${groupId}`, { method: 'DELETE' });
      toast.success('Group deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete group');
    }
  };

  const handleDeleteLedger = async (ledgerId) => {
    if (!window.confirm('Are you sure you want to delete this ledger?')) return;
    
    try {
      await api(`/api/ledger-management/ledgers/${ledgerId}`, { method: 'DELETE' });
      toast.success('Ledger deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete ledger');
    }
  };

  // Sync suppliers and customers with ledgers
  const syncLedgers = async () => {
    try {
      toast.loading('Syncing parties with ledgers...');
      const [suppliersResult, customersResult] = await Promise.all([
        api('/api/suppliers/sync-ledgers', { method: 'POST' }),
        api('/api/customers/sync-ledgers', { method: 'POST' })
      ]);
      toast.dismiss();
      
      const totalSynced = 
        (suppliersResult.created_ledgers || 0) + (suppliersResult.linked_existing || 0) +
        (customersResult.created_ledgers || 0) + (customersResult.linked_existing || 0);
      
      if (totalSynced > 0) {
        toast.success(`Synced ${totalSynced} parties! (${suppliersResult.created_ledgers + suppliersResult.linked_existing} suppliers, ${customersResult.created_ledgers + customersResult.linked_existing} customers)`);
        fetchData();
      } else {
        toast.info('All parties are already synced with ledgers');
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err.message || 'Failed to sync ledgers');
    }
  };

  // View ledger detail
  const viewLedgerDetail = async (ledgerId) => {
    try {
      const detail = await api(`/api/ledger-management/ledgers/${ledgerId}`);
      setLedgerDetail(detail);
      setShowLedgerDetailDialog(true);
    } catch (err) {
      toast.error('Failed to load ledger details');
    }
  };

  // Edit ledger
  const openEditLedger = (ledger) => {
    setEditingLedger(ledger);
    setLedgerForm({
      name: ledger.name,
      group_id: ledger.group_id,
      opening_balance: ledger.opening_balance || 0,
      opening_balance_type: ledger.opening_balance_type || 'dr',
      contact_person: ledger.contact_person || '',
      address: ledger.address || '',
      city: ledger.city || '',
      state: ledger.state || '',
      pincode: ledger.pincode || '',
      country: ledger.country || 'India',
      phone: ledger.phone || '',
      email: ledger.email || '',
      gstin: ledger.gstin || '',
      gst_registration_type: ledger.gst_registration_type || '',
      bank_name: ledger.bank_name || '',
      account_number: ledger.account_number || '',
      ifsc_code: ledger.ifsc_code || '',
      branch: ledger.branch || '',
      credit_limit: ledger.credit_limit || 0,
      credit_days: ledger.credit_days || 0,
      is_active: ledger.is_active !== false,
      pan_number: ledger.pan_number || '',
      notes: ledger.notes || ''
    });
    setShowLedgerDialog(true);
  };

  // Filter ledgers by search
  const filteredLedgers = ledgers.filter(l => 
    l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone?.includes(searchTerm) ||
    l.gstin?.includes(searchTerm)
  );

  // Group tree component
  const GroupTreeItem = ({ group, level = 0 }) => {
    const children = groups.filter(g => g.parent_group_id === group.id);
    const groupLedgers = ledgers.filter(l => l.group_id === group.id);
    const isExpanded = expandedGroups[group.id];
    const hasChildren = children.length > 0 || groupLedgers.length > 0;
    const TypeIcon = GROUP_ICONS[group.type]?.icon || BookOpen;
    
    return (
      <div className="select-none">
        <div 
          className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors ${
            selectedGroup?.id === group.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            setSelectedGroup(group);
            if (hasChildren) toggleGroup(group.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )
          ) : (
            <div className="w-4" />
          )}
          
          <div className={`p-1.5 rounded ${GROUP_ICONS[group.type]?.bg || 'bg-gray-100'}`}>
            <TypeIcon className={`w-4 h-4 ${GROUP_ICONS[group.type]?.color || 'text-gray-600'}`} />
          </div>
          
          <span className="flex-1 text-sm font-medium text-gray-700">{group.name}</span>
          
          <Badge variant="outline" className="text-xs">
            {groupLedgers.length}
          </Badge>
          
          {!group.is_predefined && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingGroup(group);
                  setGroupForm({
                    name: group.name,
                    parent_group_id: group.parent_group_id,
                    description: group.description || '',
                    affects_gross_profit: group.affects_gross_profit
                  });
                  setShowGroupDialog(true);
                }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <Edit2 className="w-3 h-3 text-gray-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteGroup(group.id);
                }}
                className="p-1 hover:bg-red-100 rounded"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          )}
        </div>
        
        {isExpanded && (
          <div>
            {children.map(child => (
              <GroupTreeItem key={child.id} group={child} level={level + 1} />
            ))}
            {groupLedgers.map(ledger => (
              <div
                key={ledger.id}
                className="flex items-center gap-2 py-1.5 px-3 hover:bg-gray-50 cursor-pointer text-sm"
                style={{ paddingLeft: `${(level + 1) * 16 + 28}px` }}
                onClick={() => viewLedgerDetail(ledger.id)}
              >
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span className="flex-1 text-gray-600">{ledger.name}</span>
                <span className={`text-xs font-medium ${
                  (ledger.current_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(Math.abs(ledger.current_balance || 0))}
                  {' '}
                  {(ledger.current_balance || 0) >= 0 ? 'Dr' : 'Cr'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const groupTree = buildGroupTree();

  return (
    <div className="p-6 space-y-6" data-testid="ledger-management-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderTree className="w-7 h-7 text-blue-600" />
            Ledger Management
          </h1>
          <p className="text-gray-500 mt-1">Create and manage ledgers under different groups (Tally-style)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} data-testid="refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={syncLedgers}
            className="border-green-500 text-green-700 hover:bg-green-50"
            data-testid="sync-ledgers-btn"
          >
            <Users className="w-4 h-4 mr-2" />
            Sync Parties
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEditingGroup(null);
              setGroupForm({ name: '', parent_group_id: '', description: '', affects_gross_profit: false });
              setShowGroupDialog(true);
            }}
            data-testid="create-group-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Group
          </Button>
          <Button
            onClick={() => {
              setEditingLedger(null);
              setShowTallyLedgerDialog(true);
            }}
            className="bg-blue-700 hover:bg-blue-800"
            data-testid="create-ledger-tally-btn"
          >
            <Keyboard className="w-4 h-4 mr-2" />
            New Ledger (Alt+C)
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Ledgers</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_ledgers || 0}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Assets</p>
                <p className="text-2xl font-bold text-green-600">{summary.by_type?.asset?.count || 0}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Liabilities</p>
                <p className="text-2xl font-bold text-red-600">{summary.by_type?.liability?.count || 0}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Income</p>
                <p className="text-2xl font-bold text-blue-600">{summary.by_type?.income?.count || 0}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
                <p className="text-2xl font-bold text-orange-600">{summary.by_type?.expense?.count || 0}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <ArrowDownRight className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Group Tree */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Groups & Ledgers
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            <div className="space-y-1">
              {groupTree.map(group => (
                <GroupTreeItem key={group.id} group={group} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Ledger List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {selectedGroup ? `Ledgers in ${selectedGroup.name}` : 'All Ledgers'}
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search ledgers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-ledgers"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Ledger Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Group</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Opening Bal</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Current Bal</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedGroup ? filteredLedgers.filter(l => l.group_id === selectedGroup.id) : filteredLedgers).map(ledger => {
                    const group = groups.find(g => g.id === ledger.group_id);
                    return (
                      <tr key={ledger.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{ledger.name}</div>
                          {ledger.gstin && (
                            <div className="text-xs text-gray-500">GSTIN: {ledger.gstin}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {group?.name || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          {formatCurrency(ledger.opening_balance || 0)}
                          <span className="text-gray-500 ml-1">
                            {ledger.opening_balance_type?.toUpperCase() || 'DR'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-mono text-sm font-medium ${
                            (ledger.current_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(Math.abs(ledger.current_balance || 0))}
                            <span className="ml-1">
                              {(ledger.current_balance || 0) >= 0 ? 'Dr' : 'Cr'}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={ledger.is_active ? 'success' : 'secondary'}>
                            {ledger.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewLedgerDetail(ledger.id)}
                              data-testid={`view-ledger-${ledger.id}`}
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingLedger(ledger);
                                setShowTallyLedgerDialog(true);
                              }}
                              data-testid={`edit-ledger-${ledger.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteLedger(ledger.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              data-testid={`delete-ledger-${ledger.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(selectedGroup ? filteredLedgers.filter(l => l.group_id === selectedGroup.id) : filteredLedgers).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No ledgers found. Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Alt+C</kbd> to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Group Name *</label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="Enter group name"
                data-testid="group-name-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Parent Group *</label>
              <Select
                value={groupForm.parent_group_id}
                onValueChange={(val) => setGroupForm({ ...groupForm, parent_group_id: val })}
              >
                <SelectTrigger data-testid="parent-group-select">
                  <SelectValue placeholder="Select parent group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Enter description"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="affects_gp"
                checked={groupForm.affects_gross_profit}
                onChange={(e) => setGroupForm({ ...groupForm, affects_gross_profit: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="affects_gp" className="text-sm text-gray-700">
                Affects Gross Profit
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>Cancel</Button>
            <Button onClick={handleGroupSubmit} data-testid="save-group-btn">
              <Save className="w-4 h-4 mr-2" />
              {editingGroup ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Ledger Dialog */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLedger ? 'Edit Ledger' : 'Create New Ledger'}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="gst">GST Details</TabsTrigger>
              <TabsTrigger value="bank">Bank & Credit</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Ledger Name *</label>
                  <Input
                    value={ledgerForm.name}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, name: e.target.value })}
                    placeholder="Enter ledger name"
                    data-testid="ledger-name-input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Under Group *</label>
                  <Select
                    value={ledgerForm.group_id}
                    onValueChange={(val) => setLedgerForm({ ...ledgerForm, group_id: val })}
                  >
                    <SelectTrigger data-testid="ledger-group-select">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} ({g.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Opening Balance</label>
                  <Input
                    type="number"
                    value={ledgerForm.opening_balance}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, opening_balance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Balance Type</label>
                  <Select
                    value={ledgerForm.opening_balance_type}
                    onValueChange={(val) => setLedgerForm({ ...ledgerForm, opening_balance_type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dr">Debit (Dr)</SelectItem>
                      <SelectItem value="cr">Credit (Cr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <Textarea
                    value={ledgerForm.notes}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={ledgerForm.is_active}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, is_active: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Person</label>
                  <Input
                    value={ledgerForm.contact_person}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, contact_person: e.target.value })}
                    placeholder="Contact person name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <Input
                    value={ledgerForm.phone}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input
                    type="email"
                    value={ledgerForm.email}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, email: e.target.value })}
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">PAN Number</label>
                  <Input
                    value={ledgerForm.pan_number}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, pan_number: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Address</label>
                  <Textarea
                    value={ledgerForm.address}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, address: e.target.value })}
                    placeholder="Street address"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">City</label>
                  <Input
                    value={ledgerForm.city}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">State</label>
                  <Input
                    value={ledgerForm.state}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Pincode</label>
                  <Input
                    value={ledgerForm.pincode}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, pincode: e.target.value })}
                    placeholder="Pincode"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Country</label>
                  <Input
                    value={ledgerForm.country}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, country: e.target.value })}
                    placeholder="Country"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="gst" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">GSTIN</label>
                  <Input
                    value={ledgerForm.gstin}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">GST Registration Type</label>
                  <Select
                    value={ledgerForm.gst_registration_type}
                    onValueChange={(val) => setLedgerForm({ ...ledgerForm, gst_registration_type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="composition">Composition</SelectItem>
                      <SelectItem value="unregistered">Unregistered</SelectItem>
                      <SelectItem value="consumer">Consumer</SelectItem>
                      <SelectItem value="overseas">Overseas</SelectItem>
                      <SelectItem value="sez">SEZ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank Name</label>
                  <Input
                    value={ledgerForm.bank_name}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, bank_name: e.target.value })}
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Account Number</label>
                  <Input
                    value={ledgerForm.account_number}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, account_number: e.target.value })}
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">IFSC Code</label>
                  <Input
                    value={ledgerForm.ifsc_code}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, ifsc_code: e.target.value.toUpperCase() })}
                    placeholder="IFSC code"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Branch</label>
                  <Input
                    value={ledgerForm.branch}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, branch: e.target.value })}
                    placeholder="Branch name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Credit Limit</label>
                  <Input
                    type="number"
                    value={ledgerForm.credit_limit}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, credit_limit: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Credit Days</label>
                  <Input
                    type="number"
                    value={ledgerForm.credit_days}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, credit_days: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLedgerDialog(false)}>Cancel</Button>
            <Button onClick={handleLedgerSubmit} data-testid="save-ledger-btn">
              <Save className="w-4 h-4 mr-2" />
              {editingLedger ? 'Update Ledger' : 'Create Ledger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger Detail Dialog */}
      <Dialog open={showLedgerDetailDialog} onOpenChange={setShowLedgerDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {ledgerDetail?.ledger?.name}
            </DialogTitle>
          </DialogHeader>
          
          {ledgerDetail && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500">Opening Balance</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(ledgerDetail.summary?.opening_balance || 0)}
                      <span className="text-sm ml-1">{ledgerDetail.summary?.opening_balance_type?.toUpperCase()}</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500">Total Debit</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(ledgerDetail.summary?.total_debit || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500">Total Credit</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(ledgerDetail.summary?.total_credit || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-gray-500">Closing Balance</p>
                    <p className={`text-lg font-bold ${
                      ledgerDetail.summary?.closing_balance_type === 'Dr' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(ledgerDetail.summary?.closing_balance || 0)}
                      <span className="text-sm ml-1">{ledgerDetail.summary?.closing_balance_type}</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Ledger Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                {ledgerDetail.ledger?.contact_person && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{ledgerDetail.ledger.contact_person}</span>
                  </div>
                )}
                {ledgerDetail.ledger?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{ledgerDetail.ledger.phone}</span>
                  </div>
                )}
                {ledgerDetail.ledger?.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{ledgerDetail.ledger.email}</span>
                  </div>
                )}
                {ledgerDetail.ledger?.gstin && (
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="w-4 h-4 text-gray-400" />
                    <span>GSTIN: {ledgerDetail.ledger.gstin}</span>
                  </div>
                )}
                {ledgerDetail.ledger?.city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{ledgerDetail.ledger.city}, {ledgerDetail.ledger.state}</span>
                  </div>
                )}
              </div>

              {/* Transactions */}
              <div>
                <h4 className="font-semibold mb-3">Transactions</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 text-sm font-semibold">Date</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">Particulars</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">Voucher</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold">Debit</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerDetail.transactions?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            No transactions yet
                          </td>
                        </tr>
                      ) : (
                        ledgerDetail.transactions?.map(t => (
                          <tr key={t.id} className="border-t hover:bg-gray-50">
                            <td className="py-2 px-3 text-sm">{t.date}</td>
                            <td className="py-2 px-3 text-sm">{t.particulars}</td>
                            <td className="py-2 px-3 text-sm">
                              <Badge variant="outline" className="text-xs">
                                {t.voucher_type} #{t.voucher_number}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-sm text-right font-mono text-green-600">
                              {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-sm text-right font-mono text-red-600">
                              {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLedgerDetailDialog(false)}>Close</Button>
            <Button onClick={() => {
              setShowLedgerDetailDialog(false);
              openEditLedger(ledgerDetail.ledger);
            }}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tally-Style Ledger Creation */}
      {showTallyLedgerDialog && (
        <TallyLedgerCreation
          onClose={() => {
            setShowTallyLedgerDialog(false);
            setEditingLedger(null);
          }}
          onSuccess={() => {
            fetchData();
          }}
          editingLedger={editingLedger}
        />
      )}
    </div>
  );
}
