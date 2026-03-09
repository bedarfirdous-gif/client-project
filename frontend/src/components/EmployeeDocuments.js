import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  Upload, 
  FileText, 
  Image, 
  Trash2, 
  Download, 
  Eye,
  Loader2,
  File,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../App';

const DOCUMENT_TYPES = [
  { value: 'id_proof', label: 'ID Proof' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'photo', label: 'Photo' },
  { value: 'resume', label: 'Resume/CV' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other Document' }
];

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function EmployeeDocuments({ employeeId, employeeName }) {
  const { api } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState('id_proof');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (employeeId) {
      fetchFiles();
    }
  }, [employeeId]);

  const fetchFiles = async () => {
    try {
      const data = await api(`/api/employees/${employeeId}/files`);
      setFiles(data || []);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Check if multiple files selected
    if (selectedFiles.length > 1) {
      await handleBulkUpload(selectedFiles);
      return;
    }

    const file = selectedFiles[0];

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Allowed: PDF, JPG, JPEG, PNG');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size: 5MB');
      return;
    }

    // Upload single file
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/employees/${employeeId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const result = await response.json();
      toast.success('File uploaded successfully');
      setFiles(prev => [result.file, ...prev]);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      toast.error(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleBulkUpload = async (selectedFiles) => {
    // Validate all files first
    const validFiles = [];
    const errors = [];

    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 5MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      toast.error('No valid files to upload');
      return;
    }

    if (errors.length > 0) {
      toast.warning(`${errors.length} file(s) skipped due to validation errors`);
    }

    setUploading(true);
    try {
      const formData = new FormData();
      validFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('document_type', documentType);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/employees/${employeeId}/upload-bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const result = await response.json();
      toast.success(`${result.total_uploaded} file(s) uploaded successfully`);
      
      if (result.errors?.length > 0) {
        toast.warning(`${result.total_errors} file(s) failed to upload`);
      }
      
      setFiles(prev => [...result.uploaded, ...prev]);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      toast.error(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await api(`/api/employees/${employeeId}/files/${fileId}`, { method: 'DELETE' });
      toast.success('File deleted');
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      toast.error('Failed to delete file');
    }
  };

  const getFileIcon = (contentType) => {
    if (contentType?.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    if (contentType === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getDocumentTypeLabel = (type) => {
    return DOCUMENT_TYPES.find(d => d.value === type)?.label || type;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Documents
        </CardTitle>
        <CardDescription>
          Upload and manage employee documents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 bg-gray-50">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <Label className="text-sm text-gray-600 mb-2 block">Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 w-full">
              <Label className="text-sm text-gray-600 mb-2 block">Select File(s)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                disabled={uploading}
                className="cursor-pointer"
                data-testid="file-upload-input"
                multiple
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4" />
            <span>Allowed: PDF, JPG, JPEG, PNG | Max size: 5MB per file | Select multiple files for bulk upload</span>
          </div>
        </div>

        {/* Files List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Upload className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map(file => (
              <div 
                key={file.id}
                className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {getFileIcon(file.content_type)}
                  <div>
                    <p className="font-medium text-gray-900">{file.original_filename}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Badge variant="outline" className="text-xs">
                        {getDocumentTypeLabel(file.document_type)}
                      </Badge>
                      <span>•</span>
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a 
                      href={`${process.env.REACT_APP_BACKEND_URL}${file.file_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a 
                      href={`${process.env.REACT_APP_BACKEND_URL}${file.file_url}`}
                      download={file.original_filename}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(file.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
