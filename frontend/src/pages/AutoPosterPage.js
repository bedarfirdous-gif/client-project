import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Image, Share2, Calendar, Plus, Sparkles, Instagram, Facebook,
  MessageCircle, Download, Clock, Send, Palette, Tag, Eye,
  Settings, Link, Unlink, Trash2, RefreshCw, CheckCircle, XCircle
} from 'lucide-react';
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
import { Checkbox } from '../components/ui/checkbox';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AutoPosterPage() {
  // Use stable auth state to avoid flicker caused by initial `user` being null and then updating.
  const { user, loading: authLoading } = useAuth();

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [posters, setPosters] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  // FIX: Avoid null-initialized state to prevent a brief "empty" render followed by a populated render.
  // Use a stable default and an explicit loaded flag instead.
  const [analytics, setAnalytics] = useState({});
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('posters');
  const [businessInfo, setBusinessInfo] = useState({ business_name: 'Your Business', brand_colors: [], logo_url: null });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFestivalModal, setShowFestivalModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // FIX: Initialize modal payloads with stable defaults + loaded flags to avoid mount-time flashing.
  const [scheduleModalData, setScheduleModalData] = useState({});
  const [scheduleModalDataLoaded, setScheduleModalDataLoaded] = useState(false);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewModalData, setPreviewModalData] = useState({});
  const [previewModalDataLoaded, setPreviewModalDataLoaded] = useState(false);
  
  // Create poster form
  const [posterForm, setPosterForm] = useState({
    title: '',
    formats: ['instagram_post'],
    campaign_type: 'custom',
    product_ids: [],
    offer_text: '',
    festival_id: '',
    custom_message: '',
    include_logo: true,
    style: 'colorful'
  });
  
  // Festival form
  const [festivalForm, setFestivalForm] = useState({
    name: '',
    date: '',
    description: '',
    themes: [],
    colors: []
  });
  
  // Connect account form
  const [connectForm, setConnectForm] = useState({
    platform: 'facebook',
    access_token: '',
    page_id: ''
  });

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

  const fetchPosters = useCallback(async () => {
    try {
      const data = await api('/api/posters');
      setPosters(data.posters || []);
    } catch (err) {
      console.error('Failed to fetch posters:', err);
    }
  }, [api]);

  const fetchFestivals = useCallback(async () => {
    try {
      const data = await api('/api/posters/festivals');
      setFestivals(data.festivals || []);
    } catch (err) {
      console.error('Failed to fetch festivals:', err);
    }
  }, [api]);

  const fetchScheduledPosts = useCallback(async () => {
    try {
      const data = await api('/api/posters/schedule');
      setScheduledPosts(data.scheduled_posts || []);
    } catch (err) {
      console.error('Failed to fetch scheduled posts:', err);
    }
  }, [api]);

  const fetchConnectedAccounts = useCallback(async () => {
    try {
      const data = await api('/api/posters/social/accounts');
      setConnectedAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, [api]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await api('/api/posters/analytics');
      setAnalytics(data.analytics);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, [api]);

  const fetchBusinessInfo = useCallback(async () => {
    try {
      const data = await api('/api/posters/business-info');
      setBusinessInfo(data);
    } catch (err) {
      console.error('Failed to fetch business info:', err);
    }
  }, [api]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPosters(),
        fetchFestivals(),
        fetchScheduledPosts(),
        fetchConnectedAccounts(),
        fetchAnalytics(),
        fetchBusinessInfo()
      ]);
      setLoading(false);
    };
    // Only load data if user is authenticated
    if (!authLoading && user) {
      loadData();
    }
  }, [fetchPosters, fetchFestivals, fetchScheduledPosts, fetchConnectedAccounts, fetchAnalytics, fetchBusinessInfo, authLoading, user]);

  // Early returns AFTER all hooks are defined
  if (authLoading) {
    return null; // or return a skeleton loader
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleGeneratePoster = async () => {
    if (!posterForm.title.trim()) {
      toast.error('Please enter a poster title');
      return;
    }

    setGenerating(true);
    try {
      const response = await api('/api/posters/generate', {
        method: 'POST',
        body: JSON.stringify(posterForm)
      });
      toast.success(response.message || 'Poster generated!');
      setShowCreateModal(false);
      resetPosterForm();
      fetchPosters();
      fetchAnalytics();
    } catch (err) {
      toast.error(err.message || 'Failed to generate poster');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddFestival = async () => {
    if (!festivalForm.name.trim() || !festivalForm.date) {
      toast.error('Please enter festival name and date');
      return;
    }

    try {
      const response = await api('/api/posters/festivals', {
        method: 'POST',
        body: JSON.stringify(festivalForm)
      });
      toast.success(response.message || 'Festival added!');
      setShowFestivalModal(false);
      setFestivalForm({ name: '', date: '', description: '', themes: [], colors: [] });
      fetchFestivals();
    } catch (err) {
      toast.error(err.message || 'Failed to add festival');
    }
  };

  const handleConnectAccount = async () => {
    if (!connectForm.access_token.trim()) {
      toast.error('Please enter access token');
      return;
    }

    try {
      const response = await api('/api/posters/social/connect', {
        method: 'POST',
        body: JSON.stringify(connectForm)
      });
      toast.success(response.message || 'Account connected!');
      setShowConnectModal(false);
      setConnectForm({ platform: 'facebook', access_token: '', page_id: '' });
      fetchConnectedAccounts();
    } catch (err) {
      toast.error(err.message || 'Failed to connect account');
    }
  };

  const handleDisconnectAccount = async (platform) => {
    if (!window.confirm(`Disconnect ${platform}?`)) return;

    try {
      await api(`/api/posters/social/${platform}`, { method: 'DELETE' });
      toast.success('Account disconnected');
      fetchConnectedAccounts();
    } catch (err) {
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  const handlePublishNow = async (posterId, platforms) => {
    if (platforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    try {
      const response = await api(`/api/posters/${posterId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ platforms })
      });
      
      if (response.all_success) {
        toast.success('Published successfully!');
      } else {
        toast.warning('Published with some errors');
      }
      fetchPosters();
    } catch (err) {
      toast.error(err.message || 'Failed to publish');
    }
  };

  const handleSchedulePost = async (posterId, scheduledTime, platforms) => {
    try {
      const response = await api('/api/posters/schedule', {
        method: 'POST',
        body: JSON.stringify({
          poster_id: posterId,
          platforms,
          scheduled_time: scheduledTime
        })
      });
      toast.success('Post scheduled!');
      setShowScheduleModal(null);
      fetchScheduledPosts();
    } catch (err) {
      toast.error(err.message || 'Failed to schedule');
    }
  };

  const resetPosterForm = () => {
    setPosterForm({
      title: '',
      formats: ['instagram_post'],
      campaign_type: 'custom',
      product_ids: [],
      offer_text: '',
      festival_id: '',
      custom_message: '',
      include_logo: true,
      style: 'colorful'
    });
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      default: return <Share2 className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/10 text-gray-500';
      case 'scheduled': return 'bg-blue-500/10 text-blue-500';
      case 'published': return 'bg-green-500/10 text-green-500';
      case 'failed': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getCampaignIcon = (type) => {
    switch (type) {
      case 'sale': return '🏷️';
      case 'new_arrivals': return '✨';
      case 'offers': return '💰';
      case 'festival': return '🎉';
      default: return '📢';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" data-testid="auto-poster-page">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Image className="w-8 h-8 text-primary" />
              Auto Poster Studio
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">
                AI-powered marketing posters for
              </p>
              <span className="font-semibold text-primary" data-testid="business-name-display">
                {businessInfo.business_name}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFestivalModal(true)}>
              <Calendar className="w-4 h-4 mr-2" />
              Add Festival
            </Button>
            {canManage && (
              <Button onClick={() => setShowCreateModal(true)} data-testid="create-poster-btn">
                <Sparkles className="w-4 h-4 mr-2" />
                Create Poster
              </Button>
            )}
          </div>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Image className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.total_posters || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Posters</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Share2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{connectedAccounts.length}</p>
                    <p className="text-sm text-muted-foreground">Connected Accounts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.posts_by_status?.published || 0}</p>
                    <p className="text-sm text-muted-foreground">Published</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{scheduledPosts.filter(p => p.status === 'scheduled').length}</p>
                    <p className="text-sm text-muted-foreground">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Connected Accounts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Connected Accounts</CardTitle>
                <CardDescription>Social media platforms for auto-posting</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowConnectModal(true)}>
                <Link className="w-4 h-4 mr-2" />
                Connect Account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {['facebook', 'instagram', 'whatsapp'].map(platform => {
                const isConnected = connectedAccounts.some(a => a.platform === platform);
                return (
                  <div
                    key={platform}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                      isConnected ? 'border-green-500 bg-green-500/10' : 'border-dashed'
                    }`}
                  >
                    {getPlatformIcon(platform)}
                    <span className="capitalize">{platform}</span>
                    {isConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDisconnectAccount(platform)}
                        >
                          <Unlink className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="posters" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Posters ({posters.length})
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Scheduled ({scheduledPosts.length})
            </TabsTrigger>
            <TabsTrigger value="festivals" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Festivals ({festivals.length})
            </TabsTrigger>
          </TabsList>

          {/* Posters Tab */}
          <TabsContent value="posters" className="space-y-4">
            {posters.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Posters Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first AI-generated marketing poster
                  </p>
                  {canManage && (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Poster
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posters.map(poster => (
                  <Card key={poster.id} className="overflow-hidden">
                    <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center relative">
                      <Image className="w-16 h-16 text-muted-foreground/50" />
                      <Badge className={`absolute top-2 right-2 ${getStatusColor(poster.status)}`}>
                        {poster.status}
                      </Badge>
                      <span className="absolute top-2 left-2 text-2xl">
                        {getCampaignIcon(poster.campaign_type)}
                      </span>
                    </div>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-1">{poster.title}</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {poster.formats?.join(', ') || 'No formats'}
                      </p>
                      
                      {/* Caption preview */}
                      {poster.caption && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {poster.caption}
                        </p>
                      )}
                      
                      {/* Hashtags */}
                      {poster.hashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {poster.hashtags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {poster.hashtags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{poster.hashtags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setShowPreviewModal(poster)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            if (connectedAccounts.length === 0) {
                              toast.info('Please connect a social media account first. Go to the Accounts tab.');
                              setActiveTab('accounts');
                            } else {
                              setShowScheduleModal(poster);
                            }
                          }}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Share
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Scheduled Tab */}
          <TabsContent value="scheduled" className="space-y-4">
            {scheduledPosts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No Scheduled Posts</h3>
                  <p className="text-muted-foreground">
                    Schedule posters for automatic publishing
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {scheduledPosts.map(post => (
                  <Card key={post.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                            <Image className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div>
                            <h4 className="font-medium">Post #{post.id.slice(0, 8)}</h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(post.scheduled_time).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {post.platforms?.map(p => (
                              <span key={p} className="p-1.5 bg-accent rounded">
                                {getPlatformIcon(p)}
                              </span>
                            ))}
                          </div>
                          <Badge className={getStatusColor(post.status)}>
                            {post.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Festivals Tab */}
          <TabsContent value="festivals" className="space-y-4">
            {festivals.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Festivals Added</h3>
                  <p className="text-muted-foreground mb-4">
                    Add festivals to create themed marketing campaigns
                  </p>
                  <Button onClick={() => setShowFestivalModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Festival
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {festivals.map(festival => (
                  <Card key={festival.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">🎉</span>
                        <div>
                          <h4 className="font-medium">{festival.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(festival.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {festival.themes?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {festival.themes.map((theme, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Poster Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Create AI Poster
            </DialogTitle>
            <DialogDescription>
              Generate a marketing poster using AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Poster Title *</Label>
              <Input
                value={posterForm.title}
                onChange={(e) => setPosterForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Summer Sale 2026"
                data-testid="poster-title-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <Select
                value={posterForm.campaign_type}
                onValueChange={(v) => setPosterForm(prev => ({ ...prev, campaign_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="sale">Sale / Discount</SelectItem>
                  <SelectItem value="new_arrivals">New Arrivals</SelectItem>
                  <SelectItem value="offers">Special Offers</SelectItem>
                  <SelectItem value="festival">Festival</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Offer Text (Optional)</Label>
              <Input
                value={posterForm.offer_text}
                onChange={(e) => setPosterForm(prev => ({ ...prev, offer_text: e.target.value }))}
                placeholder="e.g., 50% OFF, Buy 1 Get 1 Free"
              />
            </div>

            {posterForm.campaign_type === 'festival' && festivals.length > 0 && (
              <div className="space-y-2">
                <Label>Select Festival</Label>
                <Select
                  value={posterForm.festival_id}
                  onValueChange={(v) => setPosterForm(prev => ({ ...prev, festival_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a festival" />
                  </SelectTrigger>
                  <SelectContent>
                    {festivals.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        🎉 {f.name} ({new Date(f.date).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Custom Message (Optional)</Label>
              <Textarea
                value={posterForm.custom_message}
                onChange={(e) => setPosterForm(prev => ({ ...prev, custom_message: e.target.value }))}
                placeholder="Add any custom text for the poster..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Poster Formats</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'instagram_post', label: 'Instagram Post', icon: <Instagram className="w-4 h-4" /> },
                  { id: 'instagram_story', label: 'Instagram Story', icon: <Instagram className="w-4 h-4" /> },
                  { id: 'facebook_post', label: 'Facebook Post', icon: <Facebook className="w-4 h-4" /> },
                  { id: 'whatsapp_status', label: 'WhatsApp Status', icon: <MessageCircle className="w-4 h-4" /> }
                ].map(format => (
                  <label
                    key={format.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      posterForm.formats.includes(format.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox
                      checked={posterForm.formats.includes(format.id)}
                      onCheckedChange={(checked) => {
                        setPosterForm(prev => ({
                          ...prev,
                          formats: checked
                            ? [...prev.formats, format.id]
                            : prev.formats.filter(f => f !== format.id)
                        }));
                      }}
                    />
                    {format.icon}
                    <span className="text-sm">{format.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Style</Label>
              <Select
                value={posterForm.style}
                onValueChange={(v) => setPosterForm(prev => ({ ...prev, style: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colorful">Colorful & Vibrant</SelectItem>
                  <SelectItem value="minimal">Minimal & Clean</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="festive">Festive & Fun</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Include Brand Logo</Label>
              <Switch
                checked={posterForm.include_logo}
                onCheckedChange={(v) => setPosterForm(prev => ({ ...prev, include_logo: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGeneratePoster} 
              disabled={generating || !posterForm.title.trim() || posterForm.formats.length === 0}
              data-testid="generate-poster-btn"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Poster
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Festival Modal */}
      <Dialog open={showFestivalModal} onOpenChange={setShowFestivalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Festival</DialogTitle>
            <DialogDescription>
              Add festivals for themed marketing campaigns
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Festival Name *</Label>
              <Input
                value={festivalForm.name}
                onChange={(e) => setFestivalForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Diwali, Christmas, New Year"
              />
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={festivalForm.date}
                onChange={(e) => setFestivalForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={festivalForm.description}
                onChange={(e) => setFestivalForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFestivalModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFestival}>
              <Plus className="w-4 h-4 mr-2" />
              Add Festival
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Account Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Social Account</DialogTitle>
            <DialogDescription>
              Link your social media accounts for auto-posting
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={connectForm.platform}
                onValueChange={(v) => setConnectForm(prev => ({ ...prev, platform: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">
                    <span className="flex items-center gap-2">
                      <Facebook className="w-4 h-4" /> Facebook
                    </span>
                  </SelectItem>
                  <SelectItem value="instagram">
                    <span className="flex items-center gap-2">
                      <Instagram className="w-4 h-4" /> Instagram
                    </span>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <span className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access Token *</Label>
              <Input
                value={connectForm.access_token}
                onChange={(e) => setConnectForm(prev => ({ ...prev, access_token: e.target.value }))}
                placeholder="Paste your access token"
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Get this from the platform&apos;s developer settings
              </p>
            </div>

            {connectForm.platform === 'facebook' && (
              <div className="space-y-2">
                <Label>Page ID (Optional)</Label>
                <Input
                  value={connectForm.page_id}
                  onChange={(e) => setConnectForm(prev => ({ ...prev, page_id: e.target.value }))}
                  placeholder="Your Facebook Page ID"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnectAccount}>
              <Link className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!showPreviewModal} onOpenChange={() => setShowPreviewModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Poster Preview</DialogTitle>
            <DialogDescription>
              {showPreviewModal?.title}
            </DialogDescription>
          </DialogHeader>
          
          {showPreviewModal && (
            <div className="space-y-4">
              {/* Poster Image */}
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                {showPreviewModal.image_url ? (
                  <img loading="lazy" 
                    src={showPreviewModal.image_url} 
                    alt={showPreviewModal.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Image className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Poster Details */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Caption</h4>
                  <p className="text-sm mt-1">{showPreviewModal.caption || 'No caption'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Type</h4>
                    <p className="text-sm capitalize">{showPreviewModal.poster_type || 'Custom'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Style</h4>
                    <p className="text-sm capitalize">{showPreviewModal.style || 'Default'}</p>
                  </div>
                </div>
                
                {showPreviewModal.hashtags?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Hashtags</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {showPreviewModal.hashtags.map((tag, idx) => (
                        <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Created</h4>
                  <p className="text-sm">{new Date(showPreviewModal.created_at).toLocaleString()}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    if (showPreviewModal.image_url) {
                      window.open(showPreviewModal.image_url, '_blank');
                    }
                  }}
                  disabled={!showPreviewModal.image_url}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Open Full Size
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => {
                    setShowPreviewModal(null);
                    setShowScheduleModal(showPreviewModal);
                  }}
                  disabled={connectedAccounts.length === 0}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule/Publish Modal */}
      <Dialog open={!!showScheduleModal} onOpenChange={() => setShowScheduleModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Poster</DialogTitle>
            <DialogDescription>
              Publish now or schedule for later
            </DialogDescription>
          </DialogHeader>
          
          {showScheduleModal && (
            <SchedulePostForm
              poster={showScheduleModal}
              connectedAccounts={connectedAccounts}
              onPublishNow={handlePublishNow}
              onSchedule={handleSchedulePost}
              onClose={() => setShowScheduleModal(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Schedule Post Form Component
function SchedulePostForm({ poster, connectedAccounts, onPublishNow, onSchedule, onClose }) {
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduledTime, setScheduledTime] = useState('');

  const togglePlatform = (platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = () => {
    if (selectedPlatforms.length === 0) {
      return;
    }

    if (scheduleMode === 'now') {
      onPublishNow(poster.id, selectedPlatforms);
    } else {
      if (!scheduledTime) return;
      onSchedule(poster.id, new Date(scheduledTime).toISOString(), selectedPlatforms);
    }
    onClose();
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Select Platforms</Label>
        <div className="grid grid-cols-3 gap-2">
          {connectedAccounts.map(account => (
            <label
              key={account.platform}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedPlatforms.includes(account.platform)
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Checkbox
                checked={selectedPlatforms.includes(account.platform)}
                onCheckedChange={() => togglePlatform(account.platform)}
              />
              {account.platform === 'facebook' && <Facebook className="w-5 h-5" />}
              {account.platform === 'instagram' && <Instagram className="w-5 h-5" />}
              {account.platform === 'whatsapp' && <MessageCircle className="w-5 h-5" />}
              <span className="text-xs capitalize">{account.platform}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>When to Post</Label>
        <div className="flex gap-2">
          <Button
            variant={scheduleMode === 'now' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setScheduleMode('now')}
          >
            <Send className="w-4 h-4 mr-2" />
            Now
          </Button>
          <Button
            variant={scheduleMode === 'later' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setScheduleMode('later')}
          >
            <Clock className="w-4 h-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {scheduleMode === 'later' && (
        <div className="space-y-2">
          <Label>Schedule Time</Label>
          <Input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={selectedPlatforms.length === 0 || (scheduleMode === 'later' && !scheduledTime)}
        >
          {scheduleMode === 'now' ? 'Publish Now' : 'Schedule Post'}
        </Button>
      </div>
    </div>
  );
}
