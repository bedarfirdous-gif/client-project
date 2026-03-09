import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Gift, Star, Crown, Award, Users, Settings, TrendingUp, 
  Coins, Trophy, ChevronRight, Save, Search, RefreshCw,
  Sparkles, Zap, Heart, Diamond, Check, ArrowRight, Download, Share2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';
import MembershipCardButton, { MembershipCardPreview } from '../components/MembershipCardButton';

// Pamphlet-style tier configurations with rich gradients
const TIER_CONFIG = {
  bronze: {
    icon: Award,
    gradient: 'from-amber-600 via-orange-500 to-amber-700',
    bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40',
    borderColor: 'border-amber-400',
    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    ribbon: 'bg-amber-500',
    pattern: 'radial-gradient(circle at 20% 80%, rgba(245,158,11,0.1) 0%, transparent 50%)',
    highlight: 'text-amber-600 dark:text-amber-400'
  },
  silver: {
    icon: Star,
    gradient: 'from-slate-400 via-gray-300 to-slate-500',
    bgGradient: 'from-slate-50 to-gray-100 dark:from-slate-900/40 dark:to-gray-900/40',
    borderColor: 'border-slate-400',
    iconBg: 'bg-gradient-to-br from-slate-300 to-gray-400',
    ribbon: 'bg-slate-500',
    pattern: 'radial-gradient(circle at 80% 20%, rgba(148,163,184,0.15) 0%, transparent 50%)',
    highlight: 'text-slate-600 dark:text-slate-300'
  },
  gold: {
    icon: Crown,
    gradient: 'from-yellow-400 via-amber-400 to-yellow-500',
    bgGradient: 'from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/40',
    borderColor: 'border-yellow-400',
    iconBg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    ribbon: 'bg-yellow-500',
    pattern: 'radial-gradient(circle at 50% 0%, rgba(250,204,21,0.15) 0%, transparent 50%)',
    highlight: 'text-yellow-600 dark:text-yellow-400'
  },
  platinum: {
    icon: Diamond,
    gradient: 'from-violet-500 via-purple-500 to-indigo-600',
    bgGradient: 'from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40',
    borderColor: 'border-violet-400',
    iconBg: 'bg-gradient-to-br from-violet-400 to-purple-600',
    ribbon: 'bg-violet-600',
    pattern: 'radial-gradient(circle at 80% 80%, rgba(139,92,246,0.15) 0%, transparent 50%)',
    highlight: 'text-violet-600 dark:text-violet-400'
  }
};

// Pamphlet Tier Card Component
const PamphletTierCard = ({ tierName, tierData, isPopular = false }) => {
  const config = TIER_CONFIG[tierName] || TIER_CONFIG.bronze;
  const Icon = config.icon;
  
  return (
    <div className="relative group">
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 shadow-lg px-3 py-1">
            <Sparkles className="w-3 h-3 mr-1" /> Most Popular
          </Badge>
        </div>
      )}
      
      {/* Main Card */}
      <div 
        className={`relative overflow-hidden rounded-2xl border-2 ${config.borderColor} bg-gradient-to-br ${config.bgGradient} transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl`}
        style={{ backgroundImage: config.pattern }}
      >
        {/* Decorative Corner Ribbon */}
        <div className={`absolute top-0 right-0 w-20 h-20 ${config.ribbon} transform rotate-45 translate-x-8 -translate-y-8 opacity-20`} />
        
        {/* Header Section */}
        <div className="p-6 pb-4 text-center relative">
          {/* Icon Circle */}
          <div className={`w-20 h-20 mx-auto rounded-full ${config.iconBg} flex items-center justify-center shadow-xl mb-4 ring-4 ring-white/50 dark:ring-white/20`}>
            <Icon className="w-10 h-10 text-white drop-shadow-md" />
          </div>
          
          {/* Tier Name */}
          <h3 className={`text-2xl font-bold capitalize ${config.highlight} tracking-wide`}>
            {tierName}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Membership Tier</p>
          
          {/* Points Required Badge */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-white/50">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-semibold">{tierData.min_points?.toLocaleString()}+ points</span>
          </div>
        </div>
        
        {/* Divider with Pattern */}
        <div className="relative h-8 overflow-hidden">
          <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
            <path d="M0,10 Q25,0 50,10 T100,10 L100,20 L0,20 Z" fill="currentColor" className="text-white/80 dark:text-black/20" />
          </svg>
        </div>
        
        {/* Benefits Section */}
        <div className="px-6 pb-6 pt-2 bg-white/40 dark:bg-black/10">
          {/* Multiplier Highlight */}
          <div className="text-center mb-4 p-3 rounded-xl bg-gradient-to-r from-white/60 to-white/40 dark:from-white/10 dark:to-white/5 border border-white/50">
            <div className="flex items-center justify-center gap-2">
              <Zap className={`w-5 h-5 ${config.highlight}`} />
              <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${config.gradient}">
                {tierData.multiplier}x
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Points Multiplier</p>
          </div>
          
          {/* Benefits List */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Heart className="w-3 h-3" /> Benefits Included
            </p>
            <ul className="space-y-2">
              {tierData.benefits?.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <div className={`w-5 h-5 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-foreground/80">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* CTA Button */}
          <div className="mt-4 pt-4 border-t border-white/50 dark:border-white/10">
            <Button 
              variant="ghost" 
              className={`w-full justify-center gap-2 ${config.highlight} hover:bg-white/50 dark:hover:bg-white/10`}
            >
              Learn More <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function LoyaltyProgramPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();

  // Fix: Avoid null initial state to prevent a "null -> data" first paint flash.
  // Use stable initial values + explicit loaded flags so UI can render consistently.
  const [settings, setSettings] = useState({});
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fix: Use a stable "no selection" shape instead of null to avoid conditional UI flashing.
  const [selectedCustomer, setSelectedCustomer] = useState({});
  const [isSelectedCustomerLoaded, setIsSelectedCustomerLoaded] = useState(false);

  // Fix: Avoid `null` initial state to prevent a "null -> data" render flash.
  // Use a stable default value and a dedicated loaded flag to control UI rendering.
  const [customerLoyalty, setCustomerLoyalty] = useState({});
  const [isCustomerLoyaltyLoaded, setIsCustomerLoyaltyLoaded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsData, leaderboardData, customersData] = await Promise.all([
        api('/api/loyalty/settings'),
        api('/api/loyalty/leaderboard'),
        api('/api/customers')
      ]);
      setSettings(settingsData);
      setSettingsForm(settingsData);
      setLeaderboard(leaderboardData);
      setCustomers(customersData);
    } catch (err) {
      toast.error('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const saveSettings = async () => {
    try {
      await api('/api/loyalty/settings', { method: 'PUT', body: JSON.stringify(settingsForm) });
      toast.success('Loyalty settings saved');
      setSettings(settingsForm);
      setShowSettingsModal(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const viewCustomerLoyalty = async (customer) => {
    setSelectedCustomer(customer);
    try {
      const data = await api(`/api/loyalty/customer/${customer.id}`);
      setCustomerLoyalty(data);
    } catch (err) {
      toast.error('Failed to load customer loyalty');
    }
  };

  const getTierIcon = (tier) => {
    const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
    const Icon = config.icon;
    return <Icon className="w-5 h-5" />;
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="loyalty-program-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            {t('loyaltyProgram') || 'Loyalty Program'}
          </h1>
          <p className="text-muted-foreground">{t('loyaltyDescription') || 'Reward your customers and build loyalty'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> {t('refresh') || 'Refresh'}
          </Button>
          <Button onClick={() => setShowSettingsModal(true)}>
            <Settings className="w-4 h-4 mr-2" /> {t('settings') || 'Settings'}
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={settings?.is_active ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' : 'border-red-500 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20'}>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${settings?.is_active ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-red-400 to-rose-500'} shadow-lg`}>
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-lg">{settings?.is_active ? (t('programActive') || 'Program Active') : (t('programInactive') || 'Program Inactive')}</p>
              <p className="text-sm text-muted-foreground">
                {settings?.is_active 
                  ? `${t('earning') || 'Earning'} ${settings.points_per_rupee} ${t('pointPer100') || 'point per ₹100 spent'}` 
                  : t('enableInSettings') || 'Enable the program in settings'}
              </p>
            </div>
          </div>
          <Badge variant={settings?.is_active ? 'default' : 'destructive'} className="text-sm px-4 py-1">
            {settings?.is_active ? (t('active') || 'ACTIVE') : (t('inactive') || 'INACTIVE')}
          </Badge>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pointsValue') || 'Points Value'}</p>
                <p className="text-2xl font-bold text-yellow-600">{currencySymbol}{settings?.point_value || 0.25}</p>
                <p className="text-xs text-muted-foreground">{t('perPoint') || 'per point'}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg">
                <Coins className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('minRedeem') || 'Min. Redeem'}</p>
                <p className="text-2xl font-bold text-green-600">{settings?.min_redeem_points || 100}</p>
                <p className="text-xs text-muted-foreground">{t('points') || 'points'}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('maxRedeem') || 'Max Redeem'}</p>
                <p className="text-2xl font-bold text-blue-600">{settings?.max_redeem_percent || 50}%</p>
                <p className="text-xs text-muted-foreground">{t('ofBill') || 'of bill'}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg">
                <Award className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pointExpiry') || 'Point Expiry'}</p>
                <p className="text-2xl font-bold text-purple-600">{settings?.point_expiry_days || 365}</p>
                <p className="text-xs text-muted-foreground">{t('days') || 'days'}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-400 to-violet-500 shadow-lg">
                <Star className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tiers" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="tiers">{t('membershipTiers') || 'Membership Tiers'}</TabsTrigger>
          <TabsTrigger value="leaderboard">{t('leaderboard') || 'Leaderboard'}</TabsTrigger>
          <TabsTrigger value="customers">{t('customers') || 'Customers'}</TabsTrigger>
        </TabsList>

        {/* Tiers Tab - Pamphlet Cards */}
        <TabsContent value="tiers" className="mt-6">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold">{t('chooseTier') || 'Choose Your Membership'}</h2>
            <p className="text-muted-foreground">{t('tierDescription') || 'Unlock exclusive benefits as you earn more points'}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(settings?.tiers || {}).map(([tierName, tierData], idx) => (
              <PamphletTierCard 
                key={tierName} 
                tierName={tierName} 
                tierData={tierData} 
                isPopular={tierName === 'gold'}
              />
            ))}
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="mt-6">
          <Card className="bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                {t('topLoyalCustomers') || 'Top Loyal Customers'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{t('noPointsYet') || 'No customers have earned points yet'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((customer, idx) => {
                    const config = TIER_CONFIG[customer.loyalty_tier] || TIER_CONFIG.bronze;
                    return (
                      <div 
                        key={customer.id || idx}
                        className="flex items-center justify-between p-4 rounded-xl border bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${
                            idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' :
                            idx === 1 ? 'bg-gradient-to-br from-slate-300 to-gray-400 text-white' :
                            idx === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white' :
                            'bg-accent text-foreground'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-semibold">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">{customer.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${config.iconBg}`}>
                            {getTierIcon(customer.loyalty_tier)}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-primary">{customer.loyalty_points?.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{t('points') || 'points'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('customerLoyalty') || 'Customer Loyalty'}</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchCustomers') || 'Search customers...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCustomers.slice(0, 20).map(customer => {
                  const config = TIER_CONFIG[customer.loyalty_tier] || TIER_CONFIG.bronze;
                  return (
                    <div 
                      key={customer.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => viewCustomerLoyalty(customer)}
                      >
                        <div className={`p-2 rounded-full ${config.iconBg}`}>
                          {getTierIcon(customer.loyalty_tier || 'bronze')}
                        </div>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold">{customer.loyalty_points || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('points') || 'points'}</p>
                        </div>
                        <MembershipCardButton customer={customer} variant="icon-only" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('loyaltySettings') || 'Loyalty Program Settings'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
              <div>
                <p className="font-medium">{t('programStatus') || 'Program Status'}</p>
                <p className="text-sm text-muted-foreground">{t('enableDisable') || 'Enable or disable the loyalty program'}</p>
              </div>
              <Switch
                checked={settingsForm.is_active}
                onCheckedChange={(val) => setSettingsForm({ ...settingsForm, is_active: val })}
              />
            </div>

            {/* Points Configuration */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pointsPer100') || 'Points per ₹100 spent'}</Label>
                <Input
                  type="number"
                  value={settingsForm.points_per_rupee || 1}
                  onChange={(e) => setSettingsForm({ ...settingsForm, points_per_rupee: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('pointValue') || 'Point Value ({currencySymbol})'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settingsForm.point_value || 0.25}
                  onChange={(e) => setSettingsForm({ ...settingsForm, point_value: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('minPointsRedeem') || 'Minimum Points to Redeem'}</Label>
                <Input
                  type="number"
                  value={settingsForm.min_redeem_points || 100}
                  onChange={(e) => setSettingsForm({ ...settingsForm, min_redeem_points: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('maxBillPercent') || 'Max Bill % Payable via Points'}</Label>
                <Input
                  type="number"
                  value={settingsForm.max_redeem_percent || 50}
                  onChange={(e) => setSettingsForm({ ...settingsForm, max_redeem_percent: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('pointExpiryDays') || 'Point Expiry (Days)'}</Label>
                <Input
                  type="number"
                  value={settingsForm.point_expiry_days || 365}
                  onChange={(e) => setSettingsForm({ ...settingsForm, point_expiry_days: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowSettingsModal(false)}>{t('cancel') || 'Cancel'}</Button>
              <Button onClick={saveSettings}>
                <Save className="w-4 h-4 mr-2" /> {t('saveSettings') || 'Save Settings'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Loyalty Details Modal */}
      <Dialog open={!!customerLoyalty} onOpenChange={() => setCustomerLoyalty(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}&apos;s {t('loyalty') || 'Loyalty'}</DialogTitle>
          </DialogHeader>
          
          {customerLoyalty && (
            <div className="space-y-4">
              <div className="text-center p-6 bg-gradient-to-br from-accent/50 to-accent/30 rounded-xl">
                <div className={`w-20 h-20 mx-auto rounded-full ${TIER_CONFIG[customerLoyalty.tier]?.iconBg || TIER_CONFIG.bronze.iconBg} flex items-center justify-center mb-3 shadow-xl ring-4 ring-white/50`}>
                  {getTierIcon(customerLoyalty.tier)}
                </div>
                <p className="text-4xl font-bold">{customerLoyalty.points?.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{t('totalPoints') || 'Total Points'}</p>
                <Badge className={`mt-3 capitalize ${TIER_CONFIG[customerLoyalty.tier]?.iconBg || ''} border-0 text-white`}>
                  {customerLoyalty.tier}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">{t('benefits') || 'Benefits'}:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {customerLoyalty.tier_benefits?.map((benefit, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t pt-4">
                <p className="font-medium text-sm mb-2">{t('recentTransactions') || 'Recent Transactions'}:</p>
                {customerLoyalty.transactions?.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {customerLoyalty.transactions.slice(0, 5).map(tx => (
                      <div key={tx.id} className="flex justify-between text-sm p-2 bg-accent/30 rounded">
                        <span>{tx.description}</span>
                        <span className={tx.type === 'earn' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {tx.type === 'earn' ? '+' : ''}{tx.points}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noTransactions') || 'No transactions yet'}</p>
                )}
              </div>

              {/* Membership Card Actions */}
              <div className="border-t pt-4">
                <p className="font-medium text-sm mb-3">Membership Card</p>
                <MembershipCardButton 
                  customer={{
                    ...selectedCustomer,
                    loyalty_tier: customerLoyalty.tier,
                    loyalty_points: customerLoyalty.points
                  }} 
                  showPreview={true}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
