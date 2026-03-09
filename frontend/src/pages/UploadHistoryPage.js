import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  Upload, Clock, FileSpreadsheet, CheckCircle, XCircle, 
  Eye, Download, Trash2, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

export default function UploadHistoryPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  // Avoid null initial state to prevent conditional UI (dialog/details) from flashing on first render.
  // Keep a stable object shape; use `isLoaded` to control when the UI can render data-dependent content.
  const [viewUpload, setViewUpload] = useState({ open: false, upload: null });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api('/api/upload-history');
      setHistory(data || []);
    } catch (err) {
      // Initialize with empty if endpoint doesn't exist
      setHistory([]);
    } finally {
      setLoading(false);
      // Mark initial load complete to avoid first-paint flash of empty/incorrect UI.
      setIsLoaded(true);
    }
  };

  const deleteUpload = async (id) => {
    if (!confirm('Are you sure you want to delete this upload record?')) return;
    try {
      await api(`/api/upload-history/${id}`, { method: 'DELETE' });
      toast.success('Upload record deleted');
      fetchHistory();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const downloadItems = async (upload) => {
    // Generate CSV from uploaded items
    if (!upload.items || upload.items.length === 0) {
      toast.error('No items to download');
      return;
    }

    const headers = ['SKU', 'Name', 'Category', 'Brand', 'MRP', 'Selling Price', 'Quantity', 'Status'];
    const rows = upload.items.map(item => [
      item.sku || '',
      item.name || '',
      item.category || '',
      item.brand || '',
      item.mrp || 0,
      item.selling_price || 0,
      item.quantity || 0,
      item.status || 'imported'
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `upload_${upload.upload_number}_items.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('Items downloaded');
  };

  const statusColors = {
    completed: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-blue-100 text-blue-700',
  };

  const sourceIcons = {
    excel: FileSpreadsheet,
    csv: FileSpreadsheet,
    invoice: FileSpreadsheet,
    ai_scan: Eye,
    manual: Upload,
  };

  return (
    <div className="space-y-6" data-testid="upload-history-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Upload History</h2>
          <p className="text-sm text-muted-foreground">View and manage all data imports</p>
        </div>
        <Button onClick={fetchHistory} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{history.length}</p>
                <p className="text-xs text-muted-foreground">Total Uploads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{history.filter(h => h.status === 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{history.filter(h => h.status === 'partial').length}</p>
                <p className="text-xs text-muted-foreground">Partial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{history.filter(h => h.status === 'failed').length}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <CardContent className="py-12 text-center">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No upload history found</p>
            <p className="text-sm text-muted-foreground mt-1">Import data from Smart Scanner to see history</p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Upload #</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Imported</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((upload) => {
                const SourceIcon = sourceIcons[upload.source] || Upload;
                return (
                  <TableRow key={upload.id}>
                    <TableCell className="font-mono-data font-medium">{upload.upload_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SourceIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="capitalize">{upload.source?.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={upload.file_name}>
                      {upload.file_name || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono-data">{upload.total_items || 0}</TableCell>
                    <TableCell className="text-right font-mono-data text-green-600">{upload.imported || 0}</TableCell>
                    <TableCell className="text-right font-mono-data text-red-600">{upload.errors || 0}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[upload.status] || ''}>
                        {upload.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(upload.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setViewUpload(upload)} title="View Details">
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadItems(upload)} title="Download Items">
                          <Download className="w-4 h-4 text-purple-600" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteUpload(upload.id)} title="Delete">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* View Upload Modal */}
      <Dialog open={!!viewUpload} onOpenChange={() => setViewUpload(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" /> 
              Upload Details - {viewUpload?.upload_number}
            </DialogTitle>
          </DialogHeader>

          {viewUpload && (
            <div className="space-y-4 flex-1 overflow-y-auto">
              {/* Upload Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-accent rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="font-medium capitalize">{viewUpload.source?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">File</p>
                  <p className="font-medium">{viewUpload.file_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(viewUpload.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="font-medium">{viewUpload.total_items}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Imported</p>
                  <p className="font-medium text-green-600">{viewUpload.imported}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="font-medium text-red-600">{viewUpload.errors}</p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-medium mb-2">Imported Items ({viewUpload.items?.length || 0})</h4>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">MRP</TableHead>
                        <TableHead className="text-right">Selling</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewUpload.items?.slice(0, 50).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono-data">{item.sku || '-'}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right">{currencySymbol}{item.mrp || 0}</TableCell>
                          <TableCell className="text-right">{currencySymbol}{item.selling_price || 0}</TableCell>
                          <TableCell className="text-right">{item.quantity || 0}</TableCell>
                          <TableCell>
                            {item.error ? (
                              <Badge className="bg-red-100 text-red-700">Error</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Error Log */}
              {viewUpload.error_log && viewUpload.error_log.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Error Log</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {viewUpload.error_log.map((err, idx) => (
                      <p key={idx} className="text-sm text-red-700">• {err}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => downloadItems(viewUpload)}>
                  <Download className="w-4 h-4 mr-2" /> Download CSV
                </Button>
                <Button variant="outline" onClick={() => setViewUpload(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
