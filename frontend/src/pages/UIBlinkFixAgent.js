import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Zap, Scan, Settings2, CheckCircle, XCircle, AlertTriangle, 
  Play, RotateCcw, Eye, FileCode, RefreshCw, Loader2, 
  Bot, Sparkles, ChevronRight, Clock, Activity, Target
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

// Blink type descriptions
const BLINK_TYPE_INFO = {
  loading_cascade: {
    label: 'Loading Cascade',
    description: 'Multiple loading states causing cascading renders',
    icon: Activity,
    color: 'text-red-500'
  },
  auth_rerender: {
    label: 'Auth Re-render',
    description: 'Authentication state changes causing full rerender',
    icon: Settings2,
    color: 'text-orange-500'
  },
  state_flash: {
    label: 'State Flash',
    description: 'Improper state initialization causing visual flash',
    icon: Zap,
    color: 'text-yellow-500'
  },
  css_transition: {
    label: 'CSS Transition',
    description: 'Missing CSS transitions causing abrupt changes',
    icon: Eye,
    color: 'text-blue-500'
  },
  component_remount: {
    label: 'Component Remount',
    description: 'Unnecessary component remounting on state change',
    icon: RefreshCw,
    color: 'text-purple-500'
  }
};

const SEVERITY_COLORS = {
  minor: 'bg-blue-500',
  moderate: 'bg-yellow-500',
  major: 'bg-red-500'
};

export default function UIBlinkFixAgent() {
  const { api } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [issues, setIssues] = useState([]);
  const [fixes, setFixes] = useState([]);

  // Avoid null initial state to prevent UI flashing between "empty" and "loaded" renders.
  // Use a stable initial shape and track readiness explicitly.
  const [dashboardStats, setDashboardStats] = useState({});
  const [isDashboardLoaded, setIsDashboardLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Stable defaults to avoid conditional null checks causing brief mount/unmount flashes.
  const [selectedIssue, setSelectedIssue] = useState({});
  const [selectedFix, setSelectedFix] = useState({});

  // Modals
  const [showFixModal, setShowFixModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAutoFixModal, setShowAutoFixModal] = useState(false);
  
  // Report form
  const [reportForm, setReportForm] = useState({ file_path: '', description: '' });
  
  // Auto-fix options
  const [dryRun, setDryRun] = useState(true);
  const [autoFixResult, setAutoFixResult] = useState({});

  useEffect(() => {
    fetchDashboard();
    fetchIssues();
    fetchFixes();
  }, []);

  const fetchDashboard = async () => {
    try {
      const data = await api('/api/ui-blink/dashboard');
      setDashboardStats(data);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    }
  };

  const fetchIssues = async () => {
    try {
      const data = await api('/api/ui-blink/issues');
      setIssues(data.issues || []);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    }
  };

  const fetchFixes = async () => {
    try {
      const data = await api('/api/ui-blink/fixes');
      setFixes(data.fixes || []);
    } catch (err) {
      console.error('Failed to fetch fixes:', err);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const data = await api('/api/ui-blink/scan');
      toast.success(`Scan complete! Found ${data.issues_found} potential issues.`);
      fetchIssues();
      fetchDashboard();
    } catch (err) {
      toast.error('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
    }
  };

  const handleGenerateFix = async (issueId) => {
    setLoading(true);
    try {
      const data = await api(`/api/ui-blink/issues/${issueId}/generate-fix`, {
        method: 'POST'
      });
      toast.success('Fix generated successfully!');
      setSelectedFix(data.fix);
      setShowFixModal(true);
      fetchFixes();
      fetchIssues();
    } catch (err) {
      toast.error('Failed to generate fix: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFix = async (fixId) => {
    if (!confirm('Apply this fix? A backup will be created automatically.')) return;
    
    setLoading(true);
    try {
      const result = await api(`/api/ui-blink/fixes/${fixId}/apply`, {
        method: 'POST'
      });
      if (result.status === 'applied') {
        toast.success('Fix applied successfully!');
      } else {
        toast.error(result.error || 'Fix application failed');
      }
      setShowFixModal(false);
      fetchFixes();
      fetchIssues();
      fetchDashboard();
    } catch (err) {
      toast.error('Failed to apply fix: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (fixId) => {
    if (!confirm('Rollback this fix? The original code will be restored.')) return;
    
    setLoading(true);
    try {
      await api(`/api/ui-blink/fixes/${fixId}/rollback`, {
        method: 'POST'
      });
      toast.success('Fix rolled back successfully');
      fetchFixes();
      fetchIssues();
      fetchDashboard();
    } catch (err) {
      toast.error('Rollback failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFix = async () => {
    setLoading(true);
    try {
      const result = await api(`/api/ui-blink/auto-fix?dry_run=${dryRun}`, {
        method: 'POST'
      });
      setAutoFixResult(result);
      if (!dryRun && result.fixes_applied > 0) {
        toast.success(`Applied ${result.fixes_applied} fixes!`);
      }
      fetchIssues();
      fetchFixes();
      fetchDashboard();
    } catch (err) {
      toast.error('Auto-fix failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!reportForm.file_path || !reportForm.description) {
      toast.error('Please fill in all fields');
      return;
    }
    
    try {
      await api('/api/ui-blink/report', {
        method: 'POST',
        body: JSON.stringify(reportForm)
      });
      toast.success('Issue reported! AI agent will analyze it.');
      setShowReportModal(false);
      setReportForm({ file_path: '', description: '' });
      fetchIssues();
    } catch (err) {
      toast.error('Failed to report issue');
    }
  };

  const getBlinkTypeInfo = (type) => {
    return BLINK_TYPE_INFO[type] || {
      label: type,
      description: 'Unknown issue type',
      icon: AlertTriangle,
      color: 'text-gray-500'
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-7 h-7 text-blue-500" />
            UI Blink Fix Agent
            <Badge variant="outline" className="ml-2">AI-Powered</Badge>
          </h1>
          <p className="text-muted-foreground">
            Automatically detect and fix UI blinking/flickering issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowReportModal(true)}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
          <Button 
            onClick={handleScan} 
            disabled={scanning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Scan className="w-4 h-4 mr-2" />
            )}
            {scanning ? 'Scanning...' : 'Scan Code'}
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Issues</p>
                  <p className="text-3xl font-bold">{dashboardStats.total_issues}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Fixed Issues</p>
                  <p className="text-3xl font-bold text-green-500">{dashboardStats.fixed_issues}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-orange-500">{dashboardStats.pending_issues}</p>
                </div>
                <Clock className="w-10 h-10 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Fix Rate</p>
                  <p className="text-3xl font-bold text-blue-500">{dashboardStats.fix_rate?.toFixed(0)}%</p>
                </div>
                <Target className="w-10 h-10 text-blue-500 opacity-50" />
              </div>
              <Progress value={dashboardStats.fix_rate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <Activity className="w-4 h-4" />
            Issues ({issues.length})
          </TabsTrigger>
          <TabsTrigger value="fixes" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Fixes ({fixes.length})
          </TabsTrigger>
          <TabsTrigger value="auto-fix" className="gap-2">
            <Bot className="w-4 h-4" />
            Auto-Fix
          </TabsTrigger>
        </TabsList>

        {/* Issues Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Blink Issues</CardTitle>
              <CardDescription>
                Click on an issue to generate an AI-powered fix
              </CardDescription>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No blink issues detected</p>
                  <p className="text-sm">Click "Scan Code" to analyze your frontend</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {issues.map((issue) => {
                      const typeInfo = getBlinkTypeInfo(issue.blink_type);
                      const TypeIcon = typeInfo.icon;
                      return (
                        <div 
                          key={issue.issue_id}
                          className="p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <TypeIcon className={`w-5 h-5 mt-0.5 ${typeInfo.color}`} />
                              <div>
                                <p className="font-medium">{typeInfo.label}</p>
                                <p className="text-sm text-muted-foreground">{issue.file_path}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Lines: {issue.line_numbers?.join(', ')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={SEVERITY_COLORS[issue.severity]}>
                                {issue.severity}
                              </Badge>
                              {issue.status === 'detected' && (
                                <Button 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateFix(issue.issue_id);
                                  }}
                                  disabled={loading}
                                >
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Fix
                                </Button>
                              )}
                              {issue.status === 'fix_applied' && (
                                <Badge className="bg-green-500">Fixed</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixes Tab */}
        <TabsContent value="fixes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Fixes</CardTitle>
              <CardDescription>
                Review and apply AI-generated fixes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fixes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No fixes generated yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {fixes.map((fix) => (
                      <div 
                        key={fix.fix_id}
                        className="p-4 rounded-lg border"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{fix.fix_description}</p>
                            <p className="text-sm text-muted-foreground">{fix.file_path}</p>
                            <Badge variant="outline" className="mt-2">{fix.status}</Badge>
                          </div>
                          <div className="flex gap-2">
                            {fix.status === 'fix_generated' && (
                              <Button 
                                size="sm"
                                onClick={() => handleApplyFix(fix.fix_id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Apply
                              </Button>
                            )}
                            {fix.status === 'applied' && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleRollback(fix.fix_id)}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Rollback
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedFix(fix);
                                setShowFixModal(true);
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Fix Tab */}
        <TabsContent value="auto-fix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Automatic Blink Fixer
              </CardTitle>
              <CardDescription>
                Let the AI agent automatically scan and fix all blinking issues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-accent">
                <div>
                  <Label className="text-base">Dry Run Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Preview fixes without applying them
                  </p>
                </div>
                <Switch 
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                />
              </div>
              
              <Button 
                onClick={handleAutoFix}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4 mr-2" />
                )}
                {dryRun ? 'Preview Auto-Fix' : 'Run Auto-Fix'}
              </Button>
              
              {autoFixResult && (
                <div className="mt-4 p-4 rounded-lg bg-accent">
                  <h4 className="font-medium mb-2">Auto-Fix Results</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Issues Found: <strong>{autoFixResult.issues_found}</strong></div>
                    <div>Fixes Generated: <strong>{autoFixResult.fixes_generated}</strong></div>
                    {!autoFixResult.dry_run && (
                      <div>Fixes Applied: <strong className="text-green-500">{autoFixResult.fixes_applied}</strong></div>
                    )}
                    {autoFixResult.errors?.length > 0 && (
                      <div className="col-span-2 text-red-500">
                        Errors: {autoFixResult.errors.length}
                      </div>
                    )}
                  </div>
                  {autoFixResult.dry_run && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      This was a dry run. Turn off "Dry Run Mode" to apply fixes.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fix Preview Modal */}
      <Dialog open={showFixModal} onOpenChange={setShowFixModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fix Preview</DialogTitle>
            <DialogDescription>
              Review the AI-generated fix before applying
            </DialogDescription>
          </DialogHeader>
          {selectedFix && (
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <p className="text-sm mt-1">{selectedFix.fix_description}</p>
              </div>
              <div>
                <Label>File</Label>
                <p className="text-sm mt-1 font-mono">{selectedFix.file_path}</p>
              </div>
              <div>
                <Label>Original Code</Label>
                <pre className="mt-1 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm overflow-x-auto">
                  <code>{selectedFix.original_code}</code>
                </pre>
              </div>
              <div>
                <Label>Fixed Code</Label>
                <pre className="mt-1 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm overflow-x-auto">
                  <code>{selectedFix.fixed_code}</code>
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFixModal(false)}>
              Close
            </Button>
            {selectedFix?.status === 'fix_generated' && (
              <Button 
                onClick={() => handleApplyFix(selectedFix.fix_id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Apply Fix
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Issue Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Blink Issue</DialogTitle>
            <DialogDescription>
              Describe the blinking/flickering issue you're experiencing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>File Path</Label>
              <Input
                placeholder="/app/frontend/src/pages/..."
                value={reportForm.file_path}
                onChange={(e) => setReportForm(prev => ({ ...prev, file_path: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the blinking issue - when does it occur? What component is affected?"
                value={reportForm.description}
                onChange={(e) => setReportForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleReportIssue}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Report Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
