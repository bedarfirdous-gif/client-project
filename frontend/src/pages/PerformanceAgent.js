import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Zap, Gauge, Code, RefreshCw, TrendingUp, Package, Image, Database, Clock, Layers, FileCode, Play, CheckCircle, AlertTriangle, Target, Rocket } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PerformanceAgent() {
  const { token } = useAuth();
  // Fix: avoid `null` initial state which can cause a brief UI branch flip (flash)
  // when the component renders before async data arrives. Use stable empty objects instead.
  const [dashboard, setDashboard] = useState({});
  const [analysis, setAnalysis] = useState({});
  const [issues, setIssues] = useState([]);
  const [optimizations, setOptimizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoOptimizing, setAutoOptimizing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  // Keep selection state non-null to prevent conditional modal/content mounts from flickering.
  const [selectedIssue, setSelectedIssue] = useState({});
  const [selectedOptimization, setSelectedOptimization] = useState({});
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [generatingOptimization, setGeneratingOptimization] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/performance/dashboard`, {
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

  const fetchIssues = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/performance/issues`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
      }
    } catch (error) {
      console.error('Failed to fetch issues:', error);
    }
  }, [token]);

  const fetchOptimizations = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/performance/optimizations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOptimizations(data.optimizations || []);
      }
    } catch (error) {
      console.error('Failed to fetch optimizations:', error);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchIssues(), fetchOptimizations()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchIssues, fetchOptimizations]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`${API_URL}/api/performance/analyze`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        await Promise.all([fetchDashboard(), fetchIssues()]);
      }
    } catch (error) {
      console.error('Failed to run analysis:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const generateOptimization = async (issueId) => {
    setGeneratingOptimization(true);
    try {
      const response = await fetch(`${API_URL}/api/performance/issues/${issueId}/generate-optimization`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const optimization = await response.json();
        setSelectedOptimization(optimization);
        setShowOptimizationModal(true);
        await fetchOptimizations();
      }
    } catch (error) {
      console.error('Failed to generate optimization:', error);
    } finally {
      setGeneratingOptimization(false);
    }
  };

  const applyOptimization = async (optimizationId) => {
    try {
      const response = await fetch(`${API_URL}/api/performance/optimizations/${optimizationId}/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await Promise.all([fetchDashboard(), fetchIssues(), fetchOptimizations()]);
        setShowOptimizationModal(false);
      }
    } catch (error) {
      console.error('Failed to apply optimization:', error);
    }
  };

  const runAutoOptimize = async () => {
    setAutoOptimizing(true);
    try {
      const response = await fetch(`${API_URL}/api/performance/auto-optimize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        await Promise.all([fetchDashboard(), fetchIssues(), fetchOptimizations()]);
        alert(`Auto-optimization complete!\n${result.optimizations_applied} optimizations applied\n${result.improvements_ms}ms improvement`);
      }
    } catch (error) {
      console.error('Failed to auto-optimize:', error);
    } finally {
      setAutoOptimizing(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      'code_splitting': <Package className="w-4 h-4" />,
      'lazy_loading': <Layers className="w-4 h-4" />,
      'image_optimization': <Image className="w-4 h-4" />,
      'database_query': <Database className="w-4 h-4" />,
      'caching': <Clock className="w-4 h-4" />,
      'bundle_size': <Package className="w-4 h-4" />,
      'render_blocking': <AlertTriangle className="w-4 h-4" />,
      'memory_usage': <Gauge className="w-4 h-4" />,
      'api_response': <Zap className="w-4 h-4" />
    };
    return icons[type] || <Code className="w-4 h-4" />;
  };

  const getImpactColor = (impact) => {
    const colors = {
      'high': 'bg-red-500 text-white',
      'medium': 'bg-yellow-500 text-white',
      'low': 'bg-blue-500 text-white'
    };
    return colors[impact] || 'bg-gray-500 text-white';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="performance-agent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Rocket className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Performance Optimization Agent</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered speed enhancement for sub-3-second load times
            </p>
          </div>
          <Badge variant="outline" className="ml-2">AI-Powered</Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={runAnalysis}
            disabled={analyzing}
            data-testid="analyze-btn"
          >
            {analyzing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Gauge className="w-4 h-4 mr-2" />}
            Analyze
          </Button>
          <Button 
            size="sm"
            onClick={runAutoOptimize}
            disabled={autoOptimizing}
            data-testid="auto-optimize-btn"
          >
            {autoOptimizing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Auto-Optimize
          </Button>
        </div>
      </div>

      {/* Performance Score */}
      {dashboard && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Performance Score</p>
                <p className={`text-5xl font-bold ${getScoreColor(dashboard.current_score)}`}>
                  {dashboard.current_score}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Target Load Time</p>
                <p className="text-2xl font-bold text-green-600">&lt; {dashboard.target_load_time_ms / 1000}s</p>
              </div>
            </div>
            <Progress value={dashboard.current_score} className="h-3" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Poor (0-50)</span>
              <span>Fair (50-80)</span>
              <span>Good (80-100)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Issues</p>
                  <p className="text-3xl font-bold text-red-600">{dashboard.total_issues}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Optimized</p>
                  <p className="text-3xl font-bold text-green-600">{dashboard.optimized_issues}</p>
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
                  <p className="text-3xl font-bold text-yellow-600">{dashboard.pending_issues}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Potential Gain</p>
                  <p className="text-3xl font-bold text-blue-600">{dashboard.potential_improvement_ms}ms</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations ({optimizations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Issues by Type */}
          {dashboard?.by_type && Object.keys(dashboard.by_type).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Issues by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(dashboard.by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      {getTypeIcon(type)}
                      <div>
                        <p className="text-sm font-medium capitalize">{type.replace('_', ' ')}</p>
                        <p className="text-lg font-bold">{count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Issues by Impact */}
          {dashboard?.by_impact && Object.keys(dashboard.by_impact).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Issues by Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {['high', 'medium', 'low'].map((impact) => (
                    <div key={impact} className={`p-4 rounded-lg ${
                      impact === 'high' ? 'bg-red-50' : 
                      impact === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'
                    }`}>
                      <p className="text-sm font-medium capitalize">{impact} Impact</p>
                      <p className="text-3xl font-bold">{dashboard.by_impact[impact] || 0}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {analysis?.recommendations && analysis.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>Prioritized performance improvements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-full ${
                      rec.impact === 'high' ? 'bg-red-100' :
                      rec.impact === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}>
                      <Target className={`w-5 h-5 ${
                        rec.impact === 'high' ? 'text-red-600' :
                        rec.impact === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{rec.title}</p>
                        <Badge className={getImpactColor(rec.impact)}>{rec.impact}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      <p className="text-sm text-green-600 mt-1">
                        Estimated improvement: {rec.estimated_improvement}
                      </p>
                    </div>
                    {rec.auto_fixable && (
                      <Badge variant="outline" className="text-green-600">
                        <Zap className="w-3 h-3 mr-1" />
                        Auto-fixable
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          {issues.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium">No performance issues detected</p>
                <p className="text-muted-foreground">Run an analysis to scan for issues</p>
                <Button className="mt-4" onClick={runAnalysis} disabled={analyzing}>
                  {analyzing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Gauge className="w-4 h-4 mr-2" />}
                  Run Analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            issues.map((issue) => (
              <Card key={issue.issue_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        issue.impact_level === 'high' ? 'bg-red-100' :
                        issue.impact_level === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                      }`}>
                        {getTypeIcon(issue.optimization_type)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{issue.optimization_type?.replace('_', ' ')}</p>
                          <Badge className={getImpactColor(issue.impact_level)}>{issue.impact_level}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.description}</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {issue.component} - {issue.file_path?.split('/').pop()}
                        </p>
                        <p className="text-sm text-green-600">
                          Potential improvement: {issue.potential_improvement_ms}ms
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedIssue(issue);
                        generateOptimization(issue.issue_id);
                      }}
                      disabled={generatingOptimization || issue.status === 'applied'}
                      data-testid={`optimize-${issue.issue_id}`}
                    >
                      {generatingOptimization && selectedIssue?.issue_id === issue.issue_id ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Zap className="w-4 h-4 mr-2" />
                      )}
                      {issue.status === 'applied' ? 'Optimized' : 'Optimize'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="optimizations" className="space-y-4">
          {optimizations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Code className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium">No optimizations generated yet</p>
                <p className="text-muted-foreground">Generate optimizations from the Issues tab</p>
              </CardContent>
            </Card>
          ) : (
            optimizations.map((opt) => (
              <Card key={opt.optimization_id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{opt.optimization_type?.replace('_', ' ')}</p>
                        <Badge variant={opt.status === 'applied' ? 'default' : 'outline'}>
                          {opt.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{opt.description}</p>
                      {opt.optimized_code && (
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-w-lg">
                          {opt.optimized_code.slice(0, 300)}...
                        </pre>
                      )}
                      <p className="text-sm text-green-600">
                        Estimated improvement: {opt.estimated_improvement_ms}ms
                      </p>
                    </div>
                    {opt.status !== 'applied' && (
                      <Button size="sm" onClick={() => {
                        setSelectedOptimization(opt);
                        setShowOptimizationModal(true);
                      }}>
                        <Play className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Optimization Modal */}
      <Dialog open={showOptimizationModal} onOpenChange={setShowOptimizationModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Performance Optimization</DialogTitle>
            <DialogDescription>
              Review the AI-generated optimization before applying
            </DialogDescription>
          </DialogHeader>
          {selectedOptimization && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getImpactColor(selectedOptimization.impact_level || 'medium')}>
                  {selectedOptimization.optimization_type?.replace('_', ' ')}
                </Badge>
                <span className="text-sm text-green-600">
                  +{selectedOptimization.estimated_improvement_ms}ms improvement
                </span>
              </div>
              <p className="text-muted-foreground">{selectedOptimization.description}</p>
              {selectedOptimization.optimized_code && (
                <div>
                  <p className="font-medium mb-2">Optimized Code:</p>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-auto max-h-80">
                    {selectedOptimization.optimized_code}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOptimizationModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => applyOptimization(selectedOptimization?.optimization_id)}>
              <Play className="w-4 h-4 mr-2" />
              Apply Optimization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
