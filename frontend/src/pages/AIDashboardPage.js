import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Bot, Send, Brain, Activity, MessageSquare, Sparkles, 
  AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
  ChevronRight, History, Trash2, Users, TrendingUp, Zap,
  Shield, Settings, Eye, BarChart3, Loader2, ArrowRight,
  Cpu, Network, Database, Lightbulb, Target, Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';

// Agent definitions with icons and colors
const AGENTS = {
  assistant: {
    id: 'assistant',
    name: 'User Assistant',
    description: 'Help, guidance, troubleshooting',
    icon: Bot,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30'
  },
  business: {
    id: 'business',
    name: 'Business Intelligence',
    description: 'Sales analysis, forecasting, reports',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30'
  },
  operations: {
    id: 'operations',
    name: 'System Operations',
    description: 'Health checks, optimization, audit',
    icon: Settings,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30'
  },
  analytics: {
    id: 'analytics',
    name: 'Data Analytics',
    description: 'Pattern recognition, anomaly detection',
    icon: BarChart3,
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30'
  }
};

// Chat message component
const ChatMessage = ({ message, agentId }) => {
  const isUser = message.role === 'user';
  const agent = AGENTS[agentId] || AGENTS.assistant;
  const AgentIcon = agent.icon;
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`} data-testid={`chat-message-${message.id}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
              <AgentIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs text-muted-foreground">{agent.name}</span>
            {message.confidence && (
              <Badge variant="outline" className="text-[10px] h-4">
                {Math.round(message.confidence * 100)}% confident
              </Badge>
            )}
          </div>
        )}
        <div 
          className={`rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-primary text-primary-foreground rounded-br-md' 
              : 'bg-muted rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs font-medium mb-2 opacity-80">Suggestions:</p>
              <ul className="text-xs space-y-1 opacity-80">
                {message.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 px-2">
          {new Date(message.timestamp).toLocaleTimeString()}
          {message.collaborated_with?.length > 0 && (
            <span className="ml-2">
              <Network className="w-3 h-3 inline mr-1" />
              Collaborated with: {message.collaborated_with.join(', ')}
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

// AutoHeal Report Card
const AutoHealReportCard = ({ report, onViewDetails }) => {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getStatusIcon = (resolved, escalated) => {
    if (resolved) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (escalated) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };
  
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetails(report)} data-testid={`autoheal-report-${report.report_id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(report.severity)}`} />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{report.error_type}</p>
                {getStatusIcon(report.resolved, report.escalated)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {report.root_cause || report.message}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px]">
                  {Math.round((report.root_cause_confidence || 0) * 100)}% confidence
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(report.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

// AutoHeal Stats Card
const AutoHealStats = ({ stats }) => {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Total Errors</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total_errors || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Auto-Resolved</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.auto_resolved || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Escalated</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.escalated || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Avg Fix Time</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.avg_fix_time_ms ? `${Math.round(stats.avg_fix_time_ms)}ms` : 'N/A'}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default function AIDashboardPage() {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  
  // Chat state
  const [selectedAgent, setSelectedAgent] = useState('assistant');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Avoid null initial state to prevent conditional UI branches from flipping (flash) on first data load
  const [conversationId, setConversationId] = useState('');
  const [isConversationLoaded, setIsConversationLoaded] = useState(false);
  const chatEndRef = useRef(null);
  
  // Collaboration state
  const [collaborationMode, setCollaborationMode] = useState(false);
  const [collaborationHistory, setCollaborationHistory] = useState([]);
  const [isCollaborationLoaded, setIsCollaborationLoaded] = useState(false);
  
  // AutoHeal state
  const [autoHealReports, setAutoHealReports] = useState([]);
  // Keep a stable initial shape; use an explicit loaded flag for skeleton/placeholder rendering
  const [autoHealStats, setAutoHealStats] = useState({});
  const [isAutoHealStatsLoaded, setIsAutoHealStatsLoaded] = useState(false);
  // FIX: remove stray `useState(null);` (creates an unused hook slot and can cause render inconsistencies/flicker)

  const [loadingReports, setLoadingReports] = useState(false);

  // FIX: avoid initializing to `null` to prevent conditional UI flashes; track readiness explicitly instead
  const [selectedReport, setSelectedReport] = useState({});
  const [isSelectedReportLoaded, setIsSelectedReportLoaded] = useState(false);
  
  // Agent memory state
  const [agentMemory, setAgentMemory] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(false);

  // Fetch AutoHeal reports
  const fetchAutoHealReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const [reports, stats] = await Promise.all([
        api('/api/autoheal/reports?limit=20'),
        api('/api/autoheal/stats')
      ]);
      setAutoHealReports(reports.reports || []);
      setAutoHealStats(stats);
    } catch (err) {
      console.error('Failed to fetch AutoHeal reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, [api]);

  // Fetch agent memory
  const fetchAgentMemory = useCallback(async () => {
    setLoadingMemory(true);
    try {
      const memory = await api(`/api/ai-agents/${selectedAgent}/memory?limit=10`);
      setAgentMemory(memory.memories || []);
    } catch (err) {
      console.error('Failed to fetch agent memory:', err);
    } finally {
      setLoadingMemory(false);
    }
  }, [api, selectedAgent]);

  // Fetch collaboration history
  const fetchCollaborationHistory = useCallback(async () => {
    try {
      const history = await api('/api/ai-agents/collaboration/history?limit=10');
      setCollaborationHistory(history.history || []);
    } catch (err) {
      console.error('Failed to fetch collaboration history:', err);
    }
  }, [api]);

  // Send message to agent
  const sendMessage = async () => {
    if (!inputMessage.trim() || sending) return;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setSending(true);
    
    try {
      const endpoint = collaborationMode 
        ? `/api/ai-agents/${selectedAgent}/collaborate`
        : `/api/ai-agents/${selectedAgent}/process`;
      
      const response = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          prompt: inputMessage,
          conversation_id: conversationId,
          ...(collaborationMode && { collaboration_type: 'collaborate' })
        })
      });
      
      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id);
      }
      
      const agentMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        confidence: response.confidence,
        suggestions: response.suggestions,
        collaborated_with: response.collaborated_with,
        reasoning: response.reasoning
      };
      
      setMessages(prev => [...prev, agentMessage]);
      
    } catch (err) {
      toast.error('Failed to get response from agent');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // Clear conversation
  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  // Initial load
  useEffect(() => {
    fetchAutoHealReports();
    fetchCollaborationHistory();
  }, [fetchAutoHealReports, fetchCollaborationHistory]);

  // Load agent memory when agent changes
  useEffect(() => {
    if (activeTab === 'memory') {
      fetchAgentMemory();
    }
  }, [selectedAgent, activeTab, fetchAgentMemory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="space-y-6" data-testid="ai-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            AI Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Chat with AI agents and monitor system health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={collaborationMode ? "default" : "outline"} className="cursor-pointer" onClick={() => setCollaborationMode(!collaborationMode)}>
            <Network className="w-3 h-3 mr-1" />
            {collaborationMode ? 'Collaboration ON' : 'Collaboration OFF'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => { fetchAutoHealReports(); fetchCollaborationHistory(); }}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="chat" className="gap-2" data-testid="tab-chat">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="autoheal" className="gap-2" data-testid="tab-autoheal">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">AutoHeal</span>
          </TabsTrigger>
          <TabsTrigger value="collaboration" className="gap-2" data-testid="tab-collaboration">
            <Network className="w-4 h-4" />
            <span className="hidden sm:inline">Collaboration</span>
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-2" data-testid="tab-memory">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Memory</span>
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Agent Selection Sidebar */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Select Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.values(AGENTS).map((agent) => {
                  const AgentIcon = agent.icon;
                  return (
                    <div
                      key={agent.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedAgent === agent.id 
                          ? `${agent.bgColor} ring-2 ring-primary/50` 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => { setSelectedAgent(agent.id); clearConversation(); }}
                      data-testid={`agent-selector-${agent.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                          <AgentIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const agent = AGENTS[selectedAgent];
                      const AgentIcon = agent.icon;
                      return (
                        <>
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                            <AgentIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{agent.name}</CardTitle>
                            <CardDescription className="text-xs">{agent.description}</CardDescription>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {collaborationMode && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Multi-Agent Mode
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={clearConversation}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Messages */}
                <ScrollArea className="h-[400px] p-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      <Bot className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Start a conversation with {AGENTS[selectedAgent].name}</p>
                      <p className="text-xs mt-1">Ask questions, get insights, or request analysis</p>
                      {collaborationMode && (
                        <Badge variant="outline" className="mt-3">
                          <Network className="w-3 h-3 mr-1" />
                          Collaboration mode: Agent will consult other agents
                        </Badge>
                      )}
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <ChatMessage key={msg.id} message={msg} agentId={selectedAgent} />
                    ))
                  )}
                  {sending && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Agent is thinking...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </ScrollArea>
                
                {/* Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={`Ask ${AGENTS[selectedAgent].name}...`}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      disabled={sending}
                      data-testid="chat-input"
                    />
                    <Button onClick={sendMessage} disabled={sending || !inputMessage.trim()} data-testid="chat-send-btn">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AutoHeal Tab */}
        <TabsContent value="autoheal" className="mt-4 space-y-4">
          <AutoHealStats stats={autoHealStats} />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Recent Error Reports
                  </CardTitle>
                  <CardDescription>AI-powered error detection and healing</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAutoHealReports} disabled={loadingReports}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loadingReports ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : autoHealReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No errors detected. System is healthy!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {autoHealReports.map((report) => (
                    <AutoHealReportCard 
                      key={report.report_id} 
                      report={report} 
                      onViewDetails={setSelectedReport}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collaboration Tab */}
        <TabsContent value="collaboration" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Agent Collaboration History
              </CardTitle>
              <CardDescription>View when agents worked together</CardDescription>
            </CardHeader>
            <CardContent>
              {collaborationHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Network className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No collaboration history yet</p>
                  <p className="text-xs mt-1">Enable collaboration mode and ask complex questions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collaborationHistory.map((collab, idx) => (
                    <Card key={idx} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge>{collab.from_agent || collab.delegating_agent}</Badge>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <Badge variant="outline">{collab.to_agent || collab.delegated_to}</Badge>
                            </div>
                            <p className="text-sm">{collab.content || collab.task}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(collab.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {collab.success !== undefined && (
                          <div className="mt-2">
                            <Badge variant={collab.success ? "default" : "destructive"}>
                              {collab.success ? 'Successful' : 'Failed'}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Memory Tab */}
        <TabsContent value="memory" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    {AGENTS[selectedAgent].name} Memory
                  </CardTitle>
                  <CardDescription>Persistent memory and learned patterns</CardDescription>
                </div>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AGENTS).map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMemory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : agentMemory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No memories stored yet</p>
                  <p className="text-xs mt-1">Start chatting to create persistent memories</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agentMemory.map((memory, idx) => (
                    <Card key={idx} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{memory.memory_type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                Importance: {Math.round((memory.importance || 0.5) * 100)}%
                              </span>
                            </div>
                            <p className="text-sm">
                              {typeof memory.content === 'string' 
                                ? memory.content 
                                : JSON.stringify(memory.content).slice(0, 200)}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                            {new Date(memory.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Detail Modal */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Error Report Details
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Error Type</p>
                  <p className="font-medium">{selectedReport.error_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Severity</p>
                  <Badge variant={selectedReport.severity === 'critical' ? 'destructive' : 'outline'}>
                    {selectedReport.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedReport.resolved ? 'default' : selectedReport.escalated ? 'secondary' : 'outline'}>
                    {selectedReport.resolved ? 'Resolved' : selectedReport.escalated ? 'Escalated' : 'Pending'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <div className="flex items-center gap-2">
                    <Progress value={(selectedReport.root_cause_confidence || 0) * 100} className="w-24 h-2" />
                    <span className="text-sm">{Math.round((selectedReport.root_cause_confidence || 0) * 100)}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Root Cause</p>
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <p className="text-sm">{selectedReport.root_cause || 'Analysis in progress...'}</p>
                  </CardContent>
                </Card>
              </div>
              
              {selectedReport.fix_applied && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fix Applied</p>
                  <Card className="bg-green-50 dark:bg-green-950/30">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{selectedReport.fix_applied.fix_type}</p>
                      <p className="text-sm mt-1">{selectedReport.fix_applied.description}</p>
                      {selectedReport.fix_applied.ai_reasoning && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          AI Reasoning: {selectedReport.fix_applied.ai_reasoning}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {selectedReport.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recommendations</p>
                  <ul className="space-y-2">
                    {selectedReport.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        {typeof rec === 'string' ? rec : rec.recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
