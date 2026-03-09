import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Bot, Send, Loader2, Sparkles, RefreshCw, Trash2, MessageSquare,
  Brain, Server, TrendingUp, Wrench, ChevronDown, ChevronRight,
  Clock, CheckCircle, AlertCircle, Activity, Zap, User, History,
  X, Maximize2, Minimize2, Settings
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

// Agent type icons and colors
const AGENT_CONFIG = {
  orchestrator: { icon: Brain, color: '#8b5cf6', label: 'Orchestrator', description: 'Coordinates all agents' },
  business: { icon: TrendingUp, color: '#22c55e', label: 'Business Agent', description: 'Business automation & insights' },
  assistant: { icon: MessageSquare, color: '#3b82f6', label: 'Assistant Agent', description: 'User assistance & guidance' },
  operations: { icon: Server, color: '#f59e0b', label: 'Operations Agent', description: 'System operations & health' },
  analytics: { icon: Activity, color: '#ec4899', label: 'Analytics Agent', description: 'Data analysis & patterns' },
  automation: { icon: Zap, color: '#06b6d4', label: 'Automation Agent', description: 'Task automation' }
};

const STATUS_CONFIG = {
  idle: { color: '#22c55e', label: 'Idle' },
  thinking: { color: '#f59e0b', label: 'Thinking' },
  executing: { color: '#3b82f6', label: 'Executing' },
  waiting: { color: '#8b5cf6', label: 'Waiting' },
  completed: { color: '#22c55e', label: 'Completed' },
  error: { color: '#ef4444', label: 'Error' }
};

export default function EmbeddedAIAssistant() {
  const { api } = useAuth();
  const [messages, setMessages] = useState([]);
  const [interval, setInterval] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Use a stable non-null sentinel to represent "no active session".
  // This avoids a null->string transition that can cause conditional UI flashes.
  const [sessionId, setSessionId] = useState('');
  const [agentStatus, setAgentStatus] = useState({});
  const [sessions, setSessions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch agent status
  const fetchAgentStatus = useCallback(async () => {
    try {
      const data = await api('/api/superadmin/ai-agent/status');
      setAgentStatus(data);
    } catch (err) {
      console.error('Failed to fetch agent status:', err);
    }
  }, [api]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const data = await api('/api/superadmin/ai-agent/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [api]);

  // Load conversation history
  const loadHistory = useCallback(async (sid) => {
    try {
      const data = await api(`/api/superadmin/ai-agent/history/${sid}`);
      const history = data.history || [];
      setMessages(history.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        agentType: msg.agent_type,
        timestamp: msg.timestamp
      })));
      setSessionId(sid);
      setShowHistory(false);
    } catch (err) {
      toast.error('Failed to load conversation history');
    }
  }, [api]);

  useEffect(() => {
    fetchAgentStatus();
    fetchSessions();
    
    // Refresh status every 30 seconds
    const interval = setInterval(fetchAgentStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchAgentStatus, fetchSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await api('/api/superadmin/ai-agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMessage.content,
          session_id: sessionId
        })
      });

      // Update session ID if new
      if (!sessionId && response.session_id) {
        setSessionId(response.session_id);
      }

      const assistantMessage = {
        id: Date.now().toString() + '-response',
        role: 'assistant',
        content: response.response,
        agentType: response.agent_type,
        agent: response.agent,
        decision: response.decision,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      fetchSessions(); // Refresh sessions list
    } catch (err) {
      toast.error('Failed to get response from AI');
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        isError: true,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setSessionId(null);
  };

  const deleteSession = async (sid) => {
    try {
      await api(`/api/superadmin/ai-agent/session/${sid}`, { method: 'DELETE' });
      toast.success('Session deleted');
      if (sid === sessionId) {
        startNewConversation();
      }
      fetchSessions();
    } catch (err) {
      toast.error('Failed to delete session');
    }
  };

  const getAgentIcon = (agentType) => {
    const config = AGENT_CONFIG[agentType] || AGENT_CONFIG.assistant;
    const Icon = config.icon;
    return <Icon className="w-4 h-4" style={{ color: config.color }} />;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Quick action suggestions
  const quickActions = [
    { label: 'Sales Report', prompt: 'Generate a sales summary for this week' },
    { label: 'Inventory Status', prompt: 'Check current inventory status and low stock alerts' },
    { label: 'System Health', prompt: 'Check overall system health and any issues' },
    { label: 'Customer Insights', prompt: 'Show me customer behavior insights' },
    { label: 'Error Summary', prompt: 'Show recent error summary and issues' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            Embedded AI Assistant
          </h2>
          <p className="text-muted-foreground">Swarm intelligence powered by internal AI agents</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAgentStatus}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
            <History className="w-4 h-4 mr-1" />
            History
          </Button>
        </div>
      </div>

      {/* Agent Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(agentStatus.agents || {}).map(([agentId, status]) => {
          const config = AGENT_CONFIG[status.type] || AGENT_CONFIG.assistant;
          const Icon = config.icon;
          const statusConfig = STATUS_CONFIG[status.status] || STATUS_CONFIG.idle;
          
          return (
            <Card key={agentId} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${config.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: config.color }} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{status.tasks_completed} tasks</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${statusConfig.color}20`,
                      color: statusConfig.color,
                      borderColor: statusConfig.color
                    }}
                  >
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Chat Interface */}
      <Card className={`transition-all ${isExpanded ? 'fixed inset-4 z-50' : ''}`}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-500" />
              AI Chat
              {sessionId && (
                <Badge variant="outline" className="text-xs ml-2">
                  Session: {sessionId.slice(-8)}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Ask anything about your business</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={startNewConversation}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Messages Area */}
          <ScrollArea className={`px-4 ${isExpanded ? 'h-[calc(100vh-280px)]' : 'h-[400px]'}`}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">How can I help you today?</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  I can analyze your business data, generate reports, check system health, and more.
                </p>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickActions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInputValue(action.prompt);
                        inputRef.current?.focus();
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : message.isError
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-muted'
                      }`}
                    >
                      {message.role === 'assistant' && message.agentType && (
                        <div className="flex items-center gap-1 mb-1 text-xs opacity-70">
                          {getAgentIcon(message.agentType)}
                          <span>{AGENT_CONFIG[message.agentType]?.label || 'AI'}</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-50 mt-1">{formatTime(message.timestamp)}</p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      <span className="text-sm text-muted-foreground">Agents are thinking...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me anything about your business..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Conversation History
            </DialogTitle>
            <DialogDescription>
              Select a previous conversation to continue
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                <p>No previous conversations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session._id}
                    className="p-3 bg-accent rounded-lg hover:bg-accent/80 cursor-pointer group"
                    onClick={() => loadHistory(session._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session.last_message?.slice(0, 50)}...
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(session.last_timestamp).toLocaleString()}
                          <Badge variant="secondary" className="text-xs">
                            {session.message_count} messages
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session._id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
