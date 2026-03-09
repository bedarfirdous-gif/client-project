import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, FileText, Image, Camera, Scan, 
  Users, CheckCircle, AlertTriangle, Clock, Trash2, Edit,
  Eye, Download, RefreshCw, ChevronRight, ChevronDown, X,
  Loader2, FileJson, Check, AlertCircle, Sparkles, Zap,
  ArrowRight, Save, SkipForward, Play, Globe, Link
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';

// File type icons
const FILE_ICONS = {
  excel: FileSpreadsheet,
  csv: FileText,
  json: FileJson,
  pdf: FileText,
  image: Image,
  web_page: Globe,
};

// Status colors
const STATUS_COLORS = {
  pending: 'bg-gray-500',
  processing: 'bg-blue-500',
  review: 'bg-amber-500',
  approved: 'bg-green-500',
  imported: 'bg-emerald-500',
  failed: 'bg-red-500',
};

// Confidence badge component (moved outside to avoid re-renders)
const ConfidenceBadge = ({ score }) => {
  if (score === undefined || score === null) return null;
  const color = score >= 0.9 ? 'bg-green-500' : score >= 0.7 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${color} ml-1`} title={`Confidence: ${Math.round(score * 100)}%`} />
  );
};

export default function CustomerImportPage() {
  const { api } = useAuth();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Main states
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [stats, setStats] = useState({ total_batches: 0, pending_review: 0, total_extracted: 0, total_imported: 0 });

  // Upload states
  // FIX: Avoid `undefined` initial state when UI branches on truthiness; it can cause a brief
  // mismatch/flash on mount during the first render. Use a stable initial value instead.
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [directImport, setDirectImport] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  // FIX: Keep camera stream explicitly null when absent (stable) rather than undefined to prevent
  // conditional UI flicker between "no stream" and "stream pending".
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraStreamReady, setIsCameraStreamReady] = useState(false);
  // Same pattern for captured image: explicit readiness avoids conditional flashes.
  const [capturedImage, setCapturedImage] = useState('');
  const [hasCapturedImage, setHasCapturedImage] = useState(false);

  // Review states
  // Use a stable initial value + explicit selection state rather than undefined.
  const [selectedBatch, setSelectedBatch] = useState('');
  const [hasSelectedBatch, setHasSelectedBatch] = useState(false);
  const [stagingCustomers, setStagingCustomers] = useState([]);
  // FIX: Stable "no customer" value avoids `undefined -> object` flashes in conditional rendering.
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [importing, setImporting] = useState(false);

  // URL Scraper states
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeAuth, setScrapeAuth] = useState({ type: 'none', username: '', password: '' });
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    fetchBatches();
    fetchStats();
  }, []);

  const fetchBatches = async () => {
    try {
      const data = await api('/api/customers/import/batches');
      setBatches(data);
    } catch (err) {
      console.error('Failed to fetch batches', err);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api('/api/customers/import/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchStagingCustomers = async (batchId) => {
    try {
      setLoading(true);
      const data = await api(`/api/customers/import/batches/${batchId}/staging`);
      setStagingCustomers(data);
    } catch (err) {
      toast.error('Failed to load staging customers');
    } finally {
      setLoading(false);
    }
  };

  // File Upload handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('source', 'manual_upload');
      formData.append('direct_import', directImport.toString());

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/customers/import/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Upload failed');
      }

      toast.success(`Extracted ${result.total_extracted} customers!`);
      setSelectedFile(null);
      fetchBatches();
      fetchStats();

      if (!directImport && result.total_extracted > 0) {
        // Open review modal
        setSelectedBatch(result.batch_id);
        await fetchStagingCustomers(result.batch_id);
        setShowReviewModal(true);
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Camera handlers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setCameraStream(stream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error('Failed to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
    setCapturedImage(null);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
    }
  };

  const scanCapturedImage = async () => {
    if (!capturedImage) return;

    setUploading(true);
    try {
      const result = await api('/api/customers/import/scan', {
        method: 'POST',
        body: JSON.stringify({
          image_data: capturedImage,
          source: 'camera_scan',
          direct_import: directImport,
        }),
      });

      toast.success(`Extracted ${result.total_extracted} customers from scan!`);
      stopCamera();
      fetchBatches();
      fetchStats();

      if (!directImport && result.total_extracted > 0) {
        setSelectedBatch(result.batch_id);
        await fetchStagingCustomers(result.batch_id);
        setShowReviewModal(true);
      }
    } catch (err) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setUploading(false);
    }
  };

  // URL Scraper function
  const scrapeWebPage = async () => {
    if (!scrapeUrl) {
      toast.error('Please enter a URL');
      return;
    }

    // Validate URL
    try {
      new URL(scrapeUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setScraping(true);
    try {
      const result = await api('/api/customers/import/scrape-url', {
        method: 'POST',
        body: JSON.stringify({
          url: scrapeUrl,
          direct_import: directImport,
          auth_type: scrapeAuth.type,
          username: scrapeAuth.type === 'basic' ? scrapeAuth.username : null,
          password: scrapeAuth.type === 'basic' ? scrapeAuth.password : null,
        }),
      });

      toast.success(`Extracted ${result.total_extracted} customers from URL!`);
      setScrapeUrl('');
      fetchBatches();
      fetchStats();

      if (!directImport && result.total_extracted > 0) {
        setSelectedBatch(result.batch_id);
        await fetchStagingCustomers(result.batch_id);
        setShowReviewModal(true);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to scrape URL');
    } finally {
      setScraping(false);
    }
  };

  // Review handlers
  const openBatchReview = async (batch) => {
    setSelectedBatch(batch.id);
    await fetchStagingCustomers(batch.id);
    setShowReviewModal(true);
  };

  const updateStagingCustomer = async (customer) => {
    try {
      await api(`/api/customers/import/staging/${customer.id}`, {
        method: 'PUT',
        body: JSON.stringify(customer),
      });
      toast.success('Customer updated');
      await fetchStagingCustomers(selectedBatch);
    } catch (err) {
      toast.error('Failed to update customer');
    }
  };

  const deleteStagingCustomer = async (customerId) => {
    if (!window.confirm('Remove this customer from import?')) return;
    try {
      await api(`/api/customers/import/staging/${customerId}`, { method: 'DELETE' });
      toast.success('Customer removed');
      await fetchStagingCustomers(selectedBatch);
    } catch (err) {
      toast.error('Failed to remove customer');
    }
  };

  const approveAndImport = async (selectedIds = null) => {
    setImporting(true);
    try {
      const result = await api(`/api/customers/import/batches/${selectedBatch}/approve`, {
        method: 'POST',
        body: JSON.stringify(selectedIds),
      });

      toast.success(`Imported ${result.imported} customers!`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} customers failed to import`);
      }

      setShowReviewModal(false);
      fetchBatches();
      fetchStats();
    } catch (err) {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const deleteBatch = async (batchId) => {
    if (!window.confirm('Delete this import batch and all its data?')) return;
    try {
      await api(`/api/customers/import/batches/${batchId}`, { method: 'DELETE' });
      toast.success('Batch deleted');
      fetchBatches();
      fetchStats();
    } catch (err) {
      toast.error('Failed to delete batch');
    }
  };

  // Get file icon
  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls'].includes(ext)) return FILE_ICONS.excel;
    if (ext === 'csv') return FILE_ICONS.csv;
    if (ext === 'json') return FILE_ICONS.json;
    if (ext === 'pdf') return FILE_ICONS.pdf;
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return FILE_ICONS.image;
    return FileText;
  };

  return (
    <div className="space-y-6" data-testid="customer-import-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Customer Bulk Import
          </h1>
          <p className="text-muted-foreground">Upload, scan, or extract customer data using AI</p>
        </div>
        <Button variant="outline" onClick={() => { fetchBatches(); fetchStats(); }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="pt-4 pb-4">
            <Upload className="w-6 h-6 text-blue-600 mb-2" />
            <p className="text-xs text-muted-foreground">Total Batches</p>
            <p className="text-2xl font-bold text-blue-600">{stats.total_batches}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="pt-4 pb-4">
            <Clock className="w-6 h-6 text-amber-600 mb-2" />
            <p className="text-xs text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending_review}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="pt-4 pb-4">
            <Sparkles className="w-6 h-6 text-purple-600 mb-2" />
            <p className="text-xs text-muted-foreground">Total Extracted</p>
            <p className="text-2xl font-bold text-purple-600">{stats.total_extracted}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="pt-4 pb-4">
            <CheckCircle className="w-6 h-6 text-emerald-600 mb-2" />
            <p className="text-xs text-muted-foreground">Total Imported</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.total_imported}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Globe className="w-4 h-4" /> URL Scraper
          </TabsTrigger>
          <TabsTrigger value="scan" className="flex items-center gap-2">
            <Scan className="w-4 h-4" /> Scanner
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex items-center gap-2">
            <Camera className="w-4 h-4" /> Camera
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> History
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                AI-Powered File Import
              </CardTitle>
              <CardDescription>
                Upload Excel, CSV, JSON, PDF, or image files. AI will automatically extract customer data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json,.pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-4">
                    {React.createElement(getFileIcon(selectedFile.name), { className: 'w-12 h-12 text-primary' })}
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Drop your file here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Supports: Excel (.xlsx, .xls), CSV, JSON, PDF, Images (JPG, PNG)
                    </p>
                  </div>
                )}
              </div>

              {/* Supported Formats */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-600' },
                  { icon: FileText, label: 'CSV', color: 'text-blue-600' },
                  { icon: FileJson, label: 'JSON', color: 'text-amber-600' },
                  { icon: FileText, label: 'PDF', color: 'text-red-600' },
                  { icon: Image, label: 'Image', color: 'text-purple-600' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                    <Icon className={`w-6 h-6 ${color} mb-1`} />
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>

              {/* Options */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">Direct Import</p>
                  <p className="text-sm text-muted-foreground">Skip review and import customers directly</p>
                </div>
                <Switch checked={directImport} onCheckedChange={setDirectImport} />
              </div>

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full bg-primary"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Extract Customers with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* URL Scraper Tab */}
        <TabsContent value="url" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Web Page Scraper
              </CardTitle>
              <CardDescription>
                Extract customer data from web pages like EzoBooks, Tally, or any website with customer lists
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* URL Input */}
              <div className="space-y-2">
                <Label>Website URL</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="https://app.ezobooks.in/party"
                      value={scrapeUrl}
                      onChange={(e) => setScrapeUrl(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter the URL of the page containing customer data (tables, lists)
                </p>
              </div>

              {/* Authentication Options */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/30">
                <Label>Authentication (if required)</Label>
                <div className="flex gap-4">
                  <Button
                    variant={scrapeAuth.type === 'none' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScrapeAuth({ ...scrapeAuth, type: 'none' })}
                  >
                    No Auth
                  </Button>
                  <Button
                    variant={scrapeAuth.type === 'basic' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setScrapeAuth({ ...scrapeAuth, type: 'basic' })}
                  >
                    Basic Auth
                  </Button>
                </div>

                {scrapeAuth.type === 'basic' && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        placeholder="Username or Email"
                        value={scrapeAuth.username}
                        onChange={(e) => setScrapeAuth({ ...scrapeAuth, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder="Password"
                        value={scrapeAuth.password}
                        onChange={(e) => setScrapeAuth({ ...scrapeAuth, password: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* What we extract */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                  <Users className="w-8 h-8 text-green-600 mb-2" />
                  <h4 className="font-semibold">Party Name</h4>
                  <p className="text-sm text-muted-foreground">Customer/Party names from tables</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200">
                  <Zap className="w-8 h-8 text-blue-600 mb-2" />
                  <h4 className="font-semibold">Phone Number</h4>
                  <p className="text-sm text-muted-foreground">Mobile and contact numbers</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200">
                  <Globe className="w-8 h-8 text-purple-600 mb-2" />
                  <h4 className="font-semibold">Address</h4>
                  <p className="text-sm text-muted-foreground">Full address information</p>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">Direct Import</p>
                  <p className="text-sm text-muted-foreground">Skip review and import customers directly</p>
                </div>
                <Switch checked={directImport} onCheckedChange={setDirectImport} />
              </div>

              {/* Scrape Button */}
              <Button
                onClick={scrapeWebPage}
                disabled={!scrapeUrl || scraping}
                className="w-full bg-primary"
                size="lg"
              >
                {scraping ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Scraping Page...
                  </>
                ) : (
                  <>
                    <Globe className="w-5 h-5 mr-2" />
                    Extract Customers from URL
                  </>
                )}
              </Button>

              {/* Supported Sites */}
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Tip:</strong> Works best with pages that have HTML tables containing customer data. 
                  For pages requiring login, use Basic Auth or first login manually and provide session cookies.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Smart Scanner Tab */}
        <TabsContent value="scan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-primary" />
                Smart Document Scanner
              </CardTitle>
              <CardDescription>
                Upload scanned documents, invoices, business cards, or any document with customer information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scan Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Scan className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium text-lg">Upload Document to Scan</p>
                <p className="text-sm text-muted-foreground mt-2">
                  AI will extract customer names, phone numbers, emails, addresses, GST numbers, and more
                </p>
              </div>

              {/* AI Features */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200">
                  <Sparkles className="w-8 h-8 text-purple-600 mb-2" />
                  <h4 className="font-semibold">OCR Extraction</h4>
                  <p className="text-sm text-muted-foreground">Reads text from images and scanned documents</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200">
                  <Zap className="w-8 h-8 text-blue-600 mb-2" />
                  <h4 className="font-semibold">Smart Field Detection</h4>
                  <p className="text-sm text-muted-foreground">Auto-identifies customer fields using AI</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200">
                  <AlertTriangle className="w-8 h-8 text-amber-600 mb-2" />
                  <h4 className="font-semibold">Confidence Scoring</h4>
                  <p className="text-sm text-muted-foreground">Highlights low-confidence fields for review</p>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">Direct Import</p>
                  <p className="text-sm text-muted-foreground">Skip review and import customers directly</p>
                </div>
                <Switch checked={directImport} onCheckedChange={setDirectImport} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Camera Tab */}
        <TabsContent value="camera" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Camera Scanner
              </CardTitle>
              <CardDescription>
                Use your device camera to scan documents, business cards, or invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!cameraActive ? (
                <div className="text-center py-8">
                  <Camera className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-4">Camera Preview</p>
                  <Button onClick={startCamera} className="bg-primary" size="lg">
                    <Camera className="w-5 h-5 mr-2" />
                    Start Camera
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    {!capturedImage ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full max-h-[400px] object-contain"
                      />
                    ) : (
                      <img loading="lazy" src={capturedImage} alt="Captured" className="w-full max-h-[400px] object-contain" />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  <div className="flex justify-center gap-4">
                    {!capturedImage ? (
                      <>
                        <Button onClick={captureImage} className="bg-primary" size="lg">
                          <Camera className="w-5 h-5 mr-2" />
                          Capture
                        </Button>
                        <Button onClick={stopCamera} variant="outline" size="lg">
                          <X className="w-5 h-5 mr-2" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={scanCapturedImage} disabled={uploading} className="bg-primary" size="lg">
                          {uploading ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Scanning...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 mr-2" />
                              Extract with AI
                            </>
                          )}
                        </Button>
                        <Button onClick={() => setCapturedImage(null)} variant="outline" size="lg">
                          <RefreshCw className="w-5 h-5 mr-2" />
                          Retake
                        </Button>
                        <Button onClick={stopCamera} variant="outline" size="lg">
                          <X className="w-5 h-5 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">Direct Import</p>
                  <p className="text-sm text-muted-foreground">Skip review and import customers directly</p>
                </div>
                <Switch checked={directImport} onCheckedChange={setDirectImport} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Import History
              </CardTitle>
              <CardDescription>View and manage your import batches</CardDescription>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No import batches yet</p>
                  <p className="text-sm">Upload a file to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {batches.map((batch) => {
                    const FileIcon = getFileIcon(batch.filename);
                    const statusColor = STATUS_COLORS[batch.status] || 'bg-gray-500';
                    
                    return (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileIcon className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{batch.filename}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{batch.source?.replace('_', ' ')}</span>
                              <span>•</span>
                              <span>{new Date(batch.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold">{batch.total_extracted} extracted</p>
                            <p className="text-sm text-muted-foreground">
                              {batch.total_imported} imported
                            </p>
                          </div>
                          <Badge className={`${statusColor} text-white`}>
                            {batch.status}
                          </Badge>
                          <div className="flex gap-2">
                            {batch.status === 'review' && (
                              <Button
                                size="sm"
                                onClick={() => openBatchReview(batch)}
                                className="bg-primary"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Review
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteBatch(batch.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Review Extracted Customers
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : stagingCustomers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No customers to review</p>
            ) : (
              <div className="space-y-3">
                {stagingCustomers.map((customer, idx) => (
                  <Card key={customer.id} className={customer.needs_review ? 'border-amber-300' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 grid md:grid-cols-2 gap-4">
                          {/* Left Column */}
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Name</Label>
                              <div className="flex items-center">
                                <Input
                                  value={customer.name || ''}
                                  onChange={(e) => {
                                    const updated = [...stagingCustomers];
                                    updated[idx].name = e.target.value;
                                    setStagingCustomers(updated);
                                  }}
                                  onBlur={() => updateStagingCustomer(customer)}
                                  className="h-8"
                                />
                                <ConfidenceBadge score={customer.confidence_scores?.name} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Phone</Label>
                              <div className="flex items-center">
                                <Input
                                  value={customer.phone || ''}
                                  onChange={(e) => {
                                    const updated = [...stagingCustomers];
                                    updated[idx].phone = e.target.value;
                                    setStagingCustomers(updated);
                                  }}
                                  onBlur={() => updateStagingCustomer(customer)}
                                  className="h-8"
                                />
                                <ConfidenceBadge score={customer.confidence_scores?.phone} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <div className="flex items-center">
                                <Input
                                  value={customer.email || ''}
                                  onChange={(e) => {
                                    const updated = [...stagingCustomers];
                                    updated[idx].email = e.target.value;
                                    setStagingCustomers(updated);
                                  }}
                                  onBlur={() => updateStagingCustomer(customer)}
                                  className="h-8"
                                />
                                <ConfidenceBadge score={customer.confidence_scores?.email} />
                              </div>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Company</Label>
                              <Input
                                value={customer.company || ''}
                                onChange={(e) => {
                                  const updated = [...stagingCustomers];
                                  updated[idx].company = e.target.value;
                                  setStagingCustomers(updated);
                                }}
                                onBlur={() => updateStagingCustomer(customer)}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">GST Number</Label>
                              <Input
                                value={customer.gst_number || ''}
                                onChange={(e) => {
                                  const updated = [...stagingCustomers];
                                  updated[idx].gst_number = e.target.value;
                                  setStagingCustomers(updated);
                                }}
                                onBlur={() => updateStagingCustomer(customer)}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Address</Label>
                              <Input
                                value={customer.address || ''}
                                onChange={(e) => {
                                  const updated = [...stagingCustomers];
                                  updated[idx].address = e.target.value;
                                  setStagingCustomers(updated);
                                }}
                                onBlur={() => updateStagingCustomer(customer)}
                                className="h-8"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="ml-4 flex flex-col items-end gap-2">
                          {customer.needs_review && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Needs Review
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteStagingCustomer(customer.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {customer.review_notes?.length > 0 && (
                        <div className="mt-2 text-xs text-amber-600">
                          {customer.review_notes.join(', ')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              Save as Draft
            </Button>
            <Button
              onClick={() => approveAndImport()}
              disabled={importing || stagingCustomers.length === 0}
              className="bg-primary"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Import All ({stagingCustomers.filter(c => c.status === 'review').length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
