import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Shield, ShieldCheck, ShieldAlert, Settings, Save, RefreshCw,
  Trash2, Users, Banknote, Wallet, UserCog, Package, RotateCcw, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';

const ACTION_ICONS = {
  delete_employee: Trash2,
  delete_customer: Trash2,
  delete_item: Package,
  loan_approval: Banknote,
  payroll_processing: Wallet,
  user_management: UserCog,
  bulk_delete: AlertTriangle,
  refund: RotateCcw
};

const ACTION_COLORS = {
  delete_employee: 'text-red-600',
  delete_customer: 'text-red-600',
  delete_item: 'text-orange-600',
  loan_approval: 'text-amber-600',
  payroll_processing: 'text-blue-600',
  user_management: 'text-purple-600',
  bulk_delete: 'text-red-700',
  refund: 'text-green-600'
};

export default function SecuritySettingsPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api('/api/settings/sensitivity');
      setSettings(data.settings || []);
    } catch (err) {
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (actionType, field, value) => {
    setSettings(prev => prev.map(s => 
      s.action_type === actionType ? { ...s, [field]: value } : s
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('/api/settings/sensitivity', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      toast.success('Security settings saved');
      setHasChanges(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => `${currencySymbol}${amount.toLocaleString('en-IN')}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="security-settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Security & Re-Authentication Settings
          </h1>
          <p className="text-muted-foreground">Configure which actions require additional security verification</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !hasChanges}
            className={hasChanges ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <Save className="w-4 h-4 mr-2" /> 
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">How Sensitivity Settings Work</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                When enabled, users must re-enter their password or PIN before performing sensitive actions.
                You can set thresholds so that only actions above a certain amount or count require verification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Grid */}
      <div className="grid gap-4">
        {settings.map(setting => {
          const Icon = ACTION_ICONS[setting.action_type] || Shield;
          const colorClass = ACTION_COLORS[setting.action_type] || 'text-gray-600';
          
          return (
            <Card key={setting.action_type} className={`transition-all ${!setting.enabled ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Action Info */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold capitalize">
                        {setting.action_type.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`enable-${setting.action_type}`} className="text-sm">
                      {setting.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      id={`enable-${setting.action_type}`}
                      checked={setting.enabled}
                      onCheckedChange={(checked) => updateSetting(setting.action_type, 'enabled', checked)}
                    />
                  </div>
                  
                  {/* Threshold Settings */}
                  {setting.enabled && (
                    <div className="flex items-center gap-3">
                      <Select
                        value={setting.threshold_type}
                        onValueChange={(value) => updateSetting(setting.action_type, 'threshold_type', value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Always</SelectItem>
                          <SelectItem value="amount">Amount &gt;</SelectItem>
                          <SelectItem value="count">Count &gt;</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {setting.threshold_type !== 'none' && (
                        <div className="flex items-center gap-2">
                          {setting.threshold_type === 'amount' && (
                            <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                          )}
                          <Input
                            type="number"
                            value={setting.threshold_value}
                            onChange={(e) => updateSetting(setting.action_type, 'threshold_value', parseFloat(e.target.value) || 0)}
                            className="w-24"
                            min={0}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <Badge variant={setting.enabled ? 'default' : 'secondary'} className="ml-auto">
                    {setting.enabled ? (
                      setting.threshold_type === 'none' ? 'Always Re-Auth' :
                      setting.threshold_type === 'amount' ? `If > ${formatCurrency(setting.threshold_value)}` :
                      `If > ${setting.threshold_value} items`
                    ) : 'No Re-Auth'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Security Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {settings.filter(s => s.enabled).length}
              </p>
              <p className="text-sm text-muted-foreground">Protected Actions</p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">
                {settings.filter(s => s.enabled && s.threshold_type !== 'none').length}
              </p>
              <p className="text-sm text-muted-foreground">With Thresholds</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {settings.filter(s => s.enabled && s.threshold_type === 'none').length}
              </p>
              <p className="text-sm text-muted-foreground">Always Required</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">
                {settings.filter(s => !s.enabled).length}
              </p>
              <p className="text-sm text-muted-foreground">Disabled</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
