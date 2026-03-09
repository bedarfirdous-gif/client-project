import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Zap, Play, RefreshCw, CheckCircle, XCircle, Clock, ArrowRight, GitBranch, Activity, Brain, Bug, Gauge, Sparkles, Network, Workflow } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AgentCollaboration() {
  const { token } = useAuth();
  // FIX: Avoid null initial state to prevent conditional-render flashes between renders.
  // Use stable initial shapes and a dedicated loaded flag to control the first paint.
  const [dashboard, setDashboard] = useState({});
  const [workflows, setWorkflows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  // FIX: Avoid null initial state (can cause conditional-render/UI flash when toggling executing state).
  // Use a stable primitive; empty string means "no workflow executing".
  const [executing, setExecuting] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [executionResult, setExecutionResult] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/agent-collaboration/dashboard`, {
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

  const fetchWorkflows = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/agent-collaboration/workflows`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    }
  }, [token]);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/agent-collaboration/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchWorkflows(), fetchTasks()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchWorkflows, fetchTasks]);

  const executeWorkflow = async (workflowName) => {
    setExecuting(workflowName);
    try {
      const response = await fetch(`${API_URL}/api/agent-collaboration/workflows/${workflowName}/execute`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setExecutionResult(result);
        setShowResultModal(true);
        await Promise.all([fetchDashboard(), fetchTasks()]);
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    } finally {
      setExecuting(null);
    }
  };

  const getAgentIcon = (agentName) => {
    const icons = {
      'ui_blink_fix': <Zap className="w-4 h-4 text-yellow-500" />,
      'ui_blink': <Zap className="w-4 h-4 text-yellow-500" />,
      'error_autofix': <Bug className="w-4 h-4 text-red-500" />,
      'performance': <Gauge className="w-4 h-4 text-blue-500" />,
      'autoheal': <Activity className="w-4 h-4 text-green-500" />
    };
    return icons[agentName] || <Brain className="w-4 h-4 text-purple-500" />;
  };

  const getModeIcon = (mode) => {
    const icons = {
      'parallel': <Network className="w-4 h-4" />,
      'sequential': <ArrowRight className="w-4 h-4" />,
      'pipeline': <GitBranch className="w-4 h-4" />,
      'consensus': <Users className="w-4 h-4" />
    };
    return icons[mode] || <Workflow className="w-4 h-4" />;
  };

  const getModeColor = (mode) => {
    const colors = {
      'parallel': 'bg-blue-100 text-blue-700',
      'sequential': 'bg-green-100 text-green-700',
      'pipeline': 'bg-purple-100 text-purple-700',
      'consensus': 'bg-orange-100 text-orange-700'
    };
    return colors[mode] || 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'bg-green-500 text-white',
      'in_progress': 'bg-blue-500 text-white',
      'pending': 'bg-yellow-500 text-white',
      'failed': 'bg-red-500 text-white'
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
    <div className="p-6 space-y-6" data-testid="agent-collaboration">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agent Collaboration</h1>
            <p className="text-sm text-muted-foreground">
              Multi-agent orchestration for complex autonomous tasks
            </p>
          </div>
          <Badge variant="outline" className="ml-2 bg-gradient-to-r from-purple-50 to-indigo-50">
            <Sparkles className="w-3 h-3 mr-1" />
            Advanced AI
          </Badge>
        </div>
        <Button 
          size="sm"
          onClick={() => Promise.all([fetchDashboard(), fetchWorkflows(), fetchTasks()])}
          data-testid="refresh-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available Agents</p>
                  <p className="text-3xl font-bold text-purple-600">{dashboard.available_agents?.length || 0}</p>
                </div>
                <Brain className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                  <p className="text-3xl font-bold text-blue-600">{dashboard.total_tasks}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{dashboard.completed_tasks}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-3xl font-bold text-indigo-600">{dashboard.success_rate?.toFixed(1)}%</p>
                </div>
                <Sparkles className="w-8 h-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Agents */}
      {dashboard?.available_agents && dashboard.available_agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              Connected Agents
            </CardTitle>
            <CardDescription>AI agents ready for collaboration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {dashboard.available_agents.map((agent) => (
                <div key={agent} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-full border">
                  {getAgentIcon(agent)}
                  <span className="font-medium capitalize">{agent.replace('_', ' ')}</span>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="workflows">Workflows ({workflows.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Run predefined collaboration workflows</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                className="h-auto py-4 justify-start"
                variant="outline"
                onClick={() => executeWorkflow('full_health_check')}
                disabled={executing === 'full_health_check'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Full Health Check</p>
                    <p className="text-xs text-muted-foreground">Run all agents in parallel</p>
                  </div>
                </div>
                {executing === 'full_health_check' && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
              
              <Button 
                className="h-auto py-4 justify-start"
                variant="outline"
                onClick={() => executeWorkflow('auto_fix_all')}
                disabled={executing === 'auto_fix_all'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Auto-Fix All</p>
                    <p className="text-xs text-muted-foreground">Fix all detected issues</p>
                  </div>
                </div>
                {executing === 'auto_fix_all' && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
              
              <Button 
                className="h-auto py-4 justify-start"
                variant="outline"
                onClick={() => executeWorkflow('frontend_optimization')}
                disabled={executing === 'frontend_optimization'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Gauge className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Frontend Optimization</p>
                    <p className="text-xs text-muted-foreground">Performance + UI fixes</p>
                  </div>
                </div>
                {executing === 'frontend_optimization' && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
              
              <Button 
                className="h-auto py-4 justify-start"
                variant="outline"
                onClick={() => executeWorkflow('error_recovery')}
                disabled={executing === 'error_recovery'}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Bug className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Error Recovery</p>
                    <p className="text-xs text-muted-foreground">Detect and fix errors</p>
                  </div>
                </div>
                {executing === 'error_recovery' && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
            </CardContent>
          </Card>

          {/* Agent Activity */}
          {dashboard?.agent_activity && Object.keys(dashboard.agent_activity).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Agent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(dashboard.agent_activity).map(([agent, count]) => (
                    <div key={agent} className="flex items-center gap-3">
                      {getAgentIcon(agent)}
                      <span className="flex-1 capitalize">{agent.replace('_', ' ')}</span>
                      <Badge variant="outline">{count} messages</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          {workflows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Workflow className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium">No workflows available</p>
              </CardContent>
            </Card>
          ) : (
            workflows.map((workflow) => (
              <Card key={workflow.name} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium capitalize">{workflow.name.replace(/_/g, ' ')}</h3>
                        <Badge className={getModeColor(workflow.mode)}>
                          {getModeIcon(workflow.mode)}
                          <span className="ml-1">{workflow.mode}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Agents:</span>
                        {workflow.agents.map((agent) => (
                          <Badge key={agent} variant="outline" className="text-xs">
                            {getAgentIcon(agent)}
                            <span className="ml-1 capitalize">{agent.replace('_', ' ')}</span>
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{workflow.steps_count} steps</p>
                    </div>
                    <Button
                      onClick={() => executeWorkflow(workflow.name)}
                      disabled={executing === workflow.name}
                      data-testid={`execute-${workflow.name}`}
                    >
                      {executing === workflow.name ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Execute
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium">No tasks executed yet</p>
                <p className="text-muted-foreground">Run a workflow to create collaborative tasks</p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.task_id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium capitalize">{task.task_type?.replace(/_/g, ' ')}</h3>
                        <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                        <Badge className={getModeColor(task.mode)}>{task.mode}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                      {task.agents_involved && (
                        <div className="flex gap-1">
                          {task.agents_involved.map((agent) => (
                            <Badge key={agent} variant="outline" className="text-xs">
                              {getAgentIcon(agent)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(task.created_at).toLocaleString()}
                        {task.completed_at && ` | Completed: ${new Date(task.completed_at).toLocaleString()}`}
                      </p>
                    </div>
                    {task.results && (
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          Steps: {task.results.steps_completed}/{task.results.steps_total}
                        </p>
                        {task.results.errors?.length > 0 && (
                          <p className="text-xs text-red-500">{task.results.errors.length} errors</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Execution Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {executionResult?.steps_completed === executionResult?.steps_total ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              Workflow Execution Complete
            </DialogTitle>
            <DialogDescription>
              {executionResult?.workflow?.replace(/_/g, ' ')} - {executionResult?.mode} mode
            </DialogDescription>
          </DialogHeader>
          {executionResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Progress</p>
                  <Progress 
                    value={(executionResult.steps_completed / executionResult.steps_total) * 100} 
                    className="h-2"
                  />
                </div>
                <span className="font-medium">
                  {executionResult.steps_completed}/{executionResult.steps_total} steps
                </span>
              </div>
              
              {executionResult.agent_results && Object.keys(executionResult.agent_results).length > 0 && (
                <div>
                  <p className="font-medium mb-2">Agent Results:</p>
                  <div className="space-y-2">
                    {Object.entries(executionResult.agent_results).map(([agent, result]) => (
                      <div key={agent} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        {getAgentIcon(agent)}
                        <span className="capitalize">{agent.replace('_', ' ')}</span>
                        <Badge variant={result.status === 'completed' ? 'default' : 'destructive'}>
                          {result.status}
                        </Badge>
                        {result.issues_found !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {result.issues_found} issues found
                          </span>
                        )}
                        {result.fixes_applied !== undefined && (
                          <span className="text-xs text-green-600">
                            {result.fixes_applied} fixes applied
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {executionResult.errors?.length > 0 && (
                <div>
                  <p className="font-medium text-red-600 mb-2">Errors:</p>
                  <div className="space-y-1">
                    {executionResult.errors.map((error, idx) => (
                      <p key={idx} className="text-sm text-red-500">
                        {error.agent}: {error.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowResultModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
