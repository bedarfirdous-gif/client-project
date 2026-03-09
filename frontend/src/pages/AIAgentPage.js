import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Bot, Send, Sparkles, MessageSquare, BarChart3, Lightbulb, AlertTriangle,
  TrendingUp, Target, Package, Users, IndianRupee, RefreshCw, Plus, Trash2,
  Image, Download, Palette, Eye, ChevronRight, Clock, CheckCircle, XCircle,
  Brain, Zap, Settings, History, X, Maximize2, Minimize2, Mic, MicOff, Volume2, Loader2
} from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Chat message component
const ChatMessage = ({ message, isUser }) => {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs text-muted-foreground">AI Assistant</span>
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
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 px-2">
          {new Date(message.timestamp).toLocaleTimeString()}
          {message.model_used && !isUser && (
            <span className="ml-2 opacity-70">• {message.model_used}</span>
          )}
        </p>
      </div>
    </div>
  );
};

// Insight card component
const InsightCard = ({ insight, onDismiss, onRead }) => {
  const getIcon = () => {
    switch (insight.insight_type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'opportunity': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'loophole': return <Target className="w-5 h-5 text-red-500" />;
      default: return <Lightbulb className="w-5 h-5 text-blue-500" />;
    }
  };
  
  const getBgColor = () => {
    switch (insight.insight_type) {
      case 'warning': return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
      case 'opportunity': return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
      case 'loophole': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
      default: return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
    }
  };
  
  return (
    <Card className={`${getBgColor()} border ${!insight.is_read ? 'ring-2 ring-primary/20' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{insight.title}</h4>
              <Badge variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'default' : 'secondary'} className="text-[10px]">
                {insight.impact.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
            {insight.recommendations?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Recommendations:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {insight.recommendations.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-50 hover:opacity-100"
            onClick={() => onDismiss(insight.id)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function AIAgentPage() {
  // Auth state - use loading flag to avoid flicker
  const { user, loading: authLoading } = useAuth();
  const { formatCurrency, getCurrencyInfo, currencySymbol } = useCurrency();

  // ALL HOOKS MUST BE DECLARED BEFORE EARLY RETURNS
  const [activeTab, setActiveTab] = useState('chat');
  const [timeout, setTimeout] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Dashboard data
  // Fix: avoid null initial state to prevent a render-pass where UI briefly shows "empty" before data arrives.
  // Use a loaded flag so consumers can reliably show skeletons/loading UI.
  const [dashboardData, setDashboardData] = useState({});
  const [isDashboardLoaded, setIsDashboardLoaded] = useState(false);
  const [insights, setInsights] = useState([]);
  
  // Chat state
  const [sessions, setSessions] = useState([]);
  // Fix: keep a stable shape instead of null to avoid conditional rendering flashes.
  const [activeSession, setActiveSession] = useState({});
  const [isChatLoaded, setIsChatLoaded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-5.2');
  const [chatExpanded, setChatExpanded] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  // Fix: undefined is safer than null for optional blob usage and avoids null-check UI branches.
  const [audioBlob, setAudioBlob] = useState(undefined);
  const [processingVoice, setProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Autonomous Agent state
  const [autonomousPrompt, setAutonomousPrompt] = useState('');
  // Fix: stable object + loaded flag avoids a flash when plan UI conditionally renders.
  const [activePlan, setActivePlan] = useState({});
  const [isPlanLoaded, setIsPlanLoaded] = useState(false);
  const [executionResults, setExecutionResults] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(false);
  
  // Poster generation state
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [showBatchPosterModal, setShowBatchPosterModal] = useState(false);
  // Poster generation state
  const [posterForm, setPosterForm] = useState({
    prompt: '',
    style: 'professional',
    format: 'instagram_post',
    image_model: 'nano-banana',
    include_business_name: true
  });
  const [generatingPoster, setGeneratingPoster] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState(null);
  // Batch poster state
  const [batchPosters, setBatchPosters] = useState([
    { id: 1, prompt: '', style: 'professional', format: 'instagram_post' }
  ]);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [batchResults, setBatchResults] = useState([]);
  const [batchProgress, setBatchProgress] = useState(0);
  
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('token');
  const canManage = ['superadmin', 'admin', 'manager'].includes(user?.role);

  const api = useCallback(async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers 
      },
      ...options
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  }, [token]);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api('/api/ai-agent/dashboard');
      setDashboardData(data);
      setInsights(data.insights || []);
      setSessions(data.recent_sessions || []);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    }
  }, [api]);

  // Fetch chat sessions
  const fetchSessions = useCallback(async () => {
    try {
      const data = await api('/api/ai-agent/chat/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [api]);

  // Load a chat session
  const loadSession = useCallback(async (sessionId) => {
    try {
      const data = await api(`/api/ai-agent/chat/sessions/${sessionId}`);
      setActiveSession(data);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load session:', err);
      toast.error('Failed to load chat session');
    }
  }, [api]);

  // Create new chat session
  const createNewSession = useCallback(async () => {
    try {
      const data = await api('/api/ai-agent/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ chat_type: 'general' })
      });
      setActiveSession(data);
      setMessages([]);
      setSessions(prev => [data, ...prev]);
      toast.success('New chat created');
    } catch (err) {
      console.error('Failed to create session:', err);
      toast.error('Failed to create chat');
    }
  }, [api]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || sending) return;
    
    const userMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setSending(true);
    
    try {
      const data = await api('/api/ai-agent/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          session_id: activeSession?.id,
          message: inputMessage,
          chat_type: 'general',
          model: selectedModel,
          include_context: true
        })
      });
      
      // Update session if new
      if (!activeSession) {
        setActiveSession({ id: data.session_id });
        fetchSessions();
      }
      
      // Update messages
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== userMsg.id);
        return [...filtered, data.user_message, data.assistant_message];
      });
      
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
      // Remove temporary message on error
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  }, [api, inputMessage, activeSession, selectedModel, sending, fetchSessions]);

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info('Recording... Click mic again to stop');
    } catch (err) {
      toast.error('Could not access microphone. Please allow microphone access.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const sendVoiceMessage = useCallback(async () => {
    if (!audioBlob) return;
    
    setProcessingVoice(true);
    setSending(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('agent_type', 'business');
      if (activeSession?.id) {
        formData.append('conversation_id', activeSession.id);
      }
      // Include preferred LLM model (skip 'auto' to let backend decide)
      if (selectedModel && selectedModel !== 'auto') {
        formData.append('preferred_model', selectedModel);
      }

      const res = await fetch(`${API_URL}/api/ai-agents/voice/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Voice processing failed');
      }
      
      const data = await res.json();
      
      // Add user message (transcribed)
      const userMsg = {
        id: `voice-${Date.now()}`,
        role: 'user',
        content: `🎤 "${data.transcribed_text}"`,
        timestamp: new Date().toISOString()
      };
      
      // Add AI response with model info
      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.agent_response?.message || 'Processed your voice command.',
        timestamp: new Date().toISOString(),
        model_used: data.model_used || data.agent_response?.data?.model_used,
        metadata: {
          actions: data.agent_response?.actions_taken,
          suggestions: data.agent_response?.suggestions,
          data: data.agent_response?.data
        }
      };
      
      setMessages(prev => [...prev, userMsg, aiMsg]);
      setAudioBlob(null);
      toast.success(`Voice processed via ${data.model_used || 'AI'}`);
      
    } catch (err) {
      console.error('Voice processing failed:', err);
      toast.error(err.message || 'Failed to process voice');
    } finally {
      setProcessingVoice(false);
      setSending(false);
    }
  }, [audioBlob, activeSession, token, selectedModel]);

  // ============== AUTONOMOUS AGENT FUNCTIONS ==============
  
  // Create execution plan
  const createPlan = useCallback(async () => {
    if (!autonomousPrompt.trim()) {
      toast.error('Please enter a task description');
      return;
    }
    
    setIsPlanning(true);
    setActivePlan(null);
    setExecutionResults([]);
    
    try {
      const data = await api('/api/autonomous/plan', {
        method: 'POST',
        body: JSON.stringify({ prompt: autonomousPrompt })
      });
      
      setActivePlan(data.plan);
      toast.success('Execution plan created');
    } catch (err) {
      console.error('Failed to create plan:', err);
      toast.error(err.message || 'Failed to create plan');
    } finally {
      setIsPlanning(false);
    }
  }, [autonomousPrompt, api]);
  
  // Execute plan
  const executePlan = useCallback(async () => {
    if (!activePlan) return;
    
    setIsExecuting(true);
    setExecutionResults([]);
    
    try {
      const data = await api(`/api/autonomous/execute/${activePlan.id}?auto_confirm=${autoConfirm}`, {
        method: 'POST'
      });
      
      setExecutionResults(data.execution_results || []);
      
      // Check final status
      const finalResult = data.execution_results?.find(r => r.type === 'plan_completed');
      if (finalResult) {
        if (finalResult.status === 'completed') {
          toast.success('Task executed successfully!');
        } else {
          toast.info(`Task ${finalResult.status}`);
        }
      }
      
      // Refresh history
      fetchExecutionHistory();
    } catch (err) {
      console.error('Failed to execute plan:', err);
      toast.error(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  }, [activePlan, autoConfirm, api]);
  
  // Confirm step
  const confirmStep = useCallback(async (stepId, reason = '') => {
    if (!activePlan) return;
    
    try {
      await api(`/api/autonomous/confirm/${activePlan.id}/${stepId}`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      
      toast.success('Step confirmed');
      
      // Re-execute to continue
      executePlan();
    } catch (err) {
      console.error('Failed to confirm step:', err);
      toast.error('Failed to confirm step');
    }
  }, [activePlan, api, executePlan]);
  
  // Cancel plan
  const cancelPlan = useCallback(async () => {
    if (!activePlan) return;
    
    try {
      await api(`/api/autonomous/cancel/${activePlan.id}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by user' })
      });
      
      setActivePlan(null);
      setExecutionResults([]);
      toast.info('Plan cancelled');
    } catch (err) {
      console.error('Failed to cancel plan:', err);
    }
  }, [activePlan, api]);
  
  // Fetch execution history
  const fetchExecutionHistory = useCallback(async () => {
    try {
      const data = await api('/api/autonomous/history?limit=20');
      setExecutionHistory(data.plans || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, [api]);
  
  // Provide feedback
  const provideFeedback = useCallback(async (planId, feedbackType) => {
    try {
      await api(`/api/autonomous/feedback/${planId}`, {
        method: 'POST',
        body: JSON.stringify({ feedback_type: feedbackType })
      });
      toast.success('Feedback recorded - AI will learn from this');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  }, [api]);

  // Load autonomous history on tab switch
  useEffect(() => {
    if (activeTab === 'autonomous') {
      fetchExecutionHistory();
    }
  }, [activeTab, fetchExecutionHistory]);

  // Generate insights
  const generateInsights = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/api/ai-agent/insights/generate', { method: 'POST' });
      setInsights(prev => [...data.insights, ...prev]);
      toast.success(`Generated ${data.count} new insights`);
    } catch (err) {
      console.error('Failed to generate insights:', err);
      toast.error('Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Dismiss insight
  const dismissInsight = useCallback(async (insightId) => {
    try {
      await api(`/api/ai-agent/insights/${insightId}/dismiss`, { method: 'PUT' });
      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (err) {
      console.error('Failed to dismiss insight:', err);
    }
  }, [api]);

  // Generate poster
  const generatePoster = useCallback(async () => {
    if (!posterForm.prompt.trim()) {
      toast.error('Please enter a poster description');
      return;
    }
    
    setGeneratingPoster(true);
    setGeneratedPoster(null);
    
    try {
      const data = await api('/api/ai-agent/poster/generate', {
        method: 'POST',
        body: JSON.stringify(posterForm)
      });
      
      setGeneratedPoster(data);
      toast.success('Poster generated successfully!');
    } catch (err) {
      console.error('Failed to generate poster:', err);
      toast.error(err.message || 'Failed to generate poster');
    } finally {
      setGeneratingPoster(false);
    }
  }, [api, posterForm]);

  // Download poster
  const downloadPoster = useCallback(() => {
    if (!generatedPoster?.image_base64) return;
    
    const link = document.createElement('a');
    link.href = `data:${generatedPoster.mime_type || 'image/png'};base64,${generatedPoster.image_base64}`;
    link.download = `poster-${Date.now()}.png`;
    link.click();
    toast.success('Poster downloaded!');
  }, [generatedPoster]);

  // Add poster to batch
  const addBatchPoster = () => {
    setBatchPosters(prev => [...prev, {
      id: Date.now(),
      prompt: '',
      style: 'professional',
      format: 'instagram_post'
    }]);
  };

  // Remove poster from batch
  const removeBatchPoster = (id) => {
    setBatchPosters(prev => prev.filter(p => p.id !== id));
  };

  // Update batch poster
  const updateBatchPoster = (id, field, value) => {
    setBatchPosters(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Generate batch posters
  const generateBatchPosters = useCallback(async () => {
    const validPosters = batchPosters.filter(p => p.prompt.trim());
    if (validPosters.length === 0) {
      toast.error('Please add at least one poster description');
      return;
    }

    setGeneratingBatch(true);
    setBatchResults([]);
    setBatchProgress(0);

    const results = [];
    for (let i = 0; i < validPosters.length; i++) {
      const poster = validPosters[i];
      setBatchProgress(Math.round((i / validPosters.length) * 100));
      
      try {
        const data = await api('/api/ai-agent/poster/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt: poster.prompt,
            style: poster.style,
            format: poster.format,
            image_model: posterForm.image_model,
            include_business_name: posterForm.include_business_name
          })
        });
        
        results.push({
          ...poster,
          success: true,
          image_base64: data.image_base64,
          mime_type: data.mime_type
        });
      } catch (err) {
        results.push({
          ...poster,
          success: false,
          error: err.message
        });
      }
      
      setBatchResults([...results]);
    }

    setBatchProgress(100);
    setGeneratingBatch(false);
    toast.success(`Generated ${results.filter(r => r.success).length}/${validPosters.length} posters`);
  }, [api, batchPosters, posterForm.image_model, posterForm.include_business_name]);

  // Download all batch posters
  const downloadAllPosters = () => {
    batchResults.filter(r => r.success).forEach((result, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = `data:${result.mime_type || 'image/png'};base64,${result.image_base64}`;
        link.download = `poster-${index + 1}-${Date.now()}.png`;
        link.click();
      }, index * 500);
    });
    toast.success('Downloading all posters...');
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      // Only fetch if user is authenticated
      if (authLoading || !user) return;
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchSessions()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchSessions, authLoading, user]);

  // Handle Enter key in chat input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Early returns AFTER all hooks are defined
  if (authLoading) {
    return null; // or return a skeleton loader
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ai-agent-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            AI Business Agent
          </h1>
          <p className="text-muted-foreground mt-1">Your intelligent assistant for business analysis and content creation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={generateInsights}
            disabled={loading}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate Insights
          </Button>
          {canManage && (
            <>
              <Button 
                onClick={() => setShowPosterModal(true)}
                className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                <Image className="w-4 h-4" />
                Create Poster
              </Button>
              <Button 
                onClick={() => setShowBatchPosterModal(true)}
                variant="outline"
                className="gap-2"
                data-testid="batch-poster-btn"
              >
                <Plus className="w-4 h-4" />
                Multiple Posters
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-900/30 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Today&apos;s Revenue</p>
                <p className="text-xl font-bold">{currencySymbol}{(dashboardData?.business_overview?.today_revenue || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weekly Revenue</p>
                <p className="text-xl font-bold">{currencySymbol}{(dashboardData?.business_overview?.weekly_revenue || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/50 dark:to-orange-900/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low Stock Items</p>
                <p className="text-xl font-bold">{dashboardData?.business_overview?.low_stock_items || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-violet-50 to-purple-100 dark:from-violet-950/50 dark:to-purple-900/30 border-violet-200 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Customers</p>
                <p className="text-xl font-bold">{dashboardData?.business_overview?.total_customers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="autonomous" className="gap-2" data-testid="autonomous-tab">
            <Sparkles className="w-4 h-4" />
            Autonomous
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Lightbulb className="w-4 h-4" />
            Insights
            {insights.filter(i => !i.is_read).length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {insights.filter(i => !i.is_read).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="mt-6">
          <div className={`grid ${chatExpanded ? '' : 'lg:grid-cols-3'} gap-6`}>
            {/* Chat Sessions Sidebar */}
            {!chatExpanded && (
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Conversations</CardTitle>
                    <Button size="icon" variant="ghost" onClick={createNewSession}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1 p-4 pt-0">
                      {sessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No conversations yet</p>
                          <Button 
                            variant="link" 
                            className="text-primary mt-2"
                            onClick={createNewSession}
                          >
                            Start a new chat
                          </Button>
                        </div>
                      ) : (
                        sessions.map(session => (
                          <button
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              activeSession?.id === session.id 
                                ? 'bg-primary/10 border border-primary/20' 
                                : 'hover:bg-muted'
                            }`}
                          >
                            <p className="font-medium text-sm truncate">{session.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(session.updated_at).toLocaleDateString()}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Chat Window */}
            <Card className={chatExpanded ? '' : 'lg:col-span-2'}>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">AI Business Assistant</CardTitle>
                      <CardDescription className="text-xs">
                        Ask about your business, get insights, and more
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="w-48 h-8 text-xs" data-testid="llm-model-selector">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude-4.5-sonnet-pro">
                          <div className="flex items-center gap-2">
                            <Target className="w-3 h-3 text-purple-500" />
                            <span>Claude 4.5 Sonnet - PRO</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gpt-5.2-codex">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-emerald-500" />
                            <span>GPT-5.2 Codex (Beta)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gpt-5.2">
                          <div className="flex items-center gap-2">
                            <Brain className="w-3 h-3 text-green-500" />
                            <span>GPT-5.2 (Beta)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini-3-pro">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-blue-500" />
                            <span>Gemini 3 Pro</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="auto">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-3 h-3 text-gray-500" />
                            <span>Auto (Smart Select)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => setChatExpanded(!chatExpanded)}
                    >
                      {chatExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Messages Area */}
                <ScrollArea className={chatExpanded ? 'h-[500px]' : 'h-[350px]'}>
                  <div className="p-4 space-y-2">
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
                          <Sparkles className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className="font-semibold mb-2">How can I help you today?</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Ask me about your business performance, get suggestions, or identify opportunities.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {[
                            "What are my business loopholes?",
                            "How can I improve sales?",
                            "Analyze my customer data",
                            "Marketing suggestions"
                          ].map((suggestion, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => setInputMessage(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map((msg, idx) => (
                        <ChatMessage 
                          key={msg.id || idx} 
                          message={msg} 
                          isUser={msg.role === 'user'} 
                        />
                      ))
                    )}
                    {sending && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                          <RefreshCw className="w-3 h-3 animate-spin text-violet-500" />
                        </div>
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                
                {/* Input Area */}
                <div className="p-4 border-t bg-muted/30">
                  {/* Voice Recording Indicator */}
                  {audioBlob && (
                    <div className="mb-2 flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Volume2 className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-blue-600 dark:text-blue-400">Voice recording ready</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="ml-auto h-6 w-6 p-0"
                        onClick={() => setAudioBlob(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={sendVoiceMessage}
                        disabled={processingVoice}
                        className="gap-1"
                      >
                        {processingVoice ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {/* Voice Button */}
                    <Button
                      variant={isRecording ? 'destructive' : 'outline'}
                      size="icon"
                      onClick={toggleRecording}
                      className={isRecording ? 'animate-pulse' : ''}
                      title={isRecording ? 'Stop recording' : 'Start voice recording'}
                      data-testid="voice-record-btn"
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    <Input
                      placeholder="Ask about your business or use voice..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={sending}
                      className="flex-1"
                      data-testid="chat-input"
                    />
                    <Button 
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || sending}
                      className="gap-2"
                      data-testid="send-message-btn"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    💡 Try: "What were my sales this week?" or "Show low stock items"
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Autonomous Agent Tab */}
        <TabsContent value="autonomous" className="mt-6" data-testid="autonomous-content">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Task Input */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  Autonomous Task Execution
                </CardTitle>
                <CardDescription>
                  Describe what you want to accomplish. The AI will create a plan and execute it autonomously.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Example: Analyze my sales for the last month, identify top products, and generate a summary report"
                    value={autonomousPrompt}
                    onChange={(e) => setAutonomousPrompt(e.target.value)}
                    rows={4}
                    className="resize-none"
                    data-testid="autonomous-prompt"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="auto-confirm"
                        checked={autoConfirm}
                        onCheckedChange={setAutoConfirm}
                      />
                      <Label htmlFor="auto-confirm" className="text-sm">
                        Auto-confirm all steps
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      {activePlan && (
                        <Button
                          variant="outline"
                          onClick={cancelPlan}
                          disabled={isExecuting}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={activePlan ? executePlan : createPlan}
                        disabled={isPlanning || isExecuting || (!activePlan && !autonomousPrompt.trim())}
                        className="gap-2"
                        data-testid="autonomous-execute-btn"
                      >
                        {isPlanning || isExecuting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : activePlan ? (
                          <Zap className="w-4 h-4" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                        {isPlanning ? 'Planning...' : isExecuting ? 'Executing...' : activePlan ? 'Execute Plan' : 'Create Plan'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Execution Plan */}
                {activePlan && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-500" />
                        Execution Plan
                      </h4>
                      <Badge variant={
                        activePlan.risk_level === 'high' ? 'destructive' :
                        activePlan.risk_level === 'medium' ? 'warning' : 'secondary'
                      }>
                        Risk: {activePlan.risk_level}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{activePlan.reasoning}</p>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Steps ({activePlan.steps?.length || 0}):</p>
                      {activePlan.steps?.map((step, idx) => (
                        <div 
                          key={step.id}
                          className={`flex items-start gap-3 p-2 rounded-md ${
                            step.status === 'completed' ? 'bg-green-50 dark:bg-green-950/20' :
                            step.status === 'failed' ? 'bg-red-50 dark:bg-red-950/20' :
                            step.status === 'executing' ? 'bg-blue-50 dark:bg-blue-950/20' :
                            step.status === 'awaiting_confirmation' ? 'bg-yellow-50 dark:bg-yellow-950/20' :
                            'bg-background'
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {step.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : step.status === 'failed' ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : step.status === 'executing' ? (
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            ) : step.status === 'awaiting_confirmation' ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{step.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {step.action_type} • {step.target}
                              {step.confirmation_required !== 'none' && (
                                <span className="ml-2 text-yellow-600">
                                  • Requires: {step.confirmation_required} confirmation
                                </span>
                              )}
                            </p>
                            {step.status === 'awaiting_confirmation' && (
                              <Button
                                size="sm"
                                className="mt-2"
                                onClick={() => confirmStep(step.id)}
                              >
                                Confirm & Continue
                              </Button>
                            )}
                            {step.result && step.status === 'completed' && (
                              <p className="text-xs text-green-600 mt-1">
                                Result: {typeof step.result === 'object' ? step.result.message || JSON.stringify(step.result).slice(0, 100) : step.result}
                              </p>
                            )}
                            {step.error && (
                              <p className="text-xs text-red-600 mt-1">Error: {step.error}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="flex-shrink-0 text-xs">
                            {idx + 1}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execution Results */}
                {executionResults.length > 0 && (
                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-green-500" />
                      Execution Results
                    </h4>
                    <ScrollArea className="h-40">
                      {executionResults.filter(r => r.type === 'step_completed' && r.result?.count > 0).map((result, idx) => (
                        <div key={idx} className="text-sm p-2 border-b last:border-0">
                          <span className="font-medium">Step {result.step_number}:</span>{' '}
                          {result.result?.message || `Found ${result.result?.count} items`}
                        </div>
                      ))}
                    </ScrollArea>
                    
                    {/* Feedback */}
                    {executionResults.find(r => r.type === 'plan_completed') && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Was this helpful?</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => provideFeedback(activePlan?.id, 'positive')}
                        >
                          👍
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => provideFeedback(activePlan?.id, 'negative')}
                        >
                          👎
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Execution History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Recent Executions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {executionHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No execution history yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {executionHistory.map((plan) => (
                        <div 
                          key={plan.id}
                          className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setActivePlan(plan);
                            setAutonomousPrompt(plan.original_prompt);
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant={
                              plan.status === 'completed' ? 'success' :
                              plan.status === 'failed' ? 'destructive' :
                              plan.status === 'cancelled' ? 'secondary' : 'default'
                            } className="text-xs">
                              {plan.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(plan.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-2">{plan.original_prompt}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {plan.steps?.length || 0} steps
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* Quick Examples */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Quick Examples</CardTitle>
              <CardDescription>Click to try these autonomous tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  "Show me all items in inventory and calculate total value",
                  "Analyze my sales data and identify top selling products",
                  "Generate a report of all customers with pending payments",
                  "Find low stock items and create a reorder suggestion",
                  "Calculate my revenue and profit margins for this month"
                ].map((example, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setAutonomousPrompt(example)}
                  >
                    {example.slice(0, 40)}...
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="mt-6">
          <div className="space-y-6">
            {/* Insight Counts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                <CardContent className="p-4 text-center">
                  <Target className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <p className="text-2xl font-bold text-red-600">{dashboardData?.insight_counts?.loopholes || 0}</p>
                  <p className="text-xs text-muted-foreground">Loopholes</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold text-amber-600">{dashboardData?.insight_counts?.warnings || 0}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold text-green-600">{dashboardData?.insight_counts?.opportunities || 0}</p>
                  <p className="text-xs text-muted-foreground">Opportunities</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4 text-center">
                  <Lightbulb className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold text-blue-600">{dashboardData?.insight_counts?.recommendations || 0}</p>
                  <p className="text-xs text-muted-foreground">Recommendations</p>
                </CardContent>
              </Card>
            </div>

            {/* Insights List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Latest Insights</h3>
                <Button variant="outline" size="sm" onClick={generateInsights} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              {insights.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="font-semibold mb-2">No Insights Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click &ldquo;Generate Insights&rdquo; to analyze your business data
                    </p>
                    <Button onClick={generateInsights} disabled={loading}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Insights
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {insights.map(insight => (
                    <InsightCard 
                      key={insight.id} 
                      insight={insight} 
                      onDismiss={dismissInsight}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Chat History</CardTitle>
              <CardDescription>View all your previous conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No chat history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <div 
                      key={session.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        loadSession(session.id);
                        setActiveTab('chat');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-violet-500" />
                        </div>
                        <div>
                          <p className="font-medium">{session.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.created_at).toLocaleDateString()} • {session.chat_type}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Poster Generation Modal */}
      <Dialog open={showPosterModal} onOpenChange={setShowPosterModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5 text-violet-500" />
              AI Poster Generator
            </DialogTitle>
            <DialogDescription>
              Create stunning marketing posters using AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid gap-4">
              <div>
                <Label>Poster Description</Label>
                <Textarea
                  placeholder="Describe your poster (e.g., 'A vibrant sale poster for 50% off on all ethnic wear')"
                  value={posterForm.prompt}
                  onChange={(e) => setPosterForm(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Style</Label>
                  <Select 
                    value={posterForm.style} 
                    onValueChange={(v) => setPosterForm(prev => ({ ...prev, style: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="vibrant">Vibrant</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="festive">Festive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Format</Label>
                  <Select 
                    value={posterForm.format} 
                    onValueChange={(v) => setPosterForm(prev => ({ ...prev, format: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram_post">Instagram Post (1080x1080)</SelectItem>
                      <SelectItem value="instagram_story">Instagram Story (1080x1920)</SelectItem>
                      <SelectItem value="facebook_post">Facebook Post (1200x630)</SelectItem>
                      <SelectItem value="whatsapp_status">WhatsApp Status (1080x1920)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>AI Model</Label>
                  <Select 
                    value={posterForm.image_model} 
                    onValueChange={(v) => setPosterForm(prev => ({ ...prev, image_model: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-3-pro-image-preview">Gemini Nano Banana</SelectItem>
                      <SelectItem value="gpt-image-1">OpenAI GPT Image 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2 pt-6">
                  <Switch 
                    checked={posterForm.include_business_name}
                    onCheckedChange={(v) => setPosterForm(prev => ({ ...prev, include_business_name: v }))}
                  />
                  <Label className="cursor-pointer">Include Business Name</Label>
                </div>
              </div>
            </div>
            
            {/* Generated Poster Preview */}
            {generatedPoster && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Generated Poster</h4>
                  <Button size="sm" onClick={downloadPoster}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="flex justify-center">
                  <img loading="lazy" 
                    src={`data:${generatedPoster.mime_type || 'image/png'};base64,${generatedPoster.image_base64}`}
                    alt="Generated Poster"
                    className="max-h-[400px] rounded-lg shadow-lg"
                  />
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPosterModal(false)}>
              Close
            </Button>
            <Button 
              onClick={generatePoster}
              disabled={generatingPoster || !posterForm.prompt.trim()}
              className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600"
            >
              {generatingPoster ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Poster
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Poster Generation Modal */}
      <Dialog open={showBatchPosterModal} onOpenChange={setShowBatchPosterModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-violet-500" />
              Create Multiple Posters
            </DialogTitle>
            <DialogDescription>
              Generate multiple marketing posters at once for quick batch work
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Global Settings */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <Label>AI Model (applies to all)</Label>
                <Select 
                  value={posterForm.image_model} 
                  onValueChange={(v) => setPosterForm(prev => ({ ...prev, image_model: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-3-pro-image-preview">Gemini Nano Banana</SelectItem>
                    <SelectItem value="gpt-image-1">OpenAI GPT Image 1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch 
                  checked={posterForm.include_business_name}
                  onCheckedChange={(v) => setPosterForm(prev => ({ ...prev, include_business_name: v }))}
                />
                <Label className="cursor-pointer">Include Business Name</Label>
              </div>
            </div>

            {/* Poster List */}
            <div className="space-y-3">
              {batchPosters.map((poster, index) => (
                <Card key={poster.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0 font-bold text-violet-600">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder="Describe your poster (e.g., '50% off on ethnic wear for Diwali')"
                        value={poster.prompt}
                        onChange={(e) => updateBatchPoster(poster.id, 'prompt', e.target.value)}
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Select 
                          value={poster.style} 
                          onValueChange={(v) => updateBatchPoster(poster.id, 'style', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="vibrant">Vibrant</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                            <SelectItem value="festive">Festive</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select 
                          value={poster.format} 
                          onValueChange={(v) => updateBatchPoster(poster.id, 'format', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram_post">Instagram Post</SelectItem>
                            <SelectItem value="instagram_story">Instagram Story</SelectItem>
                            <SelectItem value="facebook_post">Facebook Post</SelectItem>
                            <SelectItem value="whatsapp_status">WhatsApp Status</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {batchPosters.length > 1 && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => removeBatchPoster(poster.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Add More Button */}
            <Button 
              variant="outline" 
              onClick={addBatchPoster}
              className="w-full gap-2"
              disabled={batchPosters.length >= 10}
            >
              <Plus className="w-4 h-4" />
              Add Another Poster ({batchPosters.length}/10)
            </Button>

            {/* Progress Bar */}
            {generatingBatch && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Generating posters...</span>
                  <span>{batchProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-violet-500 to-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${batchProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Results */}
            {batchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Generated Posters ({batchResults.filter(r => r.success).length}/{batchResults.length})</h4>
                  {batchResults.filter(r => r.success).length > 0 && (
                    <Button size="sm" onClick={downloadAllPosters} className="gap-2">
                      <Download className="w-4 h-4" />
                      Download All
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {batchResults.map((result, index) => (
                    <Card key={index} className={`overflow-hidden ${!result.success ? 'border-red-300' : ''}`}>
                      {result.success ? (
                        <>
                          <img loading="lazy" 
                            src={`data:${result.mime_type || 'image/png'};base64,${result.image_base64}`}
                            alt={`Poster ${index + 1}`}
                            className="w-full h-32 object-cover"
                          />
                          <div className="p-2">
                            <p className="text-xs text-muted-foreground truncate">{result.prompt}</p>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="w-full mt-1"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `data:${result.mime_type || 'image/png'};base64,${result.image_base64}`;
                                link.download = `poster-${index + 1}.png`;
                                link.click();
                              }}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center">
                          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                          <p className="text-xs text-red-500">{result.error}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowBatchPosterModal(false)}>
              Close
            </Button>
            <Button 
              onClick={generateBatchPosters}
              disabled={generatingBatch || batchPosters.every(p => !p.prompt.trim())}
              className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600"
            >
              {generatingBatch ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate All ({batchPosters.filter(p => p.prompt.trim()).length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
