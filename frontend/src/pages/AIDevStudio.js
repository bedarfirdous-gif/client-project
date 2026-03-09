import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Code2, Sparkles, Play, Rocket, RotateCcw, FileCode, FolderTree,
  CheckCircle, XCircle, AlertTriangle, Clock, Loader2, Plus,
  Trash2, RefreshCw, Eye, Download, Copy, Search, Filter,
  Lightbulb, Wand2, FlaskConical, Settings, Database, Layout,
  GitBranch, Terminal, FileText, ChevronDown, ChevronRight,
  Package, Server, Globe, Zap, HelpCircle, Brain, Star, BarChart3,
  Monitor, ThumbsUp, ThumbsDown, MessageSquare
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Textarea } from '../components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../components/ui/select';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../components/ui/dialog';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '../components/ui/accordion';
import { Switch } from '../components/ui/switch';
import { Progress } from '../components/ui/progress';
import { Slider } from '../components/ui/slider';

// Status badge colors
const STATUS_COLORS = {
  pending: 'bg-gray-500',
  generating: 'bg-blue-500 animate-pulse',
  generated: 'bg-green-500',
  testing: 'bg-yellow-500 animate-pulse',
  tested: 'bg-emerald-500',
  deploying: 'bg-purple-500 animate-pulse',
  deployed: 'bg-green-600',
  failed: 'bg-red-500',
  rolled_back: 'bg-orange-500'
};

// Module type icons
const MODULE_TYPE_ICONS = {
  crud: Package,
  report: FileText,
  dashboard: Layout,
  workflow: GitBranch,
  integration: Globe,
  settings: Settings,
  custom: Code2
};

// Code syntax highlighting (simple version)
const CodeBlock = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const [timeout, setTimeout] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg bg-slate-900 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs text-slate-400">{language}</span>
        <Button variant="ghost" size="sm" onClick={copyCode}>
          {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
      <ScrollArea className="h-[400px]">
        <pre className="p-4 text-sm overflow-x-auto">
          <code>{code}</code>
        </pre>
      </ScrollArea>
    </div>
  );
};

export default function AIDevStudio() {
  const { api } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState('generate');
  const [templates, setTemplates] = useState([]);
  const [modules, setModules] = useState([]);
  // Fix: avoid `null` initial state which can cause conditional-render mount/unmount flashes.
  // Use a stable default + an explicit "loaded" flag to control UI.
  const [selectedModule, setSelectedModule] = useState({});
  const [isSelectedModuleLoaded, setIsSelectedModuleLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // When modules load, keep selection stable and mark as loaded (prevents UI blinking).
  useEffect(() => {
    if (!isSelectedModuleLoaded && modules.length > 0) {
      setSelectedModule(modules[0]);
      setIsSelectedModuleLoaded(true);
    }
  }, [modules, isSelectedModuleLoaded]);
  
  // Generation form
  const [genForm, setGenForm] = useState({
    prompt: '',
    module_type: 'custom',
    module_name: '',
    description: '',
    include_frontend: true,
    include_backend: true,
    include_database: true,
    target_entities: '',
    additional_context: ''
  });
  
  // Improve form
  const [improveForm, setImproveForm] = useState({ feedback: '' });
  const [showImproveModal, setShowImproveModal] = useState(false);
  
  // Test results
  // Fix: avoid null initial state (can cause conditional-render flash). Use safe defaults + loaded flag.
  const [testResults, setTestResults] = useState({});
  const [isTestResultsLoaded, setIsTestResultsLoaded] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  
  // Deployment
  // Fix: avoid null initial state (can cause conditional-render flash). Use safe defaults + loaded flag.
  const [deploymentResult, setDeploymentResult] = useState({});
  const [isDeploymentResultLoaded, setIsDeploymentResultLoaded] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  
  // NEW: Live Preview
  // Fix: avoid null initial state so modal content doesn't mount/unmount with a flash.
  const [previewHtml, setPreviewHtml] = useState('');
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // NEW: Feedback form
  const [feedbackForm, setFeedbackForm] = useState({ rating: 3, comments: '' });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  
  // NEW: Learning stats
  // Fix: avoid null initial state (prevents stats section flashing in/out). Use safe defaults + loaded flag.
  const [learningStats, setLearningStats] = useState({});
  const [isLearningStatsLoaded, setIsLearningStatsLoaded] = useState(false);
  const [showLearningModal, setShowLearningModal] = useState(false);
  
  // NEW: Auto-integrate option
  const [autoIntegrate, setAutoIntegrate] = useState(true);

  // Fetch templates, modules, and learning stats on load
  useEffect(() => {
    fetchTemplates();
    fetchModules();
    fetchLearningStats();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await api('/api/superadmin/ai-dev/templates');
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const fetchModules = async () => {
    try {
      setLoading(true);
      const data = await api('/api/superadmin/ai-dev/modules');
      setModules(data.modules || []);
    } catch (err) {
      toast.error('Failed to fetch modules');
    } finally {
      setLoading(false);
    }
  };
  
  // NEW: Fetch learning stats
  const fetchLearningStats = async () => {
    try {
      const data = await api('/api/superadmin/ai-dev/learning-stats');
      setLearningStats(data);
    } catch (err) {
      console.error('Failed to fetch learning stats:', err);
    }
  };
  
  // NEW: Live Preview
  const handlePreview = async (moduleId) => {
    try {
      const data = await api(`/api/superadmin/ai-dev/modules/${moduleId}/preview`);
      setPreviewHtml(data.preview_html);
      setShowPreviewModal(true);
    } catch (err) {
      toast.error('Failed to load preview');
    }
  };
  
  // NEW: Submit Feedback
  const handleSubmitFeedback = async () => {
    if (!selectedModule) return;
    
    try {
      await api(`/api/superadmin/ai-dev/modules/${selectedModule.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify(feedbackForm)
      });
      toast.success('Thank you for your feedback! This helps improve future generations.');
      setShowFeedbackModal(false);
      setFeedbackForm({ rating: 3, comments: '' });
      fetchLearningStats();
    } catch (err) {
      toast.error('Failed to submit feedback');
    }
  };

  const handleGenerate = async () => {
    if (!genForm.prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!genForm.module_name.trim()) {
      toast.error('Please enter a module name');
      return;
    }

    setGenerating(true);
    try {
      const response = await api('/api/superadmin/ai-dev/generate', {
        method: 'POST',
        body: JSON.stringify({
          ...genForm,
          target_entities: genForm.target_entities ? genForm.target_entities.split(',').map(e => e.trim()) : []
        })
      });
      
      toast.success('Module generated successfully!');
      setSelectedModule(response.module);
      fetchModules();
      setActiveTab('modules');
    } catch (err) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateSandbox = async (moduleId) => {
    try {
      const response = await api(`/api/superadmin/ai-dev/modules/${moduleId}/sandbox`, {
        method: 'POST'
      });
      toast.success('Sandbox created');
      fetchModules();
      if (selectedModule?.id === moduleId) {
        const updated = await api(`/api/superadmin/ai-dev/modules/${moduleId}`);
        setSelectedModule(updated);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create sandbox');
    }
  };

  const handleRunTests = async (sandboxId) => {
    try {
      const response = await api(`/api/superadmin/ai-dev/sandbox/${sandboxId}/test`, {
        method: 'POST'
      });
      setTestResults(response);
      setShowTestModal(true);
      fetchModules();
    } catch (err) {
      toast.error(err.message || 'Tests failed');
    }
  };

  const handleDeploy = async (moduleId) => {
    if (!confirm(`Deploy this module to production${autoIntegrate ? ' with auto-integration' : ''}?`)) return;
    
    try {
      const response = await api(`/api/superadmin/ai-dev/modules/${moduleId}/deploy?auto_integrate=${autoIntegrate}`, {
        method: 'POST'
      });
      setDeploymentResult(response);
      setShowDeployModal(true);
      toast.success('Module deployed successfully!');
      fetchModules();
    } catch (err) {
      toast.error(err.message || 'Deployment failed');
    }
  };

  const handleRollback = async (deploymentId) => {
    if (!confirm('Are you sure you want to rollback this deployment?')) return;
    
    try {
      await api(`/api/superadmin/ai-dev/deployments/${deploymentId}/rollback`, {
        method: 'POST'
      });
      toast.success('Rollback successful');
      fetchModules();
    } catch (err) {
      toast.error(err.message || 'Rollback failed');
    }
  };

  const handleImprove = async () => {
    if (!selectedModule || !improveForm.feedback.trim()) return;
    
    try {
      const response = await api(`/api/superadmin/ai-dev/modules/${selectedModule.id}/improve`, {
        method: 'POST',
        body: JSON.stringify(improveForm)
      });
      toast.success('Module improved!');
      setSelectedModule(response.module);
      setShowImproveModal(false);
      setImproveForm({ feedback: '' });
      fetchModules();
    } catch (err) {
      toast.error(err.message || 'Improvement failed');
    }
  };

  const handleDelete = async (moduleId) => {
    if (!confirm('Are you sure you want to delete this module?')) return;
    
    try {
      await api(`/api/superadmin/ai-dev/modules/${moduleId}`, {
        method: 'DELETE'
      });
      toast.success('Module deleted');
      if (selectedModule?.id === moduleId) {
        setSelectedModule(null);
      }
      fetchModules();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const applyTemplate = (template) => {
    setGenForm(prev => ({
      ...prev,
      module_type: template.type,
      prompt: template.example_prompt
    }));
    toast.success(`Applied ${template.name} template`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'deployed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'generating':
      case 'testing':
      case 'deploying': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'tested': return <FlaskConical className="w-4 h-4 text-emerald-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="w-7 h-7 text-purple-500" />
            AI Dev Studio
            <Badge variant="outline" className="ml-2 text-xs">v2.0</Badge>
          </h1>
          <p className="text-muted-foreground">
            Self-learning AI module generator with auto-integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLearningModal(true)}>
            <Brain className="w-4 h-4 mr-2" />
            AI Learning
          </Button>
          <Button variant="outline" onClick={fetchModules}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Learning Stats Banner */}
      {learningStats && learningStats.total_modules_learned > 0 && (
        <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Brain className="w-5 h-5 text-purple-500" />
                <span className="text-sm">
                  AI has learned from <strong>{learningStats.total_modules_learned}</strong> modules
                </span>
                {learningStats.overall?.avg_score && (
                  <Badge variant="secondary">
                    {(learningStats.overall.avg_score * 100).toFixed(0)}% success rate
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Self-improving with each deployment
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-2">
            <Package className="w-4 h-4" />
            Modules ({modules.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Lightbulb className="w-4 h-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generation Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-purple-500" />
                  Generate New Module
                </CardTitle>
                <CardDescription>
                  Describe what you want to build in natural language
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Module Name *</Label>
                    <Input
                      placeholder="e.g., SupplierManagement"
                      value={genForm.module_name}
                      onChange={(e) => setGenForm(prev => ({ ...prev, module_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Module Type</Label>
                    <Select 
                      value={genForm.module_type} 
                      onValueChange={(v) => setGenForm(prev => ({ ...prev, module_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crud">CRUD Module</SelectItem>
                        <SelectItem value="report">Report/Analytics</SelectItem>
                        <SelectItem value="dashboard">Dashboard</SelectItem>
                        <SelectItem value="workflow">Workflow</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="settings">Settings</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Prompt *</Label>
                  <Textarea
                    placeholder="Describe what you want to build in detail...&#10;&#10;Example: Create a supplier management module with fields for company name, contact person, email, phone, address, GST number, payment terms (net 30/60/90 days), and credit limit. Include list view with search, create/edit forms, and bulk import from CSV."
                    value={genForm.prompt}
                    onChange={(e) => setGenForm(prev => ({ ...prev, prompt: e.target.value }))}
                    rows={6}
                    className="resize-none"
                  />
                </div>

                <div>
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Brief description of the module"
                    value={genForm.description}
                    onChange={(e) => setGenForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={genForm.include_frontend}
                      onCheckedChange={(v) => setGenForm(prev => ({ ...prev, include_frontend: v }))}
                    />
                    <Label className="flex items-center gap-1">
                      <Layout className="w-4 h-4" />
                      Frontend
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={genForm.include_backend}
                      onCheckedChange={(v) => setGenForm(prev => ({ ...prev, include_backend: v }))}
                    />
                    <Label className="flex items-center gap-1">
                      <Server className="w-4 h-4" />
                      Backend
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={genForm.include_database}
                      onCheckedChange={(v) => setGenForm(prev => ({ ...prev, include_database: v }))}
                    />
                    <Label className="flex items-center gap-1">
                      <Database className="w-4 h-4" />
                      Database
                    </Label>
                  </div>
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced Options</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div>
                        <Label>Target Entities (comma-separated)</Label>
                        <Input
                          placeholder="e.g., suppliers, purchase_orders, payments"
                          value={genForm.target_entities}
                          onChange={(e) => setGenForm(prev => ({ ...prev, target_entities: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Additional Context</Label>
                        <Textarea
                          placeholder="Any additional context or requirements..."
                          value={genForm.additional_context}
                          onChange={(e) => setGenForm(prev => ({ ...prev, additional_context: e.target.value }))}
                          rows={3}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Button 
                  onClick={handleGenerate} 
                  disabled={generating}
                  className="w-full"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Module
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Quick Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {templates.map((template, idx) => {
                    const Icon = MODULE_TYPE_ICONS[template.type] || Code2;
                    return (
                      <Button
                        key={idx}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-3"
                        onClick={() => applyTemplate(template)}
                      >
                        <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                        <div className="overflow-hidden">
                          <p className="font-medium truncate">{template.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Module List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Generated Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : modules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No modules generated yet</p>
                      <Button 
                        variant="link" 
                        onClick={() => setActiveTab('generate')}
                      >
                        Generate your first module
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {modules.map((module) => {
                        const Icon = MODULE_TYPE_ICONS[module.module_type] || Code2;
                        return (
                          <div
                            key={module.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedModule?.id === module.id 
                                ? 'border-primary bg-primary/5' 
                                : 'hover:bg-accent'
                            }`}
                            onClick={() => setSelectedModule(module)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{module.name}</span>
                              </div>
                              {getStatusIcon(module.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {module.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {module.module_type}
                              </Badge>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs text-white ${STATUS_COLORS[module.status]}`}
                              >
                                {module.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Module Details */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedModule ? selectedModule.name : 'Select a Module'}
                </CardTitle>
                {selectedModule && (
                  <CardDescription>{selectedModule.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!selectedModule ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a module to view details</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {/* NEW: Preview Button */}
                      {selectedModule.preview_html && (
                        <Button 
                          variant="outline"
                          onClick={() => handlePreview(selectedModule.id)}
                        >
                          <Monitor className="w-4 h-4 mr-2" />
                          Live Preview
                        </Button>
                      )}
                      {selectedModule.status === 'generated' && (
                        <Button 
                          variant="outline"
                          onClick={() => handleCreateSandbox(selectedModule.id)}
                        >
                          <FlaskConical className="w-4 h-4 mr-2" />
                          Create Sandbox
                        </Button>
                      )}
                      {selectedModule.sandbox_id && selectedModule.status !== 'deployed' && (
                        <Button 
                          variant="outline"
                          onClick={() => handleRunTests(selectedModule.sandbox_id)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Run Tests
                        </Button>
                      )}
                      {(selectedModule.status === 'tested' || selectedModule.status === 'generated') && (
                        <Button 
                          onClick={() => handleDeploy(selectedModule.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Rocket className="w-4 h-4 mr-2" />
                          Deploy {autoIntegrate && '+ Auto-Integrate'}
                        </Button>
                      )}
                      {selectedModule.deployment_id && selectedModule.status === 'deployed' && (
                        <>
                          <Button 
                            variant="destructive"
                            onClick={() => handleRollback(selectedModule.deployment_id)}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Rollback
                          </Button>
                          {/* NEW: Feedback Button for deployed modules */}
                          <Button 
                            variant="outline"
                            onClick={() => setShowFeedbackModal(true)}
                          >
                            <Star className="w-4 h-4 mr-2" />
                            Rate Module
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="outline"
                        onClick={() => setShowImproveModal(true)}
                      >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Improve
                      </Button>
                      <Button 
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => handleDelete(selectedModule.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                    
                    {/* Auto-Integrate Toggle */}
                    <div className="flex items-center space-x-2 p-3 rounded-lg bg-accent">
                      <Switch
                        checked={autoIntegrate}
                        onCheckedChange={setAutoIntegrate}
                      />
                      <Label className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        Auto-Integration (add to sidebar & routing on deploy)
                      </Label>
                    </div>

                    {/* Module Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-accent">
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{selectedModule.module_type}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-accent">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge className={`${STATUS_COLORS[selectedModule.status]} text-white`}>
                          {selectedModule.status}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-accent">
                        <p className="text-xs text-muted-foreground">Files</p>
                        <p className="font-medium">{selectedModule.files?.length || 0} files</p>
                      </div>
                      <div className="p-3 rounded-lg bg-accent">
                        <p className="text-xs text-muted-foreground">API Endpoints</p>
                        <p className="font-medium">{selectedModule.api_endpoints?.length || 0} endpoints</p>
                      </div>
                    </div>

                    {/* Generated Files */}
                    {selectedModule.files && selectedModule.files.length > 0 && (
                      <Accordion type="single" collapsible className="w-full">
                        {selectedModule.files.map((file, idx) => (
                          <AccordionItem key={idx} value={`file-${idx}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-2">
                                <FileCode className="w-4 h-4" />
                                <span>{file.filename}</span>
                                <Badge variant="outline" className="text-xs">
                                  {file.language}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <CodeBlock code={file.content} language={file.language} />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}

                    {/* API Endpoints */}
                    {selectedModule.api_endpoints && selectedModule.api_endpoints.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Terminal className="w-4 h-4" />
                          API Endpoints
                        </h4>
                        <div className="space-y-1">
                          {selectedModule.api_endpoints.map((endpoint, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded bg-accent text-sm font-mono">
                              <Badge variant={endpoint.method === 'GET' ? 'secondary' : 'default'}>
                                {endpoint.method}
                              </Badge>
                              <span>{endpoint.path}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Test Results */}
                    {selectedModule.test_results && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <FlaskConical className="w-4 h-4" />
                          Test Results
                        </h4>
                        <div className="p-3 rounded-lg bg-accent">
                          <div className="flex items-center gap-4 mb-2">
                            <span className="text-green-500 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              {selectedModule.test_results.passed} passed
                            </span>
                            <span className="text-red-500 flex items-center gap-1">
                              <XCircle className="w-4 h-4" />
                              {selectedModule.test_results.failed} failed
                            </span>
                          </div>
                          <Progress 
                            value={
                              (selectedModule.test_results.passed / 
                              (selectedModule.test_results.passed + selectedModule.test_results.failed)) * 100
                            } 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template, idx) => {
              const Icon = MODULE_TYPE_ICONS[template.type] || Code2;
              return (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-purple-500" />
                      {template.name}
                    </CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Example Prompt:</p>
                        <p className="text-sm bg-accent p-2 rounded">{template.example_prompt}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Required Fields:</p>
                        <div className="flex flex-wrap gap-1">
                          {template.required_fields?.map((field, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          applyTemplate(template);
                          setActiveTab('generate');
                        }}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Improve Modal */}
      <Dialog open={showImproveModal} onOpenChange={setShowImproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Improve Module</DialogTitle>
            <DialogDescription>
              Provide feedback to improve the generated code
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Describe what changes or improvements you want...&#10;&#10;Example: Add pagination to the list view, improve error handling, add loading states, make the form more user-friendly"
              value={improveForm.feedback}
              onChange={(e) => setImproveForm({ feedback: e.target.value })}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImproveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleImprove}>
              <Wand2 className="w-4 h-4 mr-2" />
              Improve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Results Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Results</DialogTitle>
          </DialogHeader>
          {testResults && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-lg font-bold">{testResults.passed}</span>
                  <span>Passed</span>
                </div>
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="w-5 h-5" />
                  <span className="text-lg font-bold">{testResults.failed}</span>
                  <span>Failed</span>
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {testResults.tests?.map((test, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg ${
                        test.status === 'passed' ? 'bg-green-50 dark:bg-green-900/20' :
                        test.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' :
                        'bg-yellow-50 dark:bg-yellow-900/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {test.status === 'passed' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : test.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="font-medium">{test.name}</span>
                      </div>
                      {test.error && (
                        <p className="text-sm text-red-600 mt-1 font-mono">{test.error}</p>
                      )}
                      {test.warnings && (
                        <p className="text-sm text-yellow-600 mt-1">{test.warnings.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deployment Result Modal */}
      <Dialog open={showDeployModal} onOpenChange={setShowDeployModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deployment Result</DialogTitle>
          </DialogHeader>
          {deploymentResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${
                deploymentResult.status === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20' 
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className="flex items-center gap-2">
                  {deploymentResult.status === 'success' ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500" />
                  )}
                  <span className="text-lg font-medium capitalize">
                    {deploymentResult.status}
                  </span>
                </div>
              </div>
              {deploymentResult.deployed_files?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Deployed Files:</p>
                  <div className="space-y-1">
                    {deploymentResult.deployed_files.map((file, idx) => (
                      <div key={idx} className="text-sm font-mono bg-accent p-2 rounded">
                        {file.action}: {file.file}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* NEW: Integration Results */}
              {deploymentResult.integration_results && (
                <div>
                  <p className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    Auto-Integration Results:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2 rounded text-sm ${deploymentResult.integration_results.route_added ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100'}`}>
                      {deploymentResult.integration_results.route_added ? '✓' : '○'} Route Added
                    </div>
                    <div className={`p-2 rounded text-sm ${deploymentResult.integration_results.sidebar_added ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100'}`}>
                      {deploymentResult.integration_results.sidebar_added ? '✓' : '○'} Sidebar Entry
                    </div>
                  </div>
                </div>
              )}
              {/* NEW: Hot Reload Status */}
              {deploymentResult.hot_reload_status && (
                <div>
                  <p className="font-medium mb-2 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-500" />
                    Hot Reload Status:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2 rounded text-sm ${deploymentResult.hot_reload_status.frontend?.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100'}`}>
                      Frontend: {deploymentResult.hot_reload_status.frontend?.status || 'skipped'}
                    </div>
                    <div className={`p-2 rounded text-sm ${deploymentResult.hot_reload_status.backend?.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100'}`}>
                      Backend: {deploymentResult.hot_reload_status.backend?.status || 'skipped'}
                    </div>
                  </div>
                </div>
              )}
              {deploymentResult.errors?.length > 0 && (
                <div className="text-red-500">
                  <p className="font-medium mb-2">Errors:</p>
                  {deploymentResult.errors.map((err, idx) => (
                    <p key={idx} className="text-sm">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* NEW: Live Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Live Preview
            </DialogTitle>
            <DialogDescription>
              This is a static preview. Interactive features will work after deployment.
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[500px] border-0"
                title="Module Preview"
                sandbox="allow-scripts"
              />
            ) : (
              <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                No preview available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* NEW: Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Rate This Module
            </DialogTitle>
            <DialogDescription>
              Your feedback helps the AI generate better modules in the future.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label className="mb-4 block">How well does this module work? (1-5)</Label>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Button
                      key={rating}
                      variant={feedbackForm.rating >= rating ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFeedbackForm(prev => ({ ...prev, rating }))}
                      className={feedbackForm.rating >= rating ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                    >
                      <Star className={`w-4 h-4 ${feedbackForm.rating >= rating ? 'fill-current' : ''}`} />
                    </Button>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {feedbackForm.rating === 1 && "Poor"}
                  {feedbackForm.rating === 2 && "Fair"}
                  {feedbackForm.rating === 3 && "Good"}
                  {feedbackForm.rating === 4 && "Very Good"}
                  {feedbackForm.rating === 5 && "Excellent"}
                </span>
              </div>
            </div>
            <div>
              <Label>Additional Comments (optional)</Label>
              <Textarea
                placeholder="What could be improved? Any issues encountered?"
                value={feedbackForm.comments}
                onChange={(e) => setFeedbackForm(prev => ({ ...prev, comments: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback}>
              <Brain className="w-4 h-4 mr-2" />
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* NEW: Learning Stats Modal */}
      <Dialog open={showLearningModal} onOpenChange={setShowLearningModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              AI Learning Dashboard
            </DialogTitle>
            <DialogDescription>
              The AI Dev Studio learns from every deployment to improve future generations.
            </DialogDescription>
          </DialogHeader>
          {learningStats ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-purple-500">
                      {learningStats.total_modules_learned || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Modules Learned</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-green-500">
                      {learningStats.overall?.avg_score 
                        ? `${(learningStats.overall.avg_score * 100).toFixed(0)}%` 
                        : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Success Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-blue-500">
                      {learningStats.overall?.total_tests_passed || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Tests Passed</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* By Module Type */}
              {learningStats.by_type && Object.keys(learningStats.by_type).length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Learning by Module Type
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(learningStats.by_type).map(([type, stats]) => (
                      <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{type}</Badge>
                          <span className="text-sm">{stats.count} modules</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm">
                            Success: {stats.avg_score ? `${(stats.avg_score * 100).toFixed(0)}%` : 'N/A'}
                          </span>
                          {stats.avg_rating && (
                            <span className="text-sm flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500 fill-current" />
                              {stats.avg_rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground text-center">
                The AI uses this data to generate better code patterns and avoid past mistakes.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No learning data yet. Deploy modules to start building AI knowledge.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
