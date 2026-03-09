import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Key, Copy, RefreshCw, Eye, EyeOff, Shield, Check, 
  AlertTriangle, Download, ChevronDown, ChevronUp 
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';

export default function BackupCodeBar() {
  const { user, api } = useAuth();
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBackupCodes();
    }
  }, [user]);

  const fetchBackupCodes = async () => {
    try {
      const data = await api('/api/auth/backup-codes');
      setBackupCodes(data.backup_codes || []);
    } catch (err) {
      console.error('Failed to fetch backup codes:', err);
    }
  };

  const generateBackupCodes = async () => {
    setRegenerating(true);
    try {
      const data = await api('/api/auth/backup-codes/generate', { method: 'POST' });
      setBackupCodes(data.backup_codes || []);
      toast.success('New backup codes generated! Save them securely.');
      setShowCodes(true);
      setExpanded(true);
      setShowRegenerateDialog(false);
    } catch (err) {
      toast.error(err.message || 'Failed to generate backup codes');
    } finally {
      setRegenerating(false);
    }
  };

  const copyAllCodes = () => {
    const unusedCodes = backupCodes.filter(c => !c.used).map(c => c.code);
    if (unusedCodes.length === 0) {
      toast.error('No unused codes to copy');
      return;
    }
    navigator.clipboard.writeText(unusedCodes.join('\n'));
    toast.success('Backup codes copied to clipboard!');
  };

  const copySingleCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  const downloadCodes = () => {
    const unusedCodes = backupCodes.filter(c => !c.used).map(c => c.code);
    if (unusedCodes.length === 0) {
      toast.error('No unused codes to download');
      return;
    }
    
    const content = `Security Backup Codes
========================
Email: ${user?.email}
Generated: ${new Date().toLocaleString()}

IMPORTANT: Each code can only be used once.
Store these codes in a secure location.

Your Backup Codes:
${unusedCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

========================
Keep these codes safe!`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-${user?.email?.split('@')[0] || 'user'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup codes downloaded!');
  };

  const unusedCount = backupCodes.filter(c => !c.used).length;
  const totalCount = backupCodes.length;

  // Don't show if no backup codes exist and user hasn't generated any
  if (!user) return null;

  return (
    <>
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Backup Codes
                  {totalCount > 0 && (
                    <Badge 
                      variant="outline" 
                      className={unusedCount === 0 
                        ? "bg-red-100 text-red-700 border-red-300" 
                        : unusedCount <= 3 
                          ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                          : "bg-green-100 text-green-700 border-green-300"
                      }
                    >
                      {unusedCount}/{totalCount} available
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Use backup codes to recover your account if you forget your password
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalCount === 0 && (
                <Button size="sm" onClick={(e) => { e.stopPropagation(); generateBackupCodes(); }} disabled={regenerating}>
                  <Key className="w-4 h-4 mr-1" />
                  Generate
                </Button>
              )}
              {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0">
            {unusedCount === 0 && totalCount > 0 && (
              <Alert className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/30">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-700 dark:text-red-400">
                  All backup codes have been used! Generate new codes immediately.
                </AlertDescription>
              </Alert>
            )}

            {unusedCount > 0 && unusedCount <= 3 && (
              <Alert className="mb-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                  You only have {unusedCount} backup code{unusedCount > 1 ? 's' : ''} left. Consider generating new codes.
                </AlertDescription>
              </Alert>
            )}

            {totalCount > 0 && (
              <div className="space-y-3">
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowCodes(!showCodes)}
                  >
                    {showCodes ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                    {showCodes ? 'Hide' : 'Show'} Codes
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={copyAllCodes}
                    disabled={unusedCount === 0}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={downloadCodes}
                    disabled={unusedCount === 0}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowRegenerateDialog(true)}
                    className="text-amber-600 hover:text-amber-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regenerate
                  </Button>
                </div>

                {/* Codes Grid */}
                {showCodes && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                    {backupCodes.map((code, index) => (
                      <div 
                        key={index}
                        className={`relative p-2 rounded text-center font-mono text-sm cursor-pointer transition-all
                          ${code.used 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through' 
                            : 'bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                          }`}
                        onClick={() => !code.used && copySingleCode(code.code)}
                        title={code.used ? `Used on ${new Date(code.used_at).toLocaleDateString()}` : 'Click to copy'}
                      >
                        {code.code}
                        {code.used && (
                          <Badge className="absolute -top-1 -right-1 text-[10px] bg-gray-500">
                            Used
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!showCodes && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Click "Show Codes" to view your backup codes
                  </p>
                )}
              </div>
            )}

            {totalCount === 0 && (
              <div className="text-center py-4">
                <Shield className="w-12 h-12 mx-auto text-amber-400 mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  No backup codes generated yet. Generate backup codes to secure your account.
                </p>
                <Button onClick={generateBackupCodes} disabled={regenerating}>
                  {regenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Generate Backup Codes
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Regenerate Backup Codes?
            </DialogTitle>
            <DialogDescription>
              This will invalidate all your existing backup codes. You'll receive 10 new codes.
              Make sure to save the new codes in a secure location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={generateBackupCodes} 
              disabled={regenerating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {regenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Yes, Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
