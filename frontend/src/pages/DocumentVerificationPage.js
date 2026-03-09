import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  FileCheck, FileX, Clock, AlertTriangle, Search, Filter, 
  CheckCircle, XCircle, Eye, Download, Calendar, User,
  RefreshCw, Bell, FileText, Shield, Timer, ChevronRight,
  IdCard, Building2, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

const DOCUMENT_TYPES = {
  aadhar_card: { label: 'Aadhar Card', icon: IdCard, color: 'blue' },
  pan_card: { label: 'PAN Card', icon: FileText, color: 'orange' },
  qualification_certificate: { label: 'Qualification Certificate', icon: FileCheck, color: 'green' },
  guardian_consent_letter: { label: 'Guardian Consent Letter', icon: FileText, color: 'purple' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800', icon: AlertTriangle },
  expiring_soon: { label: 'Expiring Soon', color: 'bg-orange-100 text-orange-800', icon: Timer }
};

export default function DocumentVerificationPage() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0, expiring_soon: 0, expired: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationData, setVerificationData] = useState({
    status: 'verified',
    expiry_date: '',
    remarks: '',
    verified_by: ''
  });
  const [activeTab, setActiveTab] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [docsData, empData, statsData] = await Promise.all([
        api('/api/document-verification'),
        api('/api/employees'),
        api('/api/document-verification/stats')
      ]);
      setDocuments(docsData || []);
      setEmployees(empData || []);
      setStats(statsData || { pending: 0, verified: 0, rejected: 0, expiring_soon: 0, expired: 0 });
    } catch (err) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerify = async () => {
    if (!selectedDocument) return;
    
    try {
      await api(`/api/document-verification/${selectedDocument.id}/verify`, {
        method: 'POST',
        body: JSON.stringify(verificationData)
      });
      toast.success(`Document ${verificationData.status === 'verified' ? 'verified' : 'rejected'} successfully`);
      setShowVerifyModal(false);
      setSelectedDocument(null);
      setVerificationData({ status: 'verified', expiry_date: '', remarks: '', verified_by: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to update document status');
    }
  };

  const openVerifyModal = (doc) => {
    setSelectedDocument(doc);
    setVerificationData({
      status: 'verified',
      expiry_date: doc.expiry_date || '',
      remarks: '',
      verified_by: ''
    });
    setShowVerifyModal(true);
  };

  const getEmployeeName = (employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.name || 'Unknown';
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchTerm === '' || 
      getEmployeeName(doc.employee_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || doc.verification_status === statusFilter;
    const matchesType = typeFilter === 'all' || doc.document_type === typeFilter;
    
    // Tab filtering
    if (activeTab === 'pending') return matchesSearch && matchesType && doc.verification_status === 'pending';
    if (activeTab === 'expiring') return matchesSearch && matchesType && (doc.verification_status === 'expiring_soon' || doc.verification_status === 'expired');
    if (activeTab === 'verified') return matchesSearch && matchesType && doc.verification_status === 'verified';
    if (activeTab === 'rejected') return matchesSearch && matchesType && doc.verification_status === 'rejected';
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="document-verification-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Document Verification
          </h1>
          <p className="text-muted-foreground">Review, verify, and track employee document expiry</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('pending')}>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-yellow-700">Pending Review</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('verified')}>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
            <p className="text-3xl font-bold text-green-600">{stats.verified}</p>
            <p className="text-sm text-green-700">Verified</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('rejected')}>
          <CardContent className="pt-4 pb-4 text-center">
            <XCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
            <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-sm text-red-700">Rejected</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('expiring')}>
          <CardContent className="pt-4 pb-4 text-center">
            <Timer className="w-8 h-8 mx-auto text-orange-600 mb-2" />
            <p className="text-3xl font-bold text-orange-600">{stats.expiring_soon}</p>
            <p className="text-sm text-orange-700">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50 dark:bg-gray-950/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('expiring')}>
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            <p className="text-3xl font-bold text-gray-600">{stats.expired}</p>
            <p className="text-sm text-gray-700">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Notifications Banner */}
      {(stats.pending > 0 || stats.expiring_soon > 0) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-blue-600" />
              <div className="flex-1">
                <p className="font-semibold text-blue-800">Action Required</p>
                <p className="text-sm text-blue-700">
                  {stats.pending > 0 && `${stats.pending} document(s) pending verification. `}
                  {stats.expiring_soon > 0 && `${stats.expiring_soon} document(s) expiring within 30 days.`}
                </p>
              </div>
              <Button size="sm" onClick={() => setActiveTab('pending')}>
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Document List</CardTitle>
              <CardDescription>Review and verify employee documents</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee or document..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Document Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({documents.length})</TabsTrigger>
              <TabsTrigger value="pending" className="text-yellow-700">
                Pending ({stats.pending})
              </TabsTrigger>
              <TabsTrigger value="verified" className="text-green-700">
                Verified ({stats.verified})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-red-700">
                Rejected ({stats.rejected})
              </TabsTrigger>
              <TabsTrigger value="expiring" className="text-orange-700">
                Expiring ({stats.expiring_soon + stats.expired})
              </TabsTrigger>
            </TabsList>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Employee</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Document Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Uploaded</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Expiry Date</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc, idx) => {
                    const docType = DOCUMENT_TYPES[doc.document_type] || { label: doc.document_type, color: 'gray' };
                    const statusConfig = STATUS_CONFIG[doc.verification_status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;
                    const daysUntilExpiry = getDaysUntilExpiry(doc.expiry_date);
                    
                    return (
                      <tr key={doc.id} className={`border-b hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{getEmployeeName(doc.employee_id)}</p>
                              <p className="text-xs text-muted-foreground">{doc.employee_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`bg-${docType.color}-50 text-${docType.color}-700 border-${docType.color}-200`}>
                            {docType.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {doc.expiry_date ? (
                            <div>
                              <p className="text-sm">{new Date(doc.expiry_date).toLocaleDateString()}</p>
                              {daysUntilExpiry !== null && (
                                <Badge className={daysUntilExpiry <= 0 ? 'bg-red-100 text-red-700' : daysUntilExpiry <= 30 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}>
                                  {daysUntilExpiry <= 0 ? 'Expired' : `${daysUntilExpiry} days left`}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            {doc.file_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openVerifyModal(doc)}
                              data-testid={`verify-btn-${doc.id}`}
                            >
                              <FileCheck className="w-4 h-4 mr-1" />
                              {doc.verification_status === 'pending' ? 'Review' : 'Update'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDocuments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No documents found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Verification Modal */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Document Verification
            </DialogTitle>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="space-y-4 py-4">
              {/* Document Info */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Employee</p>
                      <p className="font-medium">{getEmployeeName(selectedDocument.employee_id)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Document Type</p>
                      <p className="font-medium">{DOCUMENT_TYPES[selectedDocument.document_type]?.label || selectedDocument.document_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Uploaded</p>
                      <p className="font-medium">{selectedDocument.uploaded_at ? new Date(selectedDocument.uploaded_at).toLocaleDateString() : '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">File</p>
                      <p className="font-medium truncate">{selectedDocument.original_filename || 'Unknown'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Status */}
              <div className="space-y-2">
                <Label>Verification Status *</Label>
                <div className="flex gap-4">
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${verificationData.status === 'verified' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                    <input
                      type="radio"
                      name="status"
                      value="verified"
                      checked={verificationData.status === 'verified'}
                      onChange={(e) => setVerificationData(prev => ({ ...prev, status: e.target.value }))}
                      className="hidden"
                    />
                    <div className="text-center">
                      <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${verificationData.status === 'verified' ? 'text-green-600' : 'text-gray-400'}`} />
                      <p className="font-medium">Verify</p>
                      <p className="text-xs text-muted-foreground">Document is valid</p>
                    </div>
                  </label>
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${verificationData.status === 'rejected' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'}`}>
                    <input
                      type="radio"
                      name="status"
                      value="rejected"
                      checked={verificationData.status === 'rejected'}
                      onChange={(e) => setVerificationData(prev => ({ ...prev, status: e.target.value }))}
                      className="hidden"
                    />
                    <div className="text-center">
                      <XCircle className={`w-8 h-8 mx-auto mb-2 ${verificationData.status === 'rejected' ? 'text-red-600' : 'text-gray-400'}`} />
                      <p className="font-medium">Reject</p>
                      <p className="text-xs text-muted-foreground">Document invalid</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Document Expiry Date
                </Label>
                <Input
                  type="date"
                  value={verificationData.expiry_date}
                  onChange={(e) => setVerificationData(prev => ({ ...prev, expiry_date: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Set expiry date for renewal tracking</p>
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={verificationData.remarks}
                  onChange={(e) => setVerificationData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder={verificationData.status === 'rejected' ? 'Reason for rejection (required)...' : 'Optional remarks...'}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyModal(false)}>Cancel</Button>
            <Button 
              onClick={handleVerify}
              className={verificationData.status === 'verified' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              disabled={verificationData.status === 'rejected' && !verificationData.remarks}
              data-testid="confirm-verify-btn"
            >
              {verificationData.status === 'verified' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Verify Document
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
