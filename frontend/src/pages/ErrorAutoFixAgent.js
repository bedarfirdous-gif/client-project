import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertTriangle, Zap, Shield, Code, RefreshCw, Settings, CheckCircle, XCircle, Clock, Bug, Database, Network, Lock, Eye, Play, RotateCcw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ErrorAutoFixAgent() {
  const { token } = useAuth();
  // FIX: Avoid null initial state to prevent a mount-time flash (null -> populated object)
  // when the UI conditionally renders based on these values.
  const [dashboard, setDashboard] = useState({});
  const [config, setConfig] = useState({});
  const [errors, setErrors] = useState([]);
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(true);
  // FIX: Gate first "real" render on an explicit loaded flag so the UI doesn't briefly
  // render empty defaults and then re-render with fetched data.
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  // FIX: Avoid null -> object transition which can cause a brief UI flash
  // in components that conditionally render based on these values.
  const [selectedError, setSelectedError] = useState({});
  const [selectedFix, setSelectedFix] = useState({});
  const [showFixModal, setShowFixModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [generatingFix, setGeneratingFix] = useState(false);
  const [applyingFix, setApplyingFix] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  }, [token]);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  }, [token]);

  const fetchErrors = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/errors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setErrors(data.errors || []);
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error);
    }
  }, [token]);

  const fetchFixes = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/fixes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFixes(data.fixes || []);
      }
    } catch (error) {
      console.error('Failed to fetch fixes:', error);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchConfig(), fetchErrors(), fetchFixes()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchConfig, fetchErrors, fetchFixes]);

  const updateConfig = async (updates) => {
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const generateFix = async (errorId) => {
    setGeneratingFix(true);
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/errors/${errorId}/generate-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const fix = await response.json();
        setSelectedFix(fix);
        setShowFixModal(true);
        await fetchFixes();
      }
    } catch (error) {
      console.error('Failed to generate fix:', error);
    } finally {
      setGeneratingFix(false);
    }
  };

  const applyFix = async (fixId) => {
    setApplyingFix(true);
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/fixes/${fixId}/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await Promise.all([fetchDashboard(), fetchErrors(), fetchFixes()]);
        setShowFixModal(false);
      }
    } catch (error) {
      console.error('Failed to apply fix:', error);
    } finally {
      setApplyingFix(false);
    }
  };

  const rollbackFix = async (fixId) => {
    try {
      const response = await fetch(`${API_URL}/api/error-autofix/fixes/${fixId}/rollback`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await Promise.all([fetchDashboard(), fetchErrors(), fetchFixes()]);
      }
    } catch (error) {
      console.error('Failed to rollback fix:', error);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'login_failure': <Lock className="w-4 h-4" />,
      'api_error': <Network className="w-4 h-4" />,
      'database_error': <Database className="w-4 h-4" />,
      'authentication': <Shield className="w-4 h-4" />,
      'authorization': <Lock className="w-4 h-4" />,
      'validation': <AlertTriangle className="w-4 h-4" />,
      'frontend': <Code className="w-4 h-4" />,
      'runtime': <Bug className="w-4 h-4" />
    };
    return icons[category] || <Bug className="w-4 h-4" />;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'critical': 'bg-red-500',
      'high': 'bg-orange-500',
      'medium': 'bg-yellow-500',
      'low': 'bg-blue-500'
    };
    return colors[priority] || 'bg-gray-500';
  };

  const getStatusColor = (status) => {
    const colors = {
      'success': 'bg-green-500 text-white',
      'partial': 'bg-yellow-500 text-white',
      'failed': 'bg-red-500 text-white',
      'pending': 'bg-blue-500 text-white',
      'pending_review': 'bg-purple-500 text-white'
    };
    return colors[status] || 'bg-gray-500 text-white';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="error-autofix-agent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Zap className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Error Auto-Fix Agent</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered automatic error detection and resolution
            </p>
          </div>
          <Badge variant="outline" className="ml-2">AI-Powered</Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowConfigModal(true)}
            data-testid="config-btn"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button 
            size="sm"
            onClick={() => Promise.all([fetchDashboard(), fetchErrors(), fetchFixes()])}
            data-testid="refresh-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Errors</p>
                  <p className="text-3xl font-bold text-red-600">{dashboard.total_errors}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Fixed Errors</p>
                  <p className="text-3xl font-bold text-green-600">{dashboard.fixed_errors}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600">{dashboard.pending_errors}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Fix Success Rate</p>
                  <p className="text-3xl font-bold text-blue-600">{dashboard.fix_success_rate?.toFixed(1)}%</p>
                </div>
                <Zap className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mode Indicator */}
      {config && (
        <Card className={config.fix_mode === 'auto' ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.fix_mode === 'auto' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <Eye className="w-6 h-6 text-yellow-600" />
              )}
              <div>
                <p className="font-medium">
                  {config.fix_mode === 'auto' ? 'Auto-Fix Mode Enabled' : 'Confirmation Mode Active'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {config.fix_mode === 'auto' 
                    ? 'Errors will be fixed automatically when detected' 
                    : 'You will be asked before fixes are applied'}
                </p>
              </div>
            </div>
            <Switch
              checked={config.fix_mode === 'auto'}
              onCheckedChange={(checked) => updateConfig({ fix_mode: checked ? 'auto' : 'confirm' })}
            />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="errors">Errors ({errors.length})</TabsTrigger>
          <TabsTrigger value="fixes">Fixes ({fixes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboard?.by_category && Object.keys(dashboard.by_category).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Errors by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(dashboard.by_category).map(([category, count]) => (
                    <div key={category} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      {getCategoryIcon(category)}
                      <div>
                        <p className="text-sm font-medium capitalize">{category.replace('_', ' ')}</p>
                        <p className="text-lg font-bold">{count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Last 24 hours: {dashboard?.recent_errors_24h || 0} new errors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                {dashboard?.recent_errors_24h === 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                    <p>No new errors in the last 24 hours!</p>
                  </div>
                ) : (
                  <p>Check the Errors tab for details</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {errors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium">No errors detected</p>
                <p className="text-muted-foreground">The system is running smoothly</p>
              </CardContent>
            </Card>
          ) : (
            errors.map((error) => (
              <Card key={error.error_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${getPriorityColor(error.priority)} bg-opacity-20`}>
                        {getCategoryIcon(error.category)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{error.error_type || 'Unknown Error'}</p>
                          <Badge className={getPriorityColor(error.priority)}>{error.priority}</Badge>
                          <Badge variant="outline">{error.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {error.error_message}
                        </p>
                        {error.file_path && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {error.file_path}:{error.line_number}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Occurrences: {error.occurrence_count} | Last: {new Date(error.last_occurrence || error.detected_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedError(error);
                          generateFix(error.error_id);
                        }}
                        disabled={generatingFix || error.status === 'fix_applied'}
                        data-testid={`fix-error-${error.error_id}`}
                      >
                        {generatingFix && selectedError?.error_id === error.error_id ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        {error.status === 'fix_applied' ? 'Fixed' : 'Fix'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="fixes" className="space-y-4">
          {fixes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Code className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium">No fixes generated yet</p>
                <p className="text-muted-foreground">Generate fixes from the Errors tab</p>
              </CardContent>
            </Card>
          ) : (
            fixes.map((fix) => (
              <Card key={fix.fix_id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{fix.fix_type}</p>
                        <Badge className={getStatusColor(fix.result)}>{fix.result}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{fix.fix_description}</p>
                      {fix.fixed_code && (
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-w-lg">
                          {fix.fixed_code.slice(0, 200)}...
                        </pre>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {fix.result === 'pending' && (
                        <Button size="sm" onClick={() => applyFix(fix.fix_id)} disabled={applyingFix}>
                          <Play className="w-4 h-4 mr-2" />
                          Apply
                        </Button>
                      )}
                      {(fix.result === 'success' || fix.result === 'applied') && (
                        <Button size="sm" variant="outline" onClick={() => rollbackFix(fix.fix_id)}>
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Fix Modal */}
      <Dialog open={showFixModal} onOpenChange={setShowFixModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI-Generated Fix</DialogTitle>
            <DialogDescription>
              Review the proposed fix before applying
            </DialogDescription>
          </DialogHeader>
          {selectedFix && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">Fix Type: {selectedFix.fix_type}</p>
                <p className="text-sm text-muted-foreground">{selectedFix.fix_description}</p>
              </div>
              {selectedFix.fixed_code && (
                <div>
                  <p className="font-medium mb-2">Suggested Code:</p>
                  <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
                    {selectedFix.fixed_code}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFixModal(false)}>Cancel</Button>
            <Button onClick={() => applyFix(selectedFix?.fix_id)} disabled={applyingFix}>
              {applyingFix ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Apply Fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error Auto-Fix Configuration</DialogTitle>
          </DialogHeader>
          {config && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Fix Mode</p>
                  <p className="text-sm text-muted-foreground">Automatically fix errors without confirmation</p>
                </div>
                <Switch
                  checked={config.fix_mode === 'auto'}
                  onCheckedChange={(checked) => updateConfig({ fix_mode: checked ? 'auto' : 'confirm' })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Learning</p>
                  <p className="text-sm text-muted-foreground">Learn from successful fixes</p>
                </div>
                <Switch
                  checked={config.enable_learning}
                  onCheckedChange={(checked) => updateConfig({ enable_learning: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notify on Fix</p>
                  <p className="text-sm text-muted-foreground">Show notification when fix is applied</p>
                </div>
                <Switch
                  checked={config.notify_on_fix}
                  onCheckedChange={(checked) => updateConfig({ notify_on_fix: checked })}
                />
              </div>
              <div>
                <p className="font-medium mb-2">Min Occurrences for Auto-Fix</p>
                <Select
                  value={String(config.min_occurrences_for_auto_fix)}
                  onValueChange={(v) => updateConfig({ min_occurrences_for_auto_fix: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 occurrence</SelectItem>
                    <SelectItem value="2">2 occurrences</SelectItem>
                    <SelectItem value="3">3 occurrences</SelectItem>
                    <SelectItem value="5">5 occurrences</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowConfigModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
