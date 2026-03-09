import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Plus, Search, Edit, UserCircle, Mail, Building2, Shield, 
  Eye, EyeOff, Power, History, ChevronDown, ChevronUp, Check, X,
  UserPlus, UserMinus, RefreshCw, Key, Copy, Lock, Unlock, KeyRound, Trash2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export default function UserManagementPage() {
  const { api, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [userPassword, setUserPassword] = useState(false);
  const [stores, setStores] = useState([]);
  const [permissionModules, setPermissionModules] = useState({ modules: [], roles: [], default_permissions: {} });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showCreatedCredentials, setShowCreatedCredentials] = useState(false);

  // Fix: Avoid null initial state for modal-bound data to prevent a render pass where
  // the modal briefly mounts with "empty"/fallback UI before data arrives (visual flash).
  // Use a stable default value + explicit loaded flags so UI can render deterministically.
  const [createdUserCredentials, setCreatedUserCredentials] = useState({});
  const [selectedUserCredentials, setSelectedUserCredentials] = useState({});
  const [hasCreatedUserCredentials, setHasCreatedUserCredentials] = useState(false);
  const [hasSelectedUserCredentials, setHasSelectedUserCredentials] = useState(false);

  const [resettingPassword, setResettingPassword] = useState(false);

  // Fix: avoid `null` initial state for modal-bound objects.
  // `null` causes an intermediate render where the modal content briefly renders
  // with fallback/empty UI before the selected user is set (visual flash).
  // Use stable defaults + explicit flags to indicate when data is present.
  const [editUser, setEditUser] = useState({});
  const [auditUser, setAuditUser] = useState({});
  const [hasEditUser, setHasEditUser] = useState(false);
  const [hasAuditUser, setHasAuditUser] = useState(false);

  const [auditData, setAuditData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showPassword, setShowPassword] = useState(false);
  const [expandedPermissions, setExpandedPermissions] = useState({});
  
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'staff',
    store_ids: [],
    permissions: {}
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, storesData, permData] = await Promise.all([
        api('/api/users'),
        api('/api/stores'),
        api('/api/permission-modules')
      ]);
      setUsers(usersData);
      setStores(storesData);
      setPermissionModules(permData);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editUser) {
        const updateData = { 
          name: form.name, 
          role: form.role, 
          store_ids: form.store_ids,
          permissions: form.permissions
        };
        // Include password if it was generated/changed
        if (form.password) {
          updateData.password = form.password;
        }
        await api(`/api/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(updateData) });
        
        // If password was changed, show success with password info
        if (form.password) {
          setCreatedUserCredentials({
            email: editUser.email,
            name: form.name,
            password: form.password,
            role: form.role
          });
          setShowModal(false);
          setShowCreatedCredentials(true);
          toast.success('User updated with new password!');
        } else {
          toast.success('User updated successfully');
          setShowModal(false);
        }
        setEditUser(null);
        resetForm();
        fetchData();
      } else {
        // Create new user - show credentials after creation
        const result = await api('/api/users', { method: 'POST', body: JSON.stringify(form) });
        setCreatedUserCredentials({
          email: result.email,
          name: result.name,
          password: result.plain_password,
          role: result.role
        });
        setShowModal(false);
        setShowCreatedCredentials(true);
        toast.success('User created successfully');
        resetForm();
        fetchData();
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // View user credentials
  const viewCredentials = async (user) => {
    try {
      const creds = await api(`/api/users/${user.id}/credentials`);
      setSelectedUserCredentials(creds);
      setShowCredentialsModal(true);
    } catch (err) {
      toast.error('Failed to load credentials');
    }
  };

  // Reset user password
  const resetUserPassword = async (userId) => {
    if (!confirm('Are you sure you want to reset this user\'s password? A new password will be generated.')) return;
    
    setResettingPassword(true);
    try {
      const result = await api(`/api/users/${userId}/reset-password`, { method: 'POST' });
      setSelectedUserCredentials({
        ...selectedUserCredentials,
        new_password: result.new_password,
        password_reset_at: result.reset_at
      });
      toast.success('Password reset successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete user
  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) return;
    
    try {
      await api(`/api/users/${userId}`, { method: 'DELETE' });
      toast.success('User deleted successfully');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const resetForm = () => {
    setForm({
      email: '',
      password: '',
      name: '',
      role: 'staff',
      store_ids: [],
      permissions: permissionModules.default_permissions?.staff || {}
    });
  };

  const openCreate = () => {
    setEditUser(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    // Ensure all permission keys exist in the form, defaulting to false if not present
    const userPerms = user.permissions || {};
    const allPermKeys = permissionModules.modules?.reduce((acc, mod) => {
      acc[mod.key] = userPerms[mod.key] === true; // Explicitly convert to boolean
      return acc;
    }, {}) || permissionModules.default_permissions?.[user.role] || {};
    
    setForm({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      store_ids: user.store_ids || [],
      permissions: allPermKeys
    });
    setExpandedPermissions({}); // Reset expanded state
    setShowModal(true);
  };

  const toggleUserStatus = async (user) => {
    try {
      const newStatus = !user.is_active;
      await api(`/api/users/${user.id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ is_active: newStatus }) 
      });
      toast.success(newStatus ? 'User activated' : 'User deactivated');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const viewAuditTrail = async (user) => {
    setAuditUser(user);
    try {
      const audits = await api(`/api/users/${user.id}/audit`);
      setAuditData(audits);
      setShowAuditModal(true);
    } catch (err) {
      toast.error('Failed to load audit trail');
    }
  };

  const handleRoleChange = (role) => {
    const defaultPerms = permissionModules.default_permissions?.[role] || {};
    setForm({ ...form, role, permissions: defaultPerms });
  };

  const togglePermission = (key) => {
    setForm({
      ...form,
      permissions: {
        ...form.permissions,
        [key]: !form.permissions[key]
      }
    });
  };

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store?.name || 'Unknown Store';
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || 
                       (filterStatus === 'active' && u.is_active !== false) ||
                       (filterStatus === 'inactive' && u.is_active === false);
    return matchSearch && matchRole && matchStatus;
  });

  const groupedModules = permissionModules.modules.reduce((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod);
    return acc;
  }, {});

  const getAuditActionIcon = (action) => {
    switch (action) {
      case 'user_created': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'user_deactivated': return <UserMinus className="w-4 h-4 text-red-500" />;
      case 'user_reactivated': return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'role_changed': return <Shield className="w-4 h-4 text-purple-500" />;
      case 'permissions_changed': return <Key className="w-4 h-4 text-orange-500" />;
      case 'login': return <Check className="w-4 h-4 text-green-500" />;
      default: return <Edit className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatAuditAction = (action) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'staff': return 'secondary';
      case 'cashier': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6" data-testid="user-management-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage users, roles and permissions</p>
        </div>
        <Button onClick={openCreate} data-testid="add-user-btn">
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="search-users-input"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-40" data-testid="filter-role">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="cashier">Cashier</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40" data-testid="filter-status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => (
            <Card key={u.id} className={`hover:shadow-lg transition-shadow ${u.is_active === false ? 'opacity-60' : ''}`} data-testid={`user-card-${u.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-bold">
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getRoleBadgeVariant(u.role)} className="capitalize">
                      {u.role}
                    </Badge>
                    <Badge variant={u.is_active !== false ? 'default' : 'secondary'}>
                      {u.is_active !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                
                <h3 className="font-bold text-lg">{u.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{u.email}</span>
                </div>
                
                {u.store_ids?.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{u.store_ids.map(id => getStoreName(id)).join(', ')}</span>
                  </div>
                )}

                {u.permissions && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span>{Object.values(u.permissions).filter(Boolean).length} permissions</span>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => viewCredentials(u)} title="View Credentials" data-testid={`creds-user-${u.id}`}>
                    <KeyRound className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => viewAuditTrail(u)} data-testid={`audit-user-${u.id}`}>
                    <History className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant={u.is_active !== false ? "destructive" : "default"}
                    onClick={() => toggleUserStatus(u)}
                    disabled={u.id === currentUser?.id}
                    data-testid={`toggle-user-${u.id}`}
                  >
                    <Power className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="text-destructive hover:bg-red-100"
                    onClick={() => deleteUser(u.id, u.name)}
                    disabled={u.id === currentUser?.id}
                    title="Delete User"
                    data-testid={`delete-user-${u.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit User Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Create New User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input 
                      value={form.name} 
                      onChange={(e) => setForm({...form, name: e.target.value})} 
                      required 
                      data-testid="user-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input 
                      type="email" 
                      value={form.email} 
                      onChange={(e) => setForm({...form, email: e.target.value})} 
                      required 
                      disabled={!!editUser}
                      data-testid="user-email-input"
                    />
                  </div>
                  {/* Password Section - Show for new user or edit user - Updated Feb 8 2026 */}
                  <div className="space-y-2 sm:col-span-2" data-section="password-reset">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      {editUser ? 'Reset Password' : 'Password *'}
                    </Label>
                    {editUser ? (
                      <div className="space-y-3 border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                        {form.password ? (
                          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <Key className="w-3 h-3" />
                              New Password (copy now - save to apply!)
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-lg text-green-700 dark:text-green-400">
                                {form.password}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(form.password, 'Password')}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Click "Generate Password" to create a new password for this user
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
                            let password = '';
                            for (let i = 0; i < 12; i++) {
                              password += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            setForm({...form, password});
                            setShowPassword(true);
                            toast.success('New password generated! Click "Update User" to save.');
                          }}
                          className="w-full"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Generate New Password
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input 
                              type={showPassword ? "text" : "password"}
                              value={form.password} 
                              onChange={(e) => setForm({...form, password: e.target.value})} 
                              required={!editUser}
                              placeholder="Enter password or generate"
                              data-testid="user-password-input"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
                              let password = '';
                              for (let i = 0; i < 12; i++) {
                                password += chars.charAt(Math.floor(Math.random() * chars.length));
                              }
                              setForm({...form, password});
                              setShowPassword(true);
                              toast.success('Password generated!');
                            }}
                            title="Generate Password"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                        {form.password && showPassword && (
                          <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/30 rounded">
                            <span className="font-mono text-sm">{form.password}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(form.password, 'Password')}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={form.role} onValueChange={handleRoleChange}>
                      <SelectTrigger data-testid="user-role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Assigned Stores</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[44px] bg-slate-50 dark:bg-slate-900">
                      {stores.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No stores available</p>
                      ) : (
                        stores.map(store => (
                          <Badge
                            key={store.id}
                            variant={form.store_ids.includes(store.id) ? "default" : "outline"}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              const newStoreIds = form.store_ids.includes(store.id)
                                ? form.store_ids.filter(id => id !== store.id)
                                : [...form.store_ids, store.id];
                              setForm({ ...form, store_ids: newStoreIds });
                            }}
                          >
                            {store.name}
                          </Badge>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      👆 Click on store names above to toggle assignment
                    </p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="permissions" className="space-y-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    Customize access permissions for this user. Toggle individual modules on/off.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const allEnabled = permissionModules.modules?.reduce((acc, mod) => {
                          acc[mod.key] = true;
                          return acc;
                        }, {}) || {};
                        setForm({ ...form, permissions: allEnabled });
                        toast.success('All permissions granted');
                      }}
                    >
                      Grant All
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const allDisabled = permissionModules.modules?.reduce((acc, mod) => {
                          acc[mod.key] = false;
                          return acc;
                        }, {}) || {};
                        setForm({ ...form, permissions: allDisabled });
                        toast.success('All permissions revoked');
                      }}
                    >
                      Revoke All
                    </Button>
                  </div>
                </div>
                
                {/* Permission Summary */}
                <div className="p-3 bg-accent/50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-medium">
                      {Object.values(form.permissions).filter(Boolean).length} of {permissionModules.modules?.length || 0} permissions granted
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      ✓ {Object.values(form.permissions).filter(Boolean).length} Granted
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                      ✗ {Object.values(form.permissions).filter(v => v === false).length} Denied
                    </span>
                  </div>
                </div>
                
                {Object.entries(groupedModules).map(([category, modules]) => (
                  <Card key={category} className="overflow-hidden">
                    <CardHeader 
                      className="cursor-pointer py-3 bg-accent/30"
                      onClick={() => setExpandedPermissions({
                        ...expandedPermissions,
                        [category]: expandedPermissions[category] === false ? true : expandedPermissions[category] === true ? false : false
                      })}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">{category}</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            {modules.filter(m => form.permissions[m.key] === true).length}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            {modules.filter(m => form.permissions[m.key] !== true).length}
                          </span>
                          {expandedPermissions[category] === false ? 
                            <ChevronDown className="w-4 h-4" /> : 
                            <ChevronUp className="w-4 h-4" />
                          }
                        </div>
                      </div>
                    </CardHeader>
                    {expandedPermissions[category] !== false && (
                      <CardContent className="pt-3">
                        <div className="grid sm:grid-cols-2 gap-2">
                          {modules.map(mod => (
                            <div 
                              key={mod.key} 
                              className={`flex items-center justify-between p-2 rounded-md border transition-colors ${
                                form.permissions[mod.key] === true 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              }`}
                            >
                              <Label htmlFor={`perm-${mod.key}`} className="cursor-pointer flex-1 flex items-center gap-2">
                                {form.permissions[mod.key] === true ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <X className="w-4 h-4 text-red-600" />
                                )}
                                <span className={form.permissions[mod.key] === true ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                                  {mod.label}
                                </span>
                              </Label>
                              <Switch
                                id={`perm-${mod.key}`}
                                checked={form.permissions[mod.key] === true}
                                onCheckedChange={() => togglePermission(mod.key)}
                                data-testid={`perm-toggle-${mod.key}`}
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </TabsContent>
            </Tabs>

            <div className="flex justify-between items-center pt-6 border-t mt-6">
              {/* Reset Password button - only show when editing */}
              {editUser && (
                <Button 
                  type="button" 
                  variant="outline"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
                    let password = '';
                    for (let i = 0; i < 12; i++) {
                      password += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    setForm({...form, password});
                    toast.success('New password generated! Click "Update User" to save.');
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Password
                </Button>
              )}
              {!editUser && <div></div>}
              
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="save-user-btn">
                  {editUser ? 'Update User' : 'Create User'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Modal */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Trail - {auditUser?.name}</DialogTitle>
          </DialogHeader>
          
          {auditData.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No audit records found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditData.map((audit, idx) => (
                <div 
                  key={audit.id || idx} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="mt-1">
                    {getAuditActionIcon(audit.action)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatAuditAction(audit.action)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(audit.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      By: {audit.performed_by_name || 'System'}
                    </p>
                    {audit.details && Object.keys(audit.details).length > 0 && (
                      <div className="mt-2 text-xs bg-muted p-2 rounded">
                        {Object.entries(audit.details).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Credentials Modal */}
      <Dialog open={showCredentialsModal} onOpenChange={setShowCredentialsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              User Credentials
            </DialogTitle>
          </DialogHeader>
          
          {selectedUserCredentials && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <div className="flex items-center justify-between p-2 bg-accent rounded">
                      <span className="font-medium">{selectedUserCredentials.name}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Email / User ID</Label>
                    <div className="flex items-center justify-between p-2 bg-accent rounded">
                      <span className="font-mono text-sm">{selectedUserCredentials.email}</span>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(selectedUserCredentials.email, 'Email')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <div className="flex items-center justify-between p-2 bg-accent rounded">
                      <Badge variant="outline" className="capitalize">{selectedUserCredentials.role}</Badge>
                    </div>
                  </div>
                  
                  {selectedUserCredentials.password_reset_at && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Last Password Reset</Label>
                      <div className="p-2 bg-accent rounded text-sm">
                        {new Date(selectedUserCredentials.password_reset_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                  
                  {selectedUserCredentials.new_password && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        New Password (copy now - won't be shown again!)
                      </Label>
                      <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded">
                        <span className="font-mono font-bold text-green-700 dark:text-green-400">
                          {selectedUserCredentials.new_password}
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-green-700 dark:text-green-400"
                          onClick={() => copyToClipboard(selectedUserCredentials.new_password, 'Password')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => resetUserPassword(selectedUserCredentials.user_id)}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset Password
                    </>
                  )}
                </Button>
                <Button onClick={() => setShowCredentialsModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Created User Credentials Modal (shown after creating new user) */}
      <Dialog open={showCreatedCredentials} onOpenChange={setShowCreatedCredentials}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              User Created Successfully!
            </DialogTitle>
          </DialogHeader>
          
          {createdUserCredentials && (
            <div className="space-y-4">
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Save these credentials now. The password won't be shown again!
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <div className="p-2 bg-white dark:bg-gray-800 rounded font-medium">
                        {createdUserCredentials.name}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email / User ID</Label>
                      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded">
                        <span className="font-mono">{createdUserCredentials.email}</span>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => copyToClipboard(createdUserCredentials.email, 'Email')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        Password
                      </Label>
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-2 border-green-400 rounded">
                        <span className="font-mono font-bold text-lg">
                          {createdUserCredentials.password}
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => copyToClipboard(createdUserCredentials.password, 'Password')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Role</Label>
                      <div className="p-2 bg-white dark:bg-gray-800 rounded">
                        <Badge variant="outline" className="capitalize">{createdUserCredentials.role}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Button 
                className="w-full" 
                onClick={() => {
                  setShowCreatedCredentials(false);
                  setCreatedUserCredentials(null);
                }}
              >
                I've Saved the Credentials
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
