import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  MessageSquare, Star, MapPin, QrCode, Send, Bot, CheckSquare, 
  Users, TrendingUp, Search, RefreshCw, Copy, ExternalLink,
  Plus, Clock, AlertCircle, CheckCircle, Circle, Filter,
  Building2, Phone, Mail, Globe, Sparkles, BarChart3, Target,
  MessageCircle, Bell, User, Calendar, Flag, MoreVertical,
  ChevronDown, ChevronRight, Download, Share2, Eye, Trash2, Edit,
  Link2, Unlink, LogIn, Loader2, BellRing, Wifi, WifiOff
} from 'lucide-react';
import notificationService from '../utils/notificationService';
import { useWebSocket } from '../hooks/useWebSocket';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Checkbox } from '../components/ui/checkbox';
import { QRCodeCanvas } from 'qrcode.react';

export default function ConnectHubPage() {
  const { api, user } = useAuth();
  
  // Initialize WebSocket connection for real-time chat
  const token = localStorage.getItem('token');
  const { isConnected: wsConnected, on: wsOn, sendMessage: wsSendMessage } = useWebSocket(
    token,
    user?.id,
    user?.tenant_id,
    user?.name
  );
  
  const [activeTab, setActiveTab] = useState('reviews');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [tasks, setTasks] = useState(false);
  const [item, setItem] = useState(false);
  const [interval, setInterval] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // GMB Connection State
  const [gmbConnections, setGmbConnections] = useState({});
  // Use stable non-null sentinel values to avoid conditional UI flash on initial mount
  // (null -> value transitions can cause brief render/unrender in dependent UI)
  const [connectingStore, setConnectingStore] = useState('');
  const [showGMBModal, setShowGMBModal] = useState(false);
  const [selectedStoreForGMB, setSelectedStoreForGMB] = useState('');
  const [fetchingReviews, setFetchingReviews] = useState(false);
  
  // Reviews State
  const [reviews, setReviews] = useState([]);
  // Keep selection state stable (empty string = "none selected") to prevent flicker
  const [selectedReview, setSelectedReview] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [postingReply, setPostingReply] = useState(false);
  const [selectedStoreForReviews, setSelectedStoreForReviews] = useState('all');
  
  // SEO Keywords State
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  
  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  // Stable non-null selection state prevents UI flashing when chat list loads
  const [selectedChat, setSelectedChat] = useState('');
  const [chatUsers, setChatUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef(null);
  const chatPollRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});  // {userId: {name, timestamp}}
  const typingTimeoutRef = useRef({});
  
  // Task Form State
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', store_id: '', assigned_to: '', priority: 'medium', due_date: ''
  });
  
  // QR State
  // Use a stable non-null sentinel to avoid mount-time flicker from null -> value transitions
  // (conditional UI that checks selectedStore can briefly render/unrender on first paint)
  const [selectedStore, setSelectedStore] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Listen for OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      handleOAuthCallback(code, state);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchData = async () => {
    try {
      // Fetch stores - required for most features
      let storesData = [];
      try {
        storesData = await api('/api/stores');
        setStores(storesData);
      } catch (storeErr) {
        console.log('Stores not available - user may not have stores permission');
        setStores([]);
      }
      
      // Fetch employees for chat users - may fail for users without employees permission
      try {
        const employeesData = await api('/api/employees');
        setChatUsers(employeesData);
      } catch (empErr) {
        console.log('Employees not available - user may not have employees permission');
        setChatUsers([]);
      }
      
      // Fetch GMB connection status for each store
      const connections = {};
      for (const store of storesData) {
        try {
          const conn = await api(`/api/gmb/connection/${store.id}`);
          connections[store.id] = conn;
        } catch (e) {
          connections[store.id] = { connected: false };
        }
      }
      setGmbConnections(connections);
      
      // Load reviews from connected stores or use mock data
      const connectedStores = storesData.filter(s => connections[s.id]?.connected);
      if (connectedStores.length > 0) {
        await fetchAllReviews(connectedStores, connections);
      } else {
        // Load mock reviews when no GMB connected
        setReviews([
          { id: 1, author: 'Rahul S.', rating: 5, rating_num: 5, text: 'Excellent service and quality products!', date: '2026-02-01', replied: false, store_id: 'mock', store_name: 'Demo Store' },
          { id: 2, author: 'Priya M.', rating: 4, rating_num: 4, text: 'Good collection but delivery was a bit slow.', date: '2026-02-02', replied: true, reply: 'Thank you for your feedback! We are working to improve delivery times.', store_id: 'mock', store_name: 'Demo Store' },
          { id: 3, author: 'Amit K.', rating: 5, rating_num: 5, text: 'Best store in the area. Highly recommended!', date: '2026-02-03', replied: false, store_id: 'mock', store_name: 'Demo Store' },
          { id: 4, author: 'Sneha R.', rating: 3, rating_num: 3, text: 'Average experience. Need better customer service.', date: '2026-02-04', replied: false, store_id: 'mock', store_name: 'Demo Store' },
        ]);
      }
      
      // Load mock keywords
      setKeywords([
        { word: 'clothing store', rank: 3, volume: 12000, trend: 'up' },
        { word: 'fashion outlet', rank: 7, volume: 8500, trend: 'up' },
        { word: 'branded clothes', rank: 12, volume: 6000, trend: 'stable' },
        { word: 'men fashion', rank: 5, volume: 9500, trend: 'up' },
        { word: 'women apparel', rank: 8, volume: 7800, trend: 'down' },
      ]);
      
      // Load mock tasks
      setTasks([
        { id: 1, title: 'Inventory Check', description: 'Complete monthly inventory audit', store_id: storesData[0]?.id, assigned_to: 'John', priority: 'high', status: 'pending', due_date: '2026-02-10' },
        { id: 2, title: 'Display Update', description: 'Update window display for new collection', store_id: storesData[0]?.id, assigned_to: 'Sarah', priority: 'medium', status: 'in_progress', due_date: '2026-02-08' },
        { id: 3, title: 'Staff Training', description: 'Conduct POS system training', store_id: storesData[0]?.id, assigned_to: 'Mike', priority: 'low', status: 'completed', due_date: '2026-02-05' },
      ]);
      
      // Load chat messages from backend
      await fetchChatMessages();
      
      // Get online users
      await fetchOnlineUsers();
      
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch chat messages from backend
  const fetchChatMessages = useCallback(async (checkForNew = false) => {
    try {
      const messages = await api('/api/team-chat/messages?limit=100');
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        sender: msg.sender_name,
        sender_id: msg.sender_id,
        sender_role: msg.sender_role,
        sender_store_id: msg.sender_store_id,
        text: msg.text,
        time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBot: msg.is_bot,
        created_at: msg.created_at
      }));
      
      // Check for new messages and send notification
      if (checkForNew && formattedMessages.length > lastMessageCountRef.current && notificationsEnabled) {
        const newMessages = formattedMessages.slice(0, formattedMessages.length - lastMessageCountRef.current);
        newMessages.forEach(msg => {
          // Don't notify for own messages
          if (msg.sender_id !== user?.id) {
            notificationService.notifyNewMessage(msg, msg.sender);
          }
        });
      }
      
      lastMessageCountRef.current = formattedMessages.length;
      setChatMessages(formattedMessages);
    } catch (err) {
      console.error('Failed to load chat messages:', err);
      // Set welcome message if no messages
      setChatMessages([{
        id: 'welcome',
        sender: 'System',
        text: 'Welcome to the team chat! Messages here are visible to all staff members.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBot: true
      }]);
    }
  }, [api, user, notificationsEnabled]);

  // Fetch online users
  const fetchOnlineUsers = async () => {
    try {
      const users = await api('/api/team-chat/users-online');
      setOnlineUsers(users);
    } catch (err) {
      console.error('Failed to load online users:', err);
    }
  };

  // Enable push notifications
  const enableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success('Push notifications enabled!');
    } else {
      toast.error('Notifications permission denied');
    }
  };

  // Delete chat message
  const deleteMessage = async (messageId) => {
    try {
      await api(`/api/team-chat/messages/${messageId}`, { method: 'DELETE' });
      setChatMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
      setShowMessageModal(false);
    } catch (err) {
      toast.error('Failed to delete message: ' + (err.message || 'Unknown error'));
    }
  };

  // View message details
  const viewMessage = (message) => {
    setSelectedMessage(message);
    setShowMessageModal(true);
  };

  // Check notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // WebSocket handler for real-time chat messages
  useEffect(() => {
    if (wsOn) {
      const unsubscribe = wsOn('chat_message', (message) => {
        const msgData = message.data;
        if (msgData && msgData.sender_id !== user?.id) {
          setChatMessages(prev => [...prev, {
            id: msgData.id,
            sender: msgData.sender_name,
            sender_id: msgData.sender_id,
            sender_role: msgData.sender_role,
            text: msgData.text,
            time: new Date(msgData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isBot: msgData.is_bot
          }]);
          
          // Remove typing indicator when message received
          setTypingUsers(prev => {
            const updated = { ...prev };
            delete updated[msgData.sender_id];
            return updated;
          });
          
          // Show notification if enabled
          if (notificationsEnabled) {
            notificationService.notifyNewMessage(msgData, msgData.sender_name);
          }
        }
      });
      return unsubscribe;
    }
  }, [wsOn, user, notificationsEnabled]);

  // WebSocket handler for typing indicators
  useEffect(() => {
    if (wsOn) {
      const unsubscribe = wsOn('chat_typing', (message) => {
        const { user_id, user_name, is_typing } = message.data || {};
        if (user_id && user_id !== user?.id) {
          if (is_typing) {
            setTypingUsers(prev => ({
              ...prev,
              [user_id]: { name: user_name, timestamp: Date.now() }
            }));
            
            // Clear typing after 5 seconds (in case stop event is missed)
            if (typingTimeoutRef.current[user_id]) {
              clearTimeout(typingTimeoutRef.current[user_id]);
            }
            typingTimeoutRef.current[user_id] = setTimeout(() => {
              setTypingUsers(prev => {
                const updated = { ...prev };
                delete updated[user_id];
                return updated;
              });
            }, 5000);
          } else {
            setTypingUsers(prev => {
              const updated = { ...prev };
              delete updated[user_id];
              return updated;
            });
            if (typingTimeoutRef.current[user_id]) {
              clearTimeout(typingTimeoutRef.current[user_id]);
            }
          }
        }
      });
      return unsubscribe;
    }
  }, [wsOn, user]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping) => {
    try {
      await api('/api/team-chat/typing', {
        method: 'POST',
        body: JSON.stringify({ is_typing: isTyping })
      });
    } catch (err) {
      // Silently fail - typing indicators are not critical
    }
  }, [api]);

  // Debounced typing indicator
  const lastTypingRef = useRef(false);
  const typingDebounceRef = useRef(null);
  
  const handleTyping = useCallback(() => {
    if (!lastTypingRef.current) {
      lastTypingRef.current = true;
      sendTypingIndicator(true);
    }
    
    // Clear existing timeout
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    
    // Set timeout to clear typing after 2 seconds of no input
    typingDebounceRef.current = setTimeout(() => {
      lastTypingRef.current = false;
      sendTypingIndicator(false);
    }, 2000);
  }, [sendTypingIndicator]);

  // Use WebSocket when connected, fallback to polling otherwise
  useEffect(() => {
    if (activeTab === 'chat') {
      // Initial fetch
      fetchChatMessages(false);
      fetchOnlineUsers();
      
      // Only poll if WebSocket is not connected
      if (!wsConnected) {
        chatPollRef.current = setInterval(() => {
          fetchChatMessages(true);
          fetchOnlineUsers();
        }, 3000);
      } else {
        // Just poll for online users less frequently
        chatPollRef.current = setInterval(() => {
          fetchOnlineUsers();
        }, 10000);
      }
    }
    
    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
      }
    };
  }, [activeTab, fetchChatMessages, wsConnected]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);


  // Fetch all reviews from connected stores
  const fetchAllReviews = async (connectedStores, connections) => {
    setFetchingReviews(true);
    const allReviews = [];
    
    for (const store of connectedStores) {
      try {
        const response = await api(`/api/gmb/reviews/${store.id}`);
        const storeReviews = (response.reviews || []).map(r => ({
          ...r,
          store_id: store.id,
          store_name: store.name
        }));
        allReviews.push(...storeReviews);
      } catch (e) {
        console.error(`Failed to fetch reviews for ${store.name}:`, e);
      }
    }
    
    // Sort by date descending
    allReviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    setReviews(allReviews);
    setFetchingReviews(false);
  };

  // Connect store to Google My Business
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const connectToGMB = async (store) => {
    setConnectingStore(store.id);
    
    try {
      // Build redirect URI from current origin - never hardcode
      const redirectUri = window.location.origin + '/connect-hub';
      
      const response = await api(`/api/gmb/auth-url/${store.id}?redirect_uri=${encodeURIComponent(redirectUri)}`);
      
      if (response.auth_url) {
        // Store which store we're connecting in localStorage
        localStorage.setItem('gmb_connecting_store', store.id);
        // Redirect to Google OAuth
        window.location.href = response.auth_url;
      }
    } catch (err) {
      toast.error(err.message || 'Failed to initiate Google connection');
      setConnectingStore(null);
    }
  };

  // Handle OAuth callback
  const handleOAuthCallback = async (code, state) => {
    const storeId = localStorage.getItem('gmb_connecting_store');
    if (!storeId) return;
    
    setConnectingStore(storeId);
    localStorage.removeItem('gmb_connecting_store');
    
    try {
      const redirectUri = window.location.origin + '/connect-hub';
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/gmb/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code, state, redirect_uri: redirectUri })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success(`Connected to Google as ${data.google_email}`);
        // Refresh data
        fetchData();
      } else {
        toast.error(data.detail || 'Failed to connect to Google');
      }
    } catch (err) {
      toast.error('OAuth callback failed');
    } finally {
      setConnectingStore(null);
    }
  };

  // Disconnect store from GMB
  const disconnectFromGMB = async (store) => {
    if (!confirm(`Disconnect ${store.name} from Google My Business?`)) return;
    
    try {
      await api(`/api/gmb/connection/${store.id}`, { method: 'DELETE' });
      toast.success('Disconnected from Google My Business');
      
      // Update local state
      setGmbConnections(prev => ({
        ...prev,
        [store.id]: { connected: false }
      }));
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  // Post reply to real GMB review
  const postGMBReply = async () => {
    if (!aiReply || !selectedReview) return;
    
    // Check if this is a real GMB review (has location_name)
    if (selectedReview.location_name && selectedReview.store_id !== 'mock') {
      setPostingReply(true);
      try {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/gmb/reviews/${selectedReview.store_id}/reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            review_id: selectedReview.id,
            location_name: selectedReview.location_name,
            reply_text: aiReply
          })
        });
        
        toast.success('Reply posted to Google!');
        
        // Update local state
        setReviews(prev => prev.map(r => 
          r.id === selectedReview.id ? { ...r, replied: true, reply: aiReply } : r
        ));
      } catch (err) {
        toast.error('Failed to post reply to Google');
      } finally {
        setPostingReply(false);
      }
    } else {
      // Mock review - just update local state
      setReviews(prev => prev.map(r => 
        r.id === selectedReview.id ? { ...r, replied: true, reply: aiReply } : r
      ));
      toast.success('Reply posted successfully!');
    }
    
    setSelectedReview(null);
    setAiReply('');
  };

  // Generate AI Reply for Review
  const generateAIReply = async (review) => {
    setGeneratingReply(true);
    setSelectedReview(review);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai/generate-review-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          review_text: review.text,
          rating: review.rating,
          author_name: review.author,
          business_name: user?.business_name || 'Our Store'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiReply(data.reply);
        toast.success('AI reply generated!');
      } else {
        // Fallback reply
        const fallbackReplies = {
          5: `Thank you so much, ${review.author}! We're thrilled to hear about your wonderful experience. Your kind words mean a lot to our team. We look forward to serving you again soon!`,
          4: `Thank you for your feedback, ${review.author}! We're glad you had a positive experience. We're always working to improve, and we appreciate your suggestions. See you again soon!`,
          3: `Thank you for taking the time to share your feedback, ${review.author}. We value your input and are committed to improving our service. Please reach out to us directly so we can address your concerns.`,
          2: `We're sorry to hear about your experience, ${review.author}. Your feedback is important to us. Please contact us directly at our store so we can make things right.`,
          1: `We sincerely apologize for falling short of your expectations, ${review.author}. We take your feedback seriously and would like to resolve this. Please contact our customer service team immediately.`
        };
        setAiReply(fallbackReplies[review.rating] || fallbackReplies[3]);
      }
    } catch (err) {
      // Use fallback
      setAiReply(`Thank you for your review, ${review.author}! We appreciate your feedback and look forward to serving you again.`);
    } finally {
      setGeneratingReply(false);
    }
  };

  // Post Reply to Review
  // Post Reply - use postGMBReply for both real and mock reviews
  const postReply = postGMBReply;

  // Send Chat Message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Clear typing indicator
    lastTypingRef.current = false;
    sendTypingIndicator(false);
    
    try {
      const response = await api('/api/team-chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          text: newMessage.trim(),
          message_type: 'text'
        })
      });
      
      // Add message to local state immediately
      const message = {
        id: response.id,
        sender: response.sender_name,
        sender_id: response.sender_id,
        text: response.text,
        time: new Date(response.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBot: false
      };
      
      setChatMessages(prev => [...prev, message]);
      setNewMessage('');
      
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  // Create Task
  const createTask = () => {
    if (!taskForm.title) {
      toast.error('Task title is required');
      return;
    }
    
    const newTask = {
      id: Date.now(),
      ...taskForm,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    setTasks(prev => [...prev, newTask]);
    setShowTaskModal(false);
    setTaskForm({ title: '', description: '', store_id: '', assigned_to: '', priority: 'medium', due_date: '' });
    toast.success('Task created successfully!');
  };

  // Update Task Status
  const updateTaskStatus = (taskId, newStatus) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    ));
    toast.success('Task updated!');
  };

  // Copy store link
  const copyStoreLink = (store) => {
    const link = `${window.location.origin}/store/${store.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Store link copied!');
  };

  // Add keyword
  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    setKeywords(prev => [...prev, { word: newKeyword, rank: '-', volume: 0, trend: 'new' }]);
    setNewKeyword('');
    toast.success('Keyword added for tracking!');
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'pending': return <Circle className="w-4 h-4 text-gray-400" />;
      default: return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Connect Hub
          </h1>
          <p className="text-muted-foreground">AI Reviews, SEO, Chat & Task Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviews.filter(r => !r.replied).length}</p>
                <p className="text-xs text-muted-foreground">Pending Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{keywords.filter(k => k.trend === 'up').length}</p>
                <p className="text-xs text-muted-foreground">Trending Keywords</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{chatMessages.length}</p>
                <p className="text-xs text-muted-foreground">Chat Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <CheckSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</p>
                <p className="text-xs text-muted-foreground">Pending Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="reviews" className="gap-2">
            <Star className="w-4 h-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="w-4 h-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <CheckSquare className="w-4 h-4" />
            Tasks
          </TabsTrigger>
        </TabsList>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Google Reviews - AI Auto Reply
                  </CardTitle>
                  <CardDescription>
                    Manage and respond to customer reviews with AI-generated SEO-friendly replies
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedStoreForReviews} onValueChange={setSelectedStoreForReviews}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      {stores.map(store => (
                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fetchingReviews && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Connected stores info */}
              {Object.values(gmbConnections).some(c => c.connected) ? (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Showing real reviews from connected Google My Business accounts
                  </p>
                </div>
              ) : (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Showing demo reviews. Connect stores to Google My Business in the Locations tab to see real reviews.
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                {reviews
                  .filter(r => selectedStoreForReviews === 'all' || r.store_id === selectedStoreForReviews)
                  .map(review => (
                  <div key={review.id} className={`p-4 rounded-lg border ${review.replied ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : 'bg-card border-border'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={review.author_photo} />
                          <AvatarFallback>{review.author?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{review.author}</p>
                            {review.store_name && (
                              <Badge variant="outline" className="text-xs">{review.store_name}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < (review.rating_num || review.rating) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                            ))}
                            <span className="text-xs text-muted-foreground ml-2">{review.date}</span>
                          </div>
                        </div>
                      </div>
                      {review.replied ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Replied
                        </Badge>
                      ) : (
                        <Button 
                          size="sm" 
                          onClick={() => generateAIReply(review)}
                          disabled={generatingReply}
                          className="gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate AI Reply
                        </Button>
                      )}
                    </div>
                    <p className="mt-3 text-sm">{review.text}</p>
                    {review.reply && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs font-medium text-blue-600 mb-1">Your Reply:</p>
                        <p className="text-sm">{review.reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Reply Dialog */}
          <Dialog open={!!selectedReview && aiReply} onOpenChange={() => { setSelectedReview(null); setAiReply(''); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI Generated Reply
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-xs font-medium mb-1">Original Review by {selectedReview?.author}:</p>
                  <p className="text-sm">{selectedReview?.text}</p>
                </div>
                <div>
                  <Label>Your Reply (Edit if needed)</Label>
                  <Textarea 
                    value={aiReply}
                    onChange={(e) => setAiReply(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setSelectedReview(null); setAiReply(''); }}>
                  Cancel
                </Button>
                <Button onClick={postReply} className="gap-2" disabled={postingReply}>
                  {postingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {postingReply ? 'Posting...' : (selectedReview?.store_id !== 'mock' ? 'Post to Google' : 'Post Reply')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                SEO Keywords & Rankings
              </CardTitle>
              <CardDescription>
                Track your keyword rankings and optimize for search visibility
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="Add new keyword to track..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                />
                <Button onClick={addKeyword}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-accent">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium">Keyword</th>
                      <th className="p-3 text-center text-sm font-medium">Rank</th>
                      <th className="p-3 text-center text-sm font-medium">Search Volume</th>
                      <th className="p-3 text-center text-sm font-medium">Trend</th>
                      <th className="p-3 text-center text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3">
                          <span className="font-medium">{kw.word}</span>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={kw.rank <= 5 ? 'default' : 'secondary'}>
                            #{kw.rank}
                          </Badge>
                        </td>
                        <td className="p-3 text-center text-sm">{kw.volume.toLocaleString()}</td>
                        <td className="p-3 text-center">
                          {kw.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500 mx-auto" />}
                          {kw.trend === 'down' && <TrendingUp className="w-4 h-4 text-red-500 mx-auto rotate-180" />}
                          {kw.trend === 'stable' && <span className="text-gray-400">−</span>}
                          {kw.trend === 'new' && <Badge className="text-xs">NEW</Badge>}
                        </td>
                        <td className="p-3 text-center">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab - Google My Business Connections */}
        <TabsContent value="locations" className="space-y-4">
          {/* GMB Info Banner */}
          <Card className="bg-gradient-to-r from-blue-500/10 via-red-500/10 via-yellow-500/10 to-green-500/10 border-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-1">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">G</div>
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">o</div>
                  <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs font-bold">o</div>
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">g</div>
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">l</div>
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">e</div>
                </div>
                <div>
                  <h3 className="font-semibold">Connect to Google My Business</h3>
                  <p className="text-sm text-muted-foreground">
                    Link each store with its own Google account to manage reviews, SEO, and location data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-500" />
                Store Locations & GMB Connections
              </CardTitle>
              <CardDescription>
                Connect each store to Google My Business with their respective Gmail accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map(store => {
                  const connection = gmbConnections[store.id] || { connected: false };
                  const isConnecting = connectingStore === store.id;
                  
                  return (
                    <Card key={store.id} className={`overflow-hidden transition-all ${connection.connected ? 'ring-2 ring-green-500/50' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{store.name}</h3>
                            <p className="text-xs text-muted-foreground">{store.code}</p>
                          </div>
                          {connection.connected ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300">
                              <Link2 className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Not Connected
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{store.address || 'No address'}</span>
                          </div>
                          {store.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-4 h-4" />
                              <span>{store.phone}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* GMB Connection Info */}
                        {connection.connected && (
                          <div className="mt-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={connection.google_picture} />
                                <AvatarFallback className="text-xs">{connection.google_name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{connection.google_email}</p>
                                {connection.gmb_account_name && (
                                  <p className="text-xs text-muted-foreground truncate">{connection.gmb_account_name}</p>
                                )}
                              </div>
                            </div>
                            {connection.gmb_locations?.length > 0 && (
                              <p className="text-xs text-green-600 mt-1">
                                {connection.gmb_locations.length} GMB location(s) linked
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4">
                          {connection.connected ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => disconnectFromGMB(store)}
                              >
                                <Unlink className="w-4 h-4 mr-1" />
                                Disconnect
                              </Button>
                              <Button 
                                size="sm" 
                                className="flex-1"
                                onClick={() => { setSelectedStore(store); setShowQRModal(true); }}
                              >
                                <QrCode className="w-4 h-4 mr-1" />
                                QR Code
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1"
                                onClick={() => { setSelectedStore(store); setShowQRModal(true); }}
                              >
                                <QrCode className="w-4 h-4 mr-1" />
                                QR Code
                              </Button>
                              <Button 
                                size="sm" 
                                className="flex-1 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
                                onClick={() => connectToGMB(store)}
                                disabled={isConnecting}
                              >
                                {isConnecting ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <LogIn className="w-4 h-4 mr-1" />
                                )}
                                {isConnecting ? 'Connecting...' : 'Connect GMB'}
                              </Button>
                            </>
                          )}
                        </div>
                        
                        {/* Copy Link */}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="w-full mt-2 text-xs"
                          onClick={() => copyStoreLink(store)}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy Store Link
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* QR Code Modal */}
          <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  {selectedStore?.name} QR Code
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center p-6">
                {selectedStore && (
                  <QRCodeCanvas 
                    id="store-qr-canvas"
                    value={`${window.location.origin}/store/${selectedStore.id}`}
                    size={200}
                    level="H"
                    includeMargin
                  />
                )}
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Scan to view store location and details
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowQRModal(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  // Download QR code
                  const canvas = document.getElementById('store-qr-canvas');
                  if (canvas) {
                    const url = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `${selectedStore?.name}-qr.png`;
                    link.href = url;
                    link.click();
                    toast.success('QR code downloaded!');
                  }
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Online Users Sidebar */}
            <Card className="lg:col-span-1 h-[600px]">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  Online Staff ({onlineUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[520px]">
                  {onlineUsers.length > 0 ? (
                    <div className="space-y-2">
                      {onlineUsers.map(u => (
                        <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent">
                          <div className="relative">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">{u.name?.charAt(0) || '?'}</AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background"></span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No users online</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-3 h-[600px] flex flex-col">
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-500" />
                      Team Chat
                      {/* WebSocket Status Indicator */}
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        wsConnected 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {wsConnected ? 'Real-time' : 'Polling'}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Messages are shared across all stores - communicate with your entire team
                    </CardDescription>
                  </div>
                  <Button
                    variant={notificationsEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={enableNotifications}
                    className="gap-2"
                  >
                    <BellRing className="w-4 h-4" />
                    {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      chatMessages.map(msg => (
                        <div key={msg.id} className={`flex group ${msg.sender_id === user?.id || msg.sender === user?.name ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-2xl relative ${
                            msg.sender_id === user?.id || msg.sender === user?.name
                              ? 'bg-primary text-primary-foreground rounded-br-none' 
                              : msg.isBot 
                                ? 'bg-purple-100 dark:bg-purple-900/30 rounded-bl-none'
                                : 'bg-accent rounded-bl-none'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              {msg.isBot && <Bot className="w-4 h-4 text-purple-600" />}
                              <span className="text-xs font-medium opacity-80">{msg.sender}</span>
                              {msg.sender_role && msg.sender_role !== 'staff' && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">{msg.sender_role}</Badge>
                              )}
                              <span className="text-xs opacity-60">{msg.time}</span>
                            </div>
                            <p className="text-sm">{msg.text}</p>
                            {/* Message actions - show on hover */}
                            <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => viewMessage(msg)}
                                title="View details"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              {(msg.sender_id === user?.id || user?.role === 'superadmin') && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => deleteMessage(msg.id)}
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {/* Typing Indicator */}
                    {Object.keys(typingUsers).length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground animate-pulse">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span>
                          {Object.values(typingUsers).map(u => u.name).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                        </span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Type a message to your team..."
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      className="flex-1"
                      data-testid="chat-message-input"
                    />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()} data-testid="chat-send-button">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Messages are visible to all staff members across all stores
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-purple-500" />
                    Task Manager
                  </CardTitle>
                  <CardDescription>
                    Assign and track tasks for store staff
                  </CardDescription>
                </div>
                <Button onClick={() => setShowTaskModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <button onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}>
                          {getStatusIcon(task.status)}
                        </button>
                        <div>
                          <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {task.assigned_to}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {task.due_date}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Select 
                        value={task.status} 
                        onValueChange={(v) => updateTaskStatus(task.id, v)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* New Task Modal */}
          <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Task Title *</Label>
                  <Input 
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Enter task title"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Task description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Store</Label>
                    <Select value={taskForm.store_id} onValueChange={(v) => setTaskForm({ ...taskForm, store_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map(store => (
                          <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assign To</Label>
                    <Input 
                      value={taskForm.assigned_to}
                      onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                      placeholder="Assignee name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Priority</Label>
                    <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input 
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
                <Button onClick={createTask}>Create Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Message Detail Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Sender</Label>
                  <p className="font-medium">{selectedMessage.sender}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <p className="font-medium">{selectedMessage.sender_role || 'Staff'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <p className="font-medium">{selectedMessage.time}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Message ID</Label>
                  <p className="font-mono text-xs">{selectedMessage.id?.substring(0, 8)}...</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Message</Label>
                <div className="p-3 bg-accent rounded-lg mt-1">
                  <p className="whitespace-pre-wrap">{selectedMessage.text}</p>
                </div>
              </div>
              {(selectedMessage.sender_id === user?.id || user?.role === 'superadmin') && (
                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => deleteMessage(selectedMessage.id)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Message
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
