import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  Shield, ShieldCheck, ShieldAlert, Key, Smartphone, QrCode, 
  Lock, Unlock, Eye, EyeOff, CheckCircle, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';

export default function SecuritySettings() {
  const { api, user } = useAuth();
  const [mfaStatus, setMfaStatus] = useState({ mfa_enabled: false, mfa_verified: false });
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  // FIX: Avoid null initial state which can cause a visual flash when the setup modal renders
  // while async setup data is being populated.
  const [setupData, setSetupData] = useState({});
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const data = await api('/api/security/mfa/status');
      setMfaStatus(data);
    } catch (err) {
      console.error('Failed to fetch MFA status:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupMfa = async () => {
    try {
      const data = await api('/api/security/mfa/setup', { method: 'POST' });
      setSetupData(data);
      setShowSetupModal(true);
    } catch (err) {
      toast.error('Failed to setup MFA');
    }
  };

  const verifyMfa = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      await api('/api/security/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: verificationCode })
      });
      
      toast.success('MFA enabled successfully!', {
        description: 'Your account is now protected with two-factor authentication'
      });
      
      setShowSetupModal(false);
      setVerificationCode('');
      setSetupData(null);
      fetchMfaStatus();
    } catch (err) {
      toast.error(err.message || 'Invalid verification code');
    } finally {
      setVerifying(false);
    }
  };

  const disableMfa = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('Please enter your current MFA code');
      return;
    }

    setVerifying(true);
    try {
      await api('/api/security/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: disableCode })
      });
      
      toast.success('MFA disabled');
      setShowDisableModal(false);
      setDisableCode('');
      fetchMfaStatus();
    } catch (err) {
      toast.error(err.message || 'Invalid code');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* MFA Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mfaStatus.mfa_enabled ? (
              <ShieldCheck className="w-5 h-5 text-green-600" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            )}
            Two-Factor Authentication (MFA)
          </CardTitle>
          <CardDescription>
            Add an extra layer of security for sensitive operations like backup uploads and restores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${mfaStatus.mfa_enabled ? 'bg-green-100' : 'bg-amber-100'}`}>
                {mfaStatus.mfa_enabled ? (
                  <Lock className="w-5 h-5 text-green-600" />
                ) : (
                  <Unlock className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {mfaStatus.mfa_enabled ? 'MFA Enabled' : 'MFA Not Enabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mfaStatus.mfa_enabled 
                    ? 'Your account is protected with two-factor authentication'
                    : 'Enable MFA for enhanced security on backup operations'
                  }
                </p>
              </div>
            </div>
            
            <Badge variant={mfaStatus.mfa_enabled ? 'default' : 'secondary'}>
              {mfaStatus.mfa_enabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {mfaStatus.mfa_enabled ? (
            <div className="flex gap-2">
              <Button variant="outline" className="text-red-600" onClick={() => setShowDisableModal(true)}>
                <Unlock className="w-4 h-4 mr-2" /> Disable MFA
              </Button>
            </div>
          ) : (
            <Button onClick={setupMfa} className="bg-green-600 hover:bg-green-700">
              <ShieldCheck className="w-4 h-4 mr-2" /> Enable MFA
            </Button>
          )}

          {/* Security Info */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Why enable MFA?
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Required for uploading backup files</li>
              <li>• Required for restoring data from backups</li>
              <li>• Protects against unauthorized access</li>
              <li>• Uses time-based one-time passwords (TOTP)</li>
              <li>• Compatible with Google Authenticator, Authy, etc.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Security Features Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Backup Security Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-800 dark:text-green-200">AES-256 Encryption</h4>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                All backups are encrypted using military-grade AES-256-GCM encryption
              </p>
            </div>
            
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-800 dark:text-green-200">Malware Scanning</h4>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Uploaded files are scanned for malicious code and injection attacks
              </p>
            </div>
            
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-800 dark:text-green-200">Role-Based Access</h4>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Only admins and owners can upload or restore backups
              </p>
            </div>
            
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-800 dark:text-green-200">Audit Logging</h4>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                All backup operations are logged for security auditing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MFA Setup Modal */}
      <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-green-600" />
              Setup Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img loading="lazy" 
                  src={`data:image/png;base64,${setupData.qr_code}`}
                  alt="MFA QR Code"
                  className="w-48 h-48"
                />
              </div>

              {/* Manual Entry */}
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Manual Entry Key:</Label>
                <code className="block mt-1 text-sm font-mono break-all">{setupData.secret}</code>
              </div>

              {/* Verification */}
              <div className="space-y-2">
                <Label>Enter verification code from your app:</Label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupModal(false)}>
              Cancel
            </Button>
            <Button onClick={verifyMfa} disabled={verifying || verificationCode.length !== 6}>
              {verifying ? 'Verifying...' : 'Verify & Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable MFA Modal */}
      <Dialog open={showDisableModal} onOpenChange={setShowDisableModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter your current MFA code to disable two-factor authentication
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Warning: Disabling MFA will reduce your account security. 
                Backup operations will no longer require MFA verification.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Enter your current MFA code:</Label>
              <Input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={disableMfa} 
              disabled={verifying || disableCode.length !== 6}
            >
              {verifying ? 'Disabling...' : 'Disable MFA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
