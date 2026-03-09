import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Plus, Tags, Palette, Settings as SettingsIcon, Save, Trash2, DollarSign, MapPin, Shield, Wifi, WifiOff, Database, RefreshCw, Download, Globe, Languages, Fingerprint, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useCurrency, CURRENCIES, CurrencySelector } from '../contexts/CurrencyContext';
import { useLocationSecurity } from '../contexts/LocationSecurityContext';
import { useOffline } from '../contexts/OfflineContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function SettingsPage() {
  const { api, user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [item, setItem] = useState(false);
  const [language, setLanguage] = useState(false);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [brandForm, setBrandForm] = useState({ name: '', description: '' });

  const fetchData = async () => {
    try {
      const [catsData, brandsData] = await Promise.all([
        api('/api/categories'),
        api('/api/brands'),
      ]);
      setCategories(catsData);
      setBrands(brandsData);
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const createCategory = async (e) => {
    e.preventDefault();
    try {
      await api('/api/categories', { method: 'POST', body: JSON.stringify(catForm) });
      toast.success('Category created');
      setShowCatModal(false);
      setCatForm({ name: '', description: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const createBrand = async (e) => {
    e.preventDefault();
    try {
      await api('/api/brands', { method: 'POST', body: JSON.stringify(brandForm) });
      toast.success('Brand created');
      setShowBrandModal(false);
      setBrandForm({ name: '', description: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteBrand = async (id) => {
    if (!window.confirm('Delete this brand?')) return;
    try {
      await api(`/api/brands/${id}`, { method: 'DELETE' });
      toast.success('Brand deleted');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      <Tabs defaultValue="categories">
        <TabsList className="flex-wrap">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="language">Language</TabsTrigger>
          <TabsTrigger value="offline">Offline</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Tags className="w-5 h-5" /> Categories
              </CardTitle>
              <Button onClick={() => setShowCatModal(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No categories found</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCategory(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" /> Brands
              </CardTitle>
              <Button onClick={() => setShowBrandModal(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {brands.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No brands found</p>
              ) : (
                <div className="space-y-2">
                  {brands.map((brand) => (
                    <div key={brand.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                      <div>
                        <p className="font-medium">{brand.name}</p>
                        {brand.description && <p className="text-sm text-muted-foreground">{brand.description}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteBrand(brand.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency" className="mt-6">
          <CurrencySettingsTab />
        </TabsContent>

        <TabsContent value="language" className="mt-6">
          <LanguageSettingsTab />
        </TabsContent>

        <TabsContent value="offline" className="mt-6">
          <OfflineSettingsTab />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <div className="space-y-6">
            <PinSecuritySettingsTab />
            <LocationSecuritySettingsTab />
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 max-w-md">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={user?.name || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={user?.role || ''} disabled className="capitalize" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Modal */}
      <Dialog open={showCatModal} onOpenChange={setShowCatModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={createCategory} className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({...catForm, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm({...catForm, description: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCatModal(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Brand Modal */}
      <Dialog open={showBrandModal} onOpenChange={setShowBrandModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Brand</DialogTitle>
          </DialogHeader>
          <form onSubmit={createBrand} className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Name *</Label>
              <Input value={brandForm.name} onChange={(e) => setBrandForm({...brandForm, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={brandForm.description} onChange={(e) => setBrandForm({...brandForm, description: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBrandModal(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Language Settings Tab Component
function LanguageSettingsTab() {
  const { language, setLanguage, availableLanguages, t } = useLanguage();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="w-5 h-5" /> Language Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-md">
          <Label className="mb-3 block">Select Language / भाषा चुनें</Label>
          <div className="grid grid-cols-2 gap-3">
            {availableLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  toast.success(lang.code === 'hi' ? 'भाषा बदल दी गई' : 'Language changed');
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  language === lang.code 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Globe className={`w-6 h-6 ${language === lang.code ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">{lang.nativeName}</p>
                    <p className="text-sm text-muted-foreground">{lang.name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-4 bg-accent/50 rounded-lg">
          <p className="text-sm font-medium mb-2">
            {language === 'hi' ? 'वर्तमान भाषा' : 'Current Language'}: {availableLanguages.find(l => l.code === language)?.nativeName}
          </p>
          <p className="text-xs text-muted-foreground">
            {language === 'hi' 
              ? 'भाषा बदलने से सभी मेनू और बटन की भाषा बदल जाएगी।'
              : 'Changing the language will update all menus and buttons throughout the application.'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Offline Settings Tab Component
function OfflineSettingsTab() {
  const { 
    isOnline, 
    pendingSalesCount, 
    isSyncing, 
    lastSyncTime, 
    cacheDataForOffline, 
    forceSync, 
    clearOfflineData,
    getPendingSales 
  } = useOffline();
  
  const [pendingSales, setPendingSales] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPendingSales = async () => {
    setLoading(true);
    try {
      const sales = await getPendingSales();
      setPendingSales(sales);
    } catch (err) {
      console.error('Failed to load pending sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingSales();
  }, [pendingSalesCount]);

  const handleCacheData = async () => {
    try {
      await cacheDataForOffline();
      loadPendingSales();
    } catch (err) {
      // Error handled in cacheDataForOffline
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-lg font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </p>
              {lastSyncTime && (
                <p className="text-sm text-muted-foreground">
                  Last sync: {new Date(lastSyncTime).toLocaleString()}
                </p>
              )}
            </div>
            <div className={`w-4 h-4 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          </div>
        </CardContent>
      </Card>

      {/* Cache Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" /> Offline Data Cache
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cache product data to enable POS operations when offline. This stores items, variants, customers, and stores locally.
          </p>
          
          <div className="flex gap-3">
            <Button onClick={handleCacheData} disabled={!isOnline || isSyncing} className="gap-2">
              <Download className="w-4 h-4" />
              Cache Data for Offline
            </Button>
            <Button variant="destructive" onClick={clearOfflineData} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Clear Cached Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} /> 
            Pending Sales ({pendingSalesCount})
          </CardTitle>
          <Button 
            variant="outline" 
            onClick={forceSync} 
            disabled={!isOnline || isSyncing || pendingSalesCount === 0}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pendingSales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending sales to sync
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingSales.map((sale, idx) => (
                <div 
                  key={sale.id || idx}
                  className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-900/20"
                >
                  <div>
                    <p className="font-medium text-sm">{sale.offline_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.customer_name || 'Walk-in'} • {currencySymbol}{sale.total_amount?.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.created_offline_at).toLocaleString()}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    sale.synced 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {sale.synced ? 'Synced' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>How Offline Mode Works:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Cache data when online to enable offline POS</li>
              <li>Sales made offline are saved locally with unique IDs</li>
              <li>When back online, pending sales auto-sync to server</li>
              <li>Inventory levels may not reflect offline sales until synced</li>
              <li>Some features (vouchers, loyalty points) are limited offline</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Currency Settings Tab Component
function CurrencySettingsTab() {
  const { 
    baseCurrency, setBaseCurrency, 
    displayCurrency, setDisplayCurrency,
    formatCurrency, exchangeRates, currencySymbol 
  } = useCurrency();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Currency Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <CurrencySelector
              value={baseCurrency}
              onChange={setBaseCurrency}
              label="Base Currency (for storing prices)"
            />
            <p className="text-xs text-muted-foreground">
              This is the currency used to store all prices in the database. Changing this will not convert existing prices.
            </p>
          </div>
          <div className="space-y-4">
            <CurrencySelector
              value={displayCurrency}
              onChange={setDisplayCurrency}
              label="Display Currency"
            />
            <p className="text-xs text-muted-foreground">
              Prices will be converted and displayed in this currency throughout the app.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-accent rounded-lg">
          <h4 className="font-medium mb-3">Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Sample Price (1000 INR)</p>
              <p className="font-semibold text-lg">{formatCurrency(1000 / (exchangeRates[baseCurrency] || 1))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sample Price (5000 INR)</p>
              <p className="font-semibold text-lg">{formatCurrency(5000 / (exchangeRates[baseCurrency] || 1))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sample Price (10000 INR)</p>
              <p className="font-semibold text-lg">{formatCurrency(10000 / (exchangeRates[baseCurrency] || 1))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sample Price (50000 INR)</p>
              <p className="font-semibold text-lg">{formatCurrency(50000 / (exchangeRates[baseCurrency] || 1))}</p>
            </div>
          </div>
        </div>

        {/* Exchange Rates Info */}
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-2">Current Exchange Rates (Base: INR)</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(CURRENCIES).slice(0, 12).map(([code, currency]) => (
              <div key={code} className="p-2 bg-background rounded border text-center">
                <span className="font-medium">{currency.symbol}</span>
                <span className="text-xs block">{code}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// PIN Security Settings Tab Component
function PinSecuritySettingsTab() {
  const { api } = useAuth();
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinForm, setPinForm] = useState({ pin: '', confirm_pin: '' });
  const [settingPin, setSettingPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const status = await api('/api/auth/security-status');
      setHasPin(status.has_pin);
    } catch (err) {
      console.error('Failed to check PIN status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPin = async () => {
    if (pinForm.pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    if (pinForm.pin !== pinForm.confirm_pin) {
      toast.error('PINs do not match');
      return;
    }
    
    setSettingPin(true);
    try {
      await api('/api/auth/setup-pin', {
        method: 'POST',
        body: JSON.stringify({
          pin: pinForm.pin,
          confirm_pin: pinForm.confirm_pin
        })
      });
      toast.success('Security PIN set successfully!');
      setHasPin(true);
      setShowSetup(false);
      setShowChangePin(false);
      setPinForm({ pin: '', confirm_pin: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to set PIN');
    } finally {
      setSettingPin(false);
    }
  };

  const resetForm = () => {
    setShowSetup(false);
    setShowChangePin(false);
    setPinForm({ pin: '', confirm_pin: '' });
    setShowPin(false);
    setShowConfirmPin(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="pin-security-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> Quick Authentication PIN
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Fingerprint className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">4-Digit Security PIN</p>
              <p className="text-sm text-muted-foreground">
                {hasPin 
                  ? 'Use your PIN for quick re-authentication instead of password' 
                  : 'Set up a PIN for faster verification during sensitive actions'}
              </p>
            </div>
          </div>
          {hasPin ? (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
              <ShieldCheck className="w-3 h-3 mr-1" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Not Set
            </Badge>
          )}
        </div>

        {/* Setup or Change PIN Form */}
        {(showSetup || showChangePin) ? (
          <div className="p-4 border rounded-lg space-y-4 bg-card">
            <p className="font-medium text-sm">
              {hasPin ? 'Change Your PIN' : 'Create Your PIN'}
            </p>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Enter 4-Digit PIN</Label>
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    value={pinForm.pin}
                    onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="• • • •"
                    maxLength={4}
                    className="text-center tracking-[0.5em] text-xl font-mono pr-10"
                    data-testid="settings-pin-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm PIN</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPin ? "text" : "password"}
                    value={pinForm.confirm_pin}
                    onChange={(e) => setPinForm({ ...pinForm, confirm_pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="• • • •"
                    maxLength={4}
                    className="text-center tracking-[0.5em] text-xl font-mono pr-10"
                    data-testid="settings-confirm-pin-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={resetForm}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSetupPin}
                disabled={settingPin || pinForm.pin.length !== 4}
                className="flex-1"
                data-testid="settings-save-pin-btn"
              >
                {settingPin ? 'Saving...' : hasPin ? 'Update PIN' : 'Save PIN'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {hasPin ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setShowChangePin(true)}
                  className="flex-1"
                  data-testid="change-pin-btn"
                >
                  <KeyRound className="w-4 h-4 mr-2" /> Change PIN
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowChangePin(true)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid="reset-pin-btn"
                >
                  Reset PIN
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setShowSetup(true)}
                className="flex-1"
                data-testid="setup-pin-btn"
              >
                <Fingerprint className="w-4 h-4 mr-2" /> Set Up PIN
              </Button>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="font-medium text-blue-800 mb-1">Why use a PIN?</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Faster re-authentication during sensitive actions</li>
            <li>No need to type your full password every time</li>
            <li>Secure 4-digit verification for quick access</li>
          </ul>
        </div>
        
        {hasPin && (
          <p className="text-xs text-center text-muted-foreground">
            Forgot your PIN? Click "Reset PIN" to set a new one using your password.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Location Security Settings Tab Component
function LocationSecuritySettingsTab() {
  const {  
    storeLocation, 
    currentLocation, 
    isOutsideStore,
    locationError,
    locationEnabled,
    setLocationEnabled,
    getCurrentLocation,
    setAsStoreLocation,
    securityAlerts,
    clearAlerts,
    MAX_DISTANCE_KM
  } = useLocationSecurity();
  
  const [maxDistance, setMaxDistance] = useState(localStorage.getItem('maxStoreDistance') || '0.5');

  const saveMaxDistance = () => {
    localStorage.setItem('maxStoreDistance', maxDistance);
    toast.success('Distance limit saved! Refresh page to apply.');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Store Location Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Location Status */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Location Tracking</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationEnabled}
                    onChange={(e) => setLocationEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">{locationEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>
              
              <div className="p-4 bg-accent rounded-lg space-y-2">
                <p className="text-sm font-medium">Current Location</p>
                {locationError ? (
                  <p className="text-sm text-red-500">{locationError}</p>
                ) : currentLocation ? (
                  <div className="text-sm text-muted-foreground">
                    <p>Lat: {currentLocation.latitude.toFixed(6)}</p>
                    <p>Long: {currentLocation.longitude.toFixed(6)}</p>
                    <p className="text-xs mt-1">Last updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Fetching location...</p>
                )}
                <Button size="sm" variant="outline" onClick={getCurrentLocation} className="mt-2">
                  <MapPin className="w-3 h-3 mr-1" /> Refresh Location
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg space-y-2">
                <p className="text-sm font-medium">Store Location</p>
                {storeLocation ? (
                  <div className="text-sm text-muted-foreground">
                    <p>Lat: {storeLocation.latitude.toFixed(6)}</p>
                    <p>Long: {storeLocation.longitude.toFixed(6)}</p>
                    <p className="text-xs mt-1">Set on: {new Date(storeLocation.setAt).toLocaleDateString()}</p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-600">Store location not set</p>
                )}
                <Button 
                  size="sm" 
                  onClick={setAsStoreLocation}
                  disabled={!currentLocation}
                  className="mt-2"
                >
                  <MapPin className="w-3 h-3 mr-1" /> Set Current as Store Location
                </Button>
              </div>
              
              {/* Status Badge */}
              <div className={`p-4 rounded-lg ${
                isOutsideStore 
                  ? 'bg-red-50 border border-red-200' 
                  : storeLocation 
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Shield className={`w-5 h-5 ${
                    isOutsideStore ? 'text-red-500' : storeLocation ? 'text-green-500' : 'text-gray-400'
                  }`} />
                  <span className={`font-medium ${
                    isOutsideStore ? 'text-red-700' : storeLocation ? 'text-green-700' : 'text-gray-600'
                  }`}>
                    {isOutsideStore 
                      ? 'Outside Store Zone - Security Alert Active' 
                      : storeLocation 
                        ? 'Within Store Zone - Secure' 
                        : 'Store Location Not Configured'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Distance Settings */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Max Allowed Distance from Store (km)</Label>
            <div className="flex gap-2 mt-2 max-w-xs">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={maxDistance}
                onChange={(e) => setMaxDistance(e.target.value)}
              />
              <Button onClick={saveMaxDistance}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Security alerts will trigger when app is accessed beyond this distance
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Security Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" /> Location Security Alerts
          </CardTitle>
          {securityAlerts.length > 0 && (
            <Button size="sm" variant="outline" onClick={clearAlerts}>
              Clear All
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {securityAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No security alerts
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {securityAlerts.slice(0, 10).map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-3 rounded-lg flex items-start gap-3 ${
                    alert.severity === 'high' 
                      ? 'bg-red-50 border border-red-200' 
                      : 'bg-amber-50 border border-amber-200'
                  }`}
                >
                  <span className="text-lg">{alert.severity === 'high' ? '🚨' : '⚠️'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {alert.acknowledged && (
                    <span className="text-xs text-green-600">Acknowledged</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
