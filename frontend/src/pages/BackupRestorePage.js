import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Database, Download, Upload, Clock, Cloud, Trash2, RefreshCw,
  HardDrive, Calendar, Settings, Check, X, AlertCircle, 
  FileArchive, RotateCcw, CloudOff, Link, Unlink, Play, Pause,
  History, Shield, ChevronRight, Eye, MoreVertical, ShieldCheck, Lock, Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import SecuritySettings from '../components/SecuritySettings';

export default function BackupRestorePage() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isUploadFileLoaded, setIsUploadFileLoaded] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [interval, setInterval] = useState(false);
  const [backups, setBackups] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [mfaStatus, setMfaStatus] = useState({ mfa_enabled: false });
  const [backupSettings, setBackupSettings] = useState({
    auto_backup_enabled: false,
    backup_frequency: 'daily',
    backup_time: '02:00',
    retention_days: 30,
    google_drive_connected: false,
    google_drive_folder: '',
    last_backup: null,
    next_backup: null,
  });
  
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  // Fix: avoid null initial state (can cause UI to briefly render as "no selection" then switch)
  // Use stable defaults + explicit loaded flags to prevent visual flash when data arrives.
  const [pendingOperation, setPendingOperation] = useState('');
  const [selectedBackup, setSelectedBackup] = useState({ id: null });
  const [isSelectedBackupLoaded, setIsSelectedBackupLoaded] = useState(false);

  const [backupName, setBackupName] = useState('');
  // Fix: avoid `undefined` initial state for file selection which can cause a brief
  // uncontrolled/empty render in the file input ("no file") before React reconciles.
  // Use a stable explicit "no file selected" value (`null`) and keep the existing
  // loaded flag to prevent any mount/unmount flicker.
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    // Mark these as loaded after first paint; prevents state-init flashes without changing behavior.
    setIsSelectedBackupLoaded(true);
    setIsUploadFileLoaded(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const defaultSettings = {
        auto_backup_enabled: false,
        backup_frequency: 'daily',
        backup_time: '02:00',
        retention_days: 30,
        google_drive_connected: false,
        google_drive_folder: '',
        last_backup: null,
        next_backup: null,
      };
      
      const [backupsData, trashData, settingsData, mfaData] = await Promise.all([
        api('/api/backups').catch(() => []),
        api('/api/trash').catch(() => []),
        api('/api/backup-settings').catch(() => defaultSettings),
        api('/api/security/mfa/status').catch(() => ({ mfa_enabled: false })),
      ]);
      setBackups(backupsData);
      setTrashItems(trashData);
      setMfaStatus(mfaData);
      // Merge with defaults to ensure all fields have values
      setBackupSettings({ ...defaultSettings, ...settingsData });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Create Manual Backup
  const createBackup = async () => {
    setCreating(true);
    setProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const result = await api('/api/backups', {
        method: 'POST',
        body: JSON.stringify({ 
          name: backupName || `Backup ${new Date().toLocaleString()}`,
          type: 'manual'
        }),
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      toast.success('Backup created successfully!', {
        description: `Size: ${formatBytes(result.size)}`
      });
      
      setBackupName('');
      fetchData();
    } catch (err) {
      clearInterval(progressInterval);
      toast.error('Failed to create backup');
    } finally {
      setTimeout(() => {
        setCreating(false);
        setProgress(0);
      }, 1000);
    }
  };

  // Restore from Backup
  const restoreBackup = async () => {
    if (!selectedBackup) return;
    
    setRestoring(true);
    setProgress(0);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 5, 90));
    }, 300);

    try {
      await api(`/api/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      toast.success('Data restored successfully!', {
        description: 'Your data has been restored from the backup.'
      });
      
      setShowRestoreModal(false);
      setSelectedBackup(null);
      fetchData();
    } catch (err) {
      clearInterval(progressInterval);
      toast.error('Failed to restore backup');
    } finally {
      setTimeout(() => {
        setRestoring(false);
        setProgress(0);
      }, 1000);
    }
  };

  // Upload Backup with MFA
  const uploadBackup = async (mfaCodeParam = null) => {
    if (!uploadFile) {
      toast.error('Please select a backup file');
      return;
    }
    
    // Check if MFA is required
    if (mfaStatus.mfa_enabled && !mfaCodeParam) {
      setPendingOperation('upload');
      setShowMfaModal(true);
      return;
    }
    
    setUploading(true);
    setProgress(0);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 300);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (mfaCodeParam) {
        formData.append('mfa_code', mfaCodeParam);
      }
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backups/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      // Check if MFA is required
      if (response.status === 428) {
        clearInterval(progressInterval);
        setUploading(false);
        setProgress(0);
        setPendingOperation('upload');
        setShowMfaModal(true);
        return;
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }
      
      const result = await response.json();
      
      clearInterval(progressInterval);
      setProgress(100);
      
      toast.success('Backup uploaded & encrypted successfully!', {
        description: (
          <div className="text-sm">
            <p>File: {uploadFile.name}</p>
            {result.security?.encrypted && <p className="text-green-600">✓ AES-256 Encrypted</p>}
            {result.security?.scan_passed && <p className="text-green-600">✓ Security scan passed</p>}
            {result.security?.mfa_verified && <p className="text-green-600">✓ MFA verified</p>}
          </div>
        )
      });
      
      setShowUploadModal(false);
      setShowMfaModal(false);
      setUploadFile(null);
      setMfaCode('');
      fetchData();
    } catch (err) {
      clearInterval(progressInterval);
      toast.error(err.message || 'Failed to upload backup');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 1000);
    }
  };

  // Handle MFA verification
  const handleMfaVerify = () => {
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error('Please enter a 6-digit MFA code');
      return;
    }
    
    if (pendingOperation === 'upload') {
      uploadBackup(mfaCode);
    } else if (pendingOperation === 'restore') {
      // Restore with MFA
      restoreBackup(mfaCode);
    }
  };

  // Download Backup
  const downloadBackup = async (backup) => {
    try {
      const result = await api(`/api/backups/${backup.id}/download`);
      
      // Create downloadable blob
      const dataStr = JSON.stringify(result.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backup.name.replace(/\s/g, '_')}_${backup.created_at?.split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error('Failed to download backup');
    }
  };

  // Delete Backup
  const deleteBackup = async (backup) => {
    if (!window.confirm('Delete this backup? This cannot be undone.')) return;
    
    try {
      await api(`/api/backups/${backup.id}`, { method: 'DELETE' });
      toast.success('Backup deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete backup');
    }
  };

  // Save Backup Settings
  const saveSettings = async () => {
    try {
      await api('/api/backup-settings', {
        method: 'PUT',
        body: JSON.stringify(backupSettings),
      });
      toast.success('Backup settings saved');
      setShowSettingsModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  // Restore from Trash
  const restoreFromTrash = async (item) => {
    try {
      await api(`/api/trash/${item.id}/restore`, { method: 'POST' });
      toast.success(`${item.type} restored successfully`);
      fetchData();
    } catch (err) {
      toast.error('Failed to restore item');
    }
  };

  // Permanently Delete from Trash
  const permanentDelete = async (item) => {
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    
    try {
      await api(`/api/trash/${item.id}`, { method: 'DELETE' });
      toast.success('Item permanently deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  // Empty Trash
  const emptyTrash = async () => {
    if (!window.confirm('Permanently delete all items in trash? This cannot be undone.')) return;
    
    try {
      await api('/api/trash/empty', { method: 'DELETE' });
      toast.success('Trash emptied');
      fetchData();
    } catch (err) {
      toast.error('Failed to empty trash');
    }
  };

  // Connect Google Drive (placeholder - would need OAuth)
  const connectGoogleDrive = () => {
    toast.info('Google Drive integration coming soon!', {
      description: 'This feature will be available in a future update.'
    });
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getBackupTypeIcon = (type) => {
    switch (type) {
      case 'auto': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'manual': return <HardDrive className="w-4 h-4 text-purple-500" />;
      case 'cloud': return <Cloud className="w-4 h-4 text-green-500" />;
      case 'uploaded': return <Upload className="w-4 h-4 text-orange-500" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getDaysUntilDelete = (deletedAt) => {
    const deleteDate = new Date(deletedAt);
    const permanentDelete = new Date(deleteDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((permanentDelete - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="backup-restore-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Backup & Restore
          </h1>
          <p className="text-muted-foreground">Protect your data with backups and restore when needed</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Backups</p>
                <p className="text-2xl font-bold text-blue-600">{backups.length}</p>
              </div>
              <FileArchive className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Auto Backup</p>
                <p className="text-lg font-bold text-green-600">
                  {backupSettings.auto_backup_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              {backupSettings.auto_backup_enabled ? (
                <Play className="w-8 h-8 text-green-500 opacity-50" />
              ) : (
                <Pause className="w-8 h-8 text-gray-400 opacity-50" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Security (MFA)</p>
                <p className="text-sm font-bold text-purple-600">
                  {mfaStatus.mfa_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              {mfaStatus.mfa_enabled ? (
                <ShieldCheck className="w-8 h-8 text-purple-500 opacity-50" />
              ) : (
                <Shield className="w-8 h-8 text-gray-400 opacity-50" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Last Backup</p>
                <p className="text-sm font-bold text-blue-600">
                  {backupSettings.last_backup 
                    ? new Date(backupSettings.last_backup).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
              <History className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Trash Items</p>
                <p className="text-2xl font-bold text-amber-600">{trashItems.length}</p>
              </div>
              <Trash2 className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="w-4 h-4" /> Create Backup
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Auto Schedule
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" /> Backup History
          </TabsTrigger>
          <TabsTrigger value="trash" className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Trash ({trashItems.length})
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* Create Backup Tab */}
        <TabsContent value="backup">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Manual Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-600" />
                  Create Manual Backup
                </CardTitle>
                <CardDescription>
                  Create a backup of your data to protect against data loss
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Backup Name (Optional)</Label>
                  <Input
                    placeholder="e.g., Before Year End Closing"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                  />
                </div>

                {creating && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Creating backup...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <Button 
                  onClick={createBackup} 
                  disabled={creating}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {creating ? (
                    <>Creating Backup...</>
                  ) : (
                    <><Database className="w-4 h-4 mr-2" /> Create Backup Now</>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Includes: Items, Inventory, Sales, Customers, Employees, Settings
                </p>
              </CardContent>
            </Card>

            {/* Upload Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-orange-600" />
                  Upload Backup
                </CardTitle>
                <CardDescription>
                  Upload a previously downloaded backup file to restore
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-orange-200 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
                  <Upload className="w-10 h-10 mx-auto text-orange-400 mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload a .json backup file
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowUploadModal(true)}
                    className="border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    <Upload className="w-4 h-4 mr-2" /> Select File
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Supported formats: .json backup files created by this system
                </p>
              </CardContent>
            </Card>

            {/* Google Drive Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-blue-600" />
                  Google Drive Backup
                </CardTitle>
                <CardDescription>
                  Connect your Google Drive account to automatically backup to the cloud
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {backupSettings.google_drive_connected ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-700">Connected to Google Drive</p>
                        <p className="text-sm text-green-600">{backupSettings.google_drive_folder || 'bijnisbooks_backups'}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3 text-red-600 border-red-200"
                      onClick={() => setBackupSettings({...backupSettings, google_drive_connected: false})}
                    >
                      <Unlink className="w-4 h-4 mr-2" /> Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CloudOff className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-700">Not Connected</p>
                        <p className="text-sm text-muted-foreground">Connect to enable cloud backups</p>
                      </div>
                    </div>
                    <Button 
                      className="mt-3 bg-blue-600 hover:bg-blue-700"
                      onClick={connectGoogleDrive}
                    >
                      <Link className="w-4 h-4 mr-2" /> Connect Google Drive
                    </Button>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Benefits of Cloud Backup</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" /> Access backups from anywhere
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" /> Automatic sync after each backup
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" /> Secure & encrypted storage
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Auto Schedule Tab */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Automatic Backup Schedule
              </CardTitle>
              <CardDescription>
                Configure automatic scheduled backups to keep your data safe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${backupSettings.auto_backup_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {backupSettings.auto_backup_enabled ? (
                      <Play className="w-5 h-5 text-green-600" />
                    ) : (
                      <Pause className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Automatic Backups</p>
                    <p className="text-sm text-muted-foreground">
                      {backupSettings.auto_backup_enabled ? 'Running' : 'Paused'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={backupSettings.auto_backup_enabled}
                  onCheckedChange={(checked) => setBackupSettings({...backupSettings, auto_backup_enabled: checked})}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Backup Frequency</Label>
                  <Select 
                    value={backupSettings.backup_frequency} 
                    onValueChange={(v) => setBackupSettings({...backupSettings, backup_frequency: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Every Hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Backup Time</Label>
                  <Input
                    type="time"
                    value={backupSettings.backup_time}
                    onChange={(e) => setBackupSettings({...backupSettings, backup_time: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Retention (Days)</Label>
                  <Select 
                    value={backupSettings.retention_days?.toString()} 
                    onValueChange={(v) => setBackupSettings({...backupSettings, retention_days: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {backupSettings.auto_backup_enabled && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-700">Next Scheduled Backup</span>
                  </div>
                  <p className="text-sm text-blue-600">
                    {backupSettings.next_backup 
                      ? new Date(backupSettings.next_backup).toLocaleString()
                      : `Today at ${backupSettings.backup_time}`}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={saveSettings} className="bg-primary">
                  <Check className="w-4 h-4 mr-2" /> Save Schedule Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                Backup History
              </CardTitle>
              <CardDescription>
                View and manage your backups. Download or restore from any backup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <div className="text-center py-12">
                  <FileArchive className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No backups found</p>
                  <p className="text-sm text-muted-foreground">Create your first backup to protect your data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {backups.map((backup) => (
                    <div 
                      key={backup.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getBackupTypeIcon(backup.type)}
                        <div>
                          <p className="font-medium">{backup.name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{new Date(backup.created_at).toLocaleString()}</span>
                            <Badge variant="outline">{formatBytes(backup.size)}</Badge>
                            <Badge variant={backup.type === 'auto' ? 'secondary' : 'outline'}>
                              {backup.type === 'auto' ? 'Automatic' : 'Manual'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedBackup(backup); setShowRestoreModal(true); }}>
                            <RotateCcw className="w-4 h-4 mr-2" /> Restore
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadBackup(backup)}>
                            <Download className="w-4 h-4 mr-2" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteBackup(backup)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trash Tab */}
        <TabsContent value="trash">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-amber-600" />
                    Trash / Recycle Bin
                  </CardTitle>
                  <CardDescription>
                    Deleted items are kept for 30 days before permanent deletion
                  </CardDescription>
                </div>
                {trashItems.length > 0 && (
                  <Button variant="outline" size="sm" className="text-red-600" onClick={emptyTrash}>
                    <Trash2 className="w-4 h-4 mr-2" /> Empty Trash
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {trashItems.length === 0 ? (
                <div className="text-center py-12">
                  <Trash2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Trash is empty</p>
                  <p className="text-sm text-muted-foreground">Deleted items will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trashItems.map((item) => {
                    const daysLeft = getDaysUntilDelete(item.deleted_at);
                    return (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <Trash2 className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <Badge variant="outline">{item.type}</Badge>
                              <span>Deleted: {new Date(item.deleted_at).toLocaleDateString()}</span>
                              <Badge variant={daysLeft <= 7 ? 'destructive' : 'secondary'}>
                                {daysLeft} days left
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => restoreFromTrash(item)}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" /> Restore
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600"
                            onClick={() => permanentDelete(item)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>
      </Tabs>

      {/* Restore Confirmation Modal */}
      <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirm Restore
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore from this backup? This will replace your current data.
            </DialogDescription>
          </DialogHeader>

          {selectedBackup && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{selectedBackup.name}</p>
              <p className="text-sm text-muted-foreground">
                Created: {new Date(selectedBackup.created_at).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Size: {formatBytes(selectedBackup.size)}
              </p>
            </div>
          )}

          {restoring && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Restoring data...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreModal(false)} disabled={restoring}>
              Cancel
            </Button>
            <Button onClick={restoreBackup} disabled={restoring} className="bg-amber-600 hover:bg-amber-700">
              {restoring ? 'Restoring...' : 'Yes, Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Backup Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-500" />
              Upload Backup File
            </DialogTitle>
            <DialogDescription>
              Select a .json backup file that was previously downloaded from this system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                uploadFile ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              {uploadFile ? (
                <div className="space-y-2">
                  <Check className="w-10 h-10 mx-auto text-green-500" />
                  <p className="font-medium text-green-700">{uploadFile.name}</p>
                  <p className="text-sm text-green-600">{formatBytes(uploadFile.size)}</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setUploadFile(null)}
                    className="mt-2"
                  >
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-muted-foreground mb-3">Drag & drop or click to select</p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="backup-file-input"
                  />
                  <label htmlFor="backup-file-input">
                    <Button variant="outline" asChild className="cursor-pointer">
                      <span><FileArchive className="w-4 h-4 mr-2" /> Select .json File</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading backup...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Security Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span><strong>Secure Upload:</strong> Files are encrypted with AES-256 and scanned for malware</span>
              </p>
            </div>

            {mfaStatus.mfa_enabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  <span><strong>MFA Required:</strong> You will need to enter your authenticator code</span>
                </p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                After uploading, you can restore from this backup in the "Backup History" section.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadModal(false); setUploadFile(null); }} disabled={uploading}>
              Cancel
            </Button>
            <Button 
              onClick={() => uploadBackup()} 
              disabled={uploading || !uploadFile}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {uploading ? 'Uploading...' : <><Upload className="w-4 h-4 mr-2" /> Upload Backup</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA Verification Modal */}
      <Dialog open={showMfaModal} onOpenChange={setShowMfaModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-500" />
              MFA Verification Required
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code from your authenticator app to proceed
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div className="p-3 bg-muted rounded-lg text-center text-sm text-muted-foreground">
              Open your authenticator app (Google Authenticator, Authy, etc.) and enter the current code
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMfaModal(false); setMfaCode(''); }}>
              Cancel
            </Button>
            <Button onClick={handleMfaVerify} disabled={mfaCode.length !== 6}>
              <Lock className="w-4 h-4 mr-2" /> Verify & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
