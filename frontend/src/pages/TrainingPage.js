import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Video, Users, Calendar, Clock, Play, Square, Plus, 
  MessageSquare, Monitor, Settings, ChevronRight, 
  Mic, MicOff, VideoOff, Share2, PhoneOff, MoreVertical,
  Send, Pin, User, X, Maximize2, Minimize2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Switch } from '../components/ui/switch';
import ScreenShareRoom from '../components/ScreenShareRoom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function TrainingPage() {
  // Use stable auth flags to avoid a full component re-render/flicker while auth initializes
  const { user, loading: authLoading } = useAuth();

  // ALL useState hooks must be called unconditionally (before any early returns)
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);

  // Create session form
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    session_type: 'training',
    scheduled_start: '',
    duration_minutes: 60,
    max_participants: 20,
    enable_recording: true,
    enable_chat: true,
    enable_screen_share: true,
    enable_breakout_rooms: false,
    is_tenant_wide: true,
    invited_user_ids: []
  });
  
  // Live session state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const token = localStorage.getItem('token');
  const canCreateSession = ['superadmin', 'admin', 'manager'].includes(user?.role);

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

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api('/api/training/sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [api]);

  const fetchRecordings = useCallback(async () => {
    try {
      const data = await api('/api/training/recordings');
      setRecordings(data.recordings || []);
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
    }
  }, [api]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await api('/api/training/analytics');
      setAnalytics(data.analytics);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, [api]);

  useEffect(() => {
    // Only load data when user is authenticated
    if (authLoading || !user) return;
    
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSessions(), fetchRecordings(), fetchAnalytics()]);
      setLoading(false);
    };
    loadData();
  }, [authLoading, user, fetchSessions, fetchRecordings, fetchAnalytics]);

  // Don't render until auth state is known (prevents blink between "unauth" and "auth")
  if (authLoading) {
    return null; // or return a skeleton loader
  }

  // Once initialized, redirect unauthenticated users deterministically
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleCreateSession = async () => {
    if (!sessionForm.title.trim()) {
      toast.error('Please enter a session title');
      return;
    }
    if (!sessionForm.scheduled_start) {
      toast.error('Please select a date and time');
      return;
    }

    try {
      const response = await api('/api/training/sessions', {
        method: 'POST',
        body: JSON.stringify({
          ...sessionForm,
          scheduled_start: new Date(sessionForm.scheduled_start).toISOString()
        })
      });
      toast.success(response.message || 'Session created');
      setShowCreateModal(false);
      resetForm();
      fetchSessions();
    } catch (err) {
      toast.error(err.message || 'Failed to create session');
    }
  };

  const handleStartSession = async (sessionId) => {
    try {
      const response = await api(`/api/training/sessions/${sessionId}/start`, { method: 'POST' });
      toast.success('Session started');
      
      // Open live session view
      const sessionData = await api(`/api/training/sessions/${sessionId}`);
      setShowLiveSession(sessionData.session);
      fetchSessions();
    } catch (err) {
      toast.error(err.message || 'Failed to start session');
    }
  };

  const handleJoinSession = async (sessionId) => {
    try {
      const response = await api(`/api/training/sessions/${sessionId}/join`, { method: 'POST' });
      toast.success('Joined session');
      setShowLiveSession(response.session);
      
      // Fetch chat messages
      const chatData = await api(`/api/training/sessions/${sessionId}/chat`);
      setChatMessages(chatData.messages || []);
      
      // Fetch attendance
      const attendanceData = await api(`/api/training/sessions/${sessionId}/attendance`);
      setAttendance(attendanceData.attendance || []);
    } catch (err) {
      toast.error(err.message || 'Failed to join session');
    }
  };

  const handleEndSession = async () => {
    if (!showLiveSession) return;
    
    try {
      await api(`/api/training/sessions/${showLiveSession.id}/end`, { method: 'POST' });
      toast.success('Session ended');
      setShowLiveSession(null);
      fetchSessions();
    } catch (err) {
      toast.error(err.message || 'Failed to end session');
    }
  };

  const handleLeaveSession = async () => {
    if (!showLiveSession) return;
    
    try {
      await api(`/api/training/sessions/${showLiveSession.id}/leave`, { method: 'POST' });
      setShowLiveSession(null);
      toast.info('Left session');
    } catch (err) {
      toast.error(err.message || 'Failed to leave session');
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !showLiveSession) return;
    
    try {
      const response = await api(`/api/training/sessions/${showLiveSession.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content: chatInput })
      });
      setChatMessages(prev => [...prev, response.message]);
      setChatInput('');
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  const handleCancelSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to cancel this session?')) return;
    
    try {
      await api(`/api/training/sessions/${sessionId}/cancel`, { method: 'POST' });
      toast.success('Session cancelled');
      fetchSessions();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel session');
    }
  };

  const resetForm = () => {
    setSessionForm({
      title: '',
      description: '',
      session_type: 'training',
      scheduled_start: '',
      duration_minutes: 60,
      max_participants: 20,
      enable_recording: true,
      enable_chat: true,
      enable_screen_share: true,
      enable_breakout_rooms: false,
      is_tenant_wide: true,
      invited_user_ids: []
    });
  };

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} minutes`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'live': return 'bg-green-500/10 text-green-500 border-green-500/20 animate-pulse';
      case 'ended': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'training': return <Video className="w-4 h-4" />;
      case 'onboarding': return <Users className="w-4 h-4" />;
      case 'live_support': return <MessageSquare className="w-4 h-4" />;
      case 'webinar': return <Monitor className="w-4 h-4" />;
      default: return <Video className="w-4 h-4" />;
    }
  };

  // Filter sessions
  const upcomingSessions = sessions.filter(s => s.status === 'scheduled');
  const liveSessions = sessions.filter(s => s.status === 'live');
  const pastSessions = sessions.filter(s => s.status === 'ended' || s.status === 'cancelled');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Live Session View - Using ScreenShareRoom component
  if (showLiveSession) {
    const isHost = showLiveSession.host_id === user?.id;
    
    return (
      <ScreenShareRoom
        sessionId={showLiveSession.id}
        sessionTitle={showLiveSession.title}
        isHost={isHost}
        userName={user?.name || 'User'}
        enableChat={showLiveSession.enable_chat}
        enableRecording={showLiveSession.enable_recording}
        maxParticipants={showLiveSession.max_participants || 20}
        onLeave={() => {
          handleLeaveSession();
          setShowLiveSession(null);
        }}
        onEnd={() => {
          handleEndSession();
          setShowLiveSession(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" data-testid="training-page">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Video className="w-8 h-8 text-primary" />
              Training Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Live sessions, onboarding, and employee training
            </p>
          </div>
          {canCreateSession && (
            <Button onClick={() => setShowCreateModal(true)} data-testid="create-session-btn">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          )}
        </div>

        {/* Live Sessions Alert */}
        {liveSessions.length > 0 && (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-medium text-green-500">
                    {liveSessions.length} Live Session{liveSessions.length > 1 ? 's' : ''} Now
                  </span>
                </div>
                <div className="flex gap-2">
                  {liveSessions.slice(0, 2).map(session => (
                    <Button
                      key={session.id}
                      size="sm"
                      onClick={() => handleJoinSession(session.id)}
                      data-testid={`join-live-${session.id}`}
                    >
                      Join: {session.title.substring(0, 20)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Video className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.total_sessions || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Users className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.total_attendees || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Attendees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Clock className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.total_training_hours || 0}h</p>
                    <p className="text-sm text-muted-foreground">Training Hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.avg_session_duration_minutes || 0}m</p>
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming ({upcomingSessions.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Past Sessions ({pastSessions.length})
            </TabsTrigger>
            <TabsTrigger value="recordings" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Recordings ({recordings.length})
            </TabsTrigger>
          </TabsList>

          {/* Upcoming Sessions */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingSessions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Upcoming Sessions</h3>
                  <p className="text-muted-foreground mb-4">
                    {canCreateSession 
                      ? 'Schedule a training session to get started'
                      : 'No training sessions are scheduled yet'}
                  </p>
                  {canCreateSession && (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Schedule Session
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingSessions.map(session => (
                  <Card key={session.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <Badge className={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getTypeIcon(session.session_type)}
                          {session.session_type}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-2">{session.title}</CardTitle>
                      {session.description && (
                        <CardDescription className="line-clamp-2">
                          {session.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {formatDateTime(session.scheduled_start)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {session.duration_minutes} minutes
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        Max {session.max_participants} participants
                      </div>
                      
                      {/* Features */}
                      <div className="flex flex-wrap gap-1 pt-2">
                        {session.enable_recording && (
                          <Badge variant="secondary" className="text-xs">Recording</Badge>
                        )}
                        {session.enable_chat && (
                          <Badge variant="secondary" className="text-xs">Chat</Badge>
                        )}
                        {session.enable_breakout_rooms && (
                          <Badge variant="secondary" className="text-xs">Breakout Rooms</Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3">
                        {session.host_id === user?.id ? (
                          <>
                            <Button 
                              className="flex-1" 
                              onClick={() => handleStartSession(session.id)}
                              data-testid={`start-session-${session.id}`}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Start
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => handleCancelSession(session.id)}
                              data-testid={`cancel-session-${session.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button 
                            className="flex-1" 
                            variant="outline"
                            disabled
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Waiting to Start
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Past Sessions */}
          <TabsContent value="past" className="space-y-4">
            {pastSessions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No Past Sessions</h3>
                  <p className="text-muted-foreground">
                    Completed sessions will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pastSessions.map(session => (
                  <Card key={session.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            session.status === 'ended' ? 'bg-gray-500/10' : 'bg-red-500/10'
                          }`}>
                            {getTypeIcon(session.session_type)}
                          </div>
                          <div>
                            <h4 className="font-medium">{session.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(session.actual_start || session.scheduled_start)}
                              {session.recording_duration && ` • ${formatDuration(session.recording_duration)}`}
                              {session.peak_participants && ` • ${session.peak_participants} attendees`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(session.status)}>
                            {session.status}
                          </Badge>
                          {session.recording_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={session.recording_url} target="_blank" rel="noopener noreferrer">
                                <Video className="w-4 h-4 mr-2" />
                                Watch
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Recordings */}
          <TabsContent value="recordings" className="space-y-4">
            {recordings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No Recordings</h3>
                  <p className="text-muted-foreground">
                    Session recordings will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recordings.map(recording => (
                  <Card key={recording.id} className="overflow-hidden">
                    <div className="aspect-video bg-gray-900 flex items-center justify-center">
                      <Video className="w-12 h-12 text-gray-600" />
                    </div>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-1">{recording.title}</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {formatDateTime(recording.actual_start)}
                        {recording.recording_duration && ` • ${formatDuration(recording.recording_duration)}`}
                      </p>
                      {recording.recording_url ? (
                        <Button className="w-full" asChild>
                          <a href={recording.recording_url} target="_blank" rel="noopener noreferrer">
                            <Play className="w-4 h-4 mr-2" />
                            Watch Recording
                          </a>
                        </Button>
                      ) : (
                        <Button className="w-full" disabled variant="outline">
                          Processing...
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Session Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Training Session</DialogTitle>
            <DialogDescription>
              Create a new training, onboarding, or support session
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Session Title *</Label>
              <Input
                value={sessionForm.title}
                onChange={(e) => setSessionForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., New Employee Onboarding"
                data-testid="session-title-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={sessionForm.description}
                onChange={(e) => setSessionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the session..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Session Type</Label>
                <Select
                  value={sessionForm.session_type}
                  onValueChange={(v) => setSessionForm(prev => ({ ...prev, session_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="live_support">Live Support</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Select
                  value={String(sessionForm.duration_minutes)}
                  onValueChange={(v) => setSessionForm(prev => ({ ...prev, duration_minutes: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={sessionForm.scheduled_start}
                  onChange={(e) => setSessionForm(prev => ({ ...prev, scheduled_start: e.target.value }))}
                  data-testid="session-datetime-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Max Participants</Label>
                <Input
                  type="number"
                  value={sessionForm.max_participants}
                  onChange={(e) => setSessionForm(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 20 }))}
                  min={2}
                  max={100}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-base">Session Features</Label>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Enable Recording</span>
                </div>
                <Switch
                  checked={sessionForm.enable_recording}
                  onCheckedChange={(v) => setSessionForm(prev => ({ ...prev, enable_recording: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Enable Chat</span>
                </div>
                <Switch
                  checked={sessionForm.enable_chat}
                  onCheckedChange={(v) => setSessionForm(prev => ({ ...prev, enable_chat: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Enable Screen Share</span>
                </div>
                <Switch
                  checked={sessionForm.enable_screen_share}
                  onCheckedChange={(v) => setSessionForm(prev => ({ ...prev, enable_screen_share: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Enable Breakout Rooms</span>
                </div>
                <Switch
                  checked={sessionForm.enable_breakout_rooms}
                  onCheckedChange={(v) => setSessionForm(prev => ({ ...prev, enable_breakout_rooms: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Open to All Employees</span>
                </div>
                <Switch
                  checked={sessionForm.is_tenant_wide}
                  onCheckedChange={(v) => setSessionForm(prev => ({ ...prev, is_tenant_wide: v }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSession} data-testid="confirm-create-session-btn">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
