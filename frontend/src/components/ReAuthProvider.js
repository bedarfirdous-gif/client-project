import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, KeyRound, ShieldCheck, AlertTriangle, Fingerprint, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Context for Re-Authentication
const ReAuthContext = React.createContext(null);

export const useReAuth = () => {
  const context = React.useContext(ReAuthContext);
  if (!context) {
    throw new Error('useReAuth must be used within ReAuthProvider');
  }
  return context;
};

export function ReAuthProvider({ children }) {
  const { api, user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [interval, setInterval] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [showReAuthDialog, setShowReAuthDialog] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);

  // FIX: Avoid initializing to `null` which can cause a brief "empty/disabled" render
  // before the async `/api/auth/security-status` call resolves (visual flash).
  // Use a stable default shape + explicit loaded flag for conditional rendering.
  const [securityStatus, setSecurityStatus] = useState({});
  const [isSecurityStatusLoaded, setIsSecurityStatusLoaded] = useState(false);

  const [checkingSession, setCheckingSession] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const sessionCheckRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);
  const activityThrottleRef = useRef(null);
  const userIdRef = useRef(null);
  
  // Inactivity timeout in milliseconds (60 minutes as per requirement)
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000;
  // Check interval (every 30 seconds for more responsive lock)
  const CHECK_INTERVAL = 30 * 1000;

  // Log security event to backend for audit
  const logSecurityEvent = useCallback(async (eventType, details = {}) => {
    if (!user) return;
    try {
      await api('/api/auth/log-security-event', {
        method: 'POST',
        body: JSON.stringify({
          event_type: eventType,
          details: {
            ...details,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent
          }
        })
      });
    } catch (err) {
      console.error('Failed to log security event:', err);
    }
  }, [api, user]);

  // Track user activity with throttling for performance
  const updateLastActivity = useCallback(() => {
    // Throttle activity updates to every 5 seconds for performance
    if (activityThrottleRef.current) return;
    
    lastActivityRef.current = Date.now();
    
    activityThrottleRef.current = setTimeout(() => {
      activityThrottleRef.current = null;
    }, 5000);
  }, []);

  // Setup activity listeners (keyboard, mouse, touch, scroll)
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    // Comprehensive activity events for inactivity detection
    const activityEvents = [
      'mousedown',
      'mousemove',   // Track mouse movement
      'keydown',
      'keypress',    // Track keyboard input
      'touchstart',
      'touchmove',   // Track touch movement
      'scroll',
      'click',
      'wheel',       // Track mouse wheel
      'resize'       // Track window resize
    ];
    
    // Use passive listeners for better performance
    const listenerOptions = { passive: true, capture: false };
    
    activityEvents.forEach(event => {
      window.addEventListener(event, updateLastActivity, listenerOptions);
    });

    // Also track visibility change (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if session should be locked when user returns
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
          handleInactivityLock();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateLastActivity, listenerOptions);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (activityThrottleRef.current) {
        clearTimeout(activityThrottleRef.current);
      }
    };
  }, [user, isAuthenticated, updateLastActivity]);

  // Handle inactivity lock
  const handleInactivityLock = useCallback(async () => {
    const inactiveMinutes = Math.floor((Date.now() - lastActivityRef.current) / 60000);
    console.log(`Session locked due to ${inactiveMinutes} minutes of inactivity`);
    
    setLockReason(`Session locked after ${inactiveMinutes} minutes of inactivity`);
    setIsAuthenticated(false);
    setShowReAuthDialog(true);
    
    // Log lock event for audit
    await logSecurityEvent('session_locked', {
      reason: 'inactivity',
      inactive_minutes: inactiveMinutes
    });
    
    toast.warning('Session locked due to inactivity. Please verify your identity to continue.', {
      duration: 5000,
      icon: <Lock className="w-5 h-5" />
    });
  }, [logSecurityEvent]);

  // Check for inactivity periodically
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        handleInactivityLock();
      }
    };

    // Check every 30 seconds for responsive lock
    inactivityTimerRef.current = setInterval(checkInactivity, CHECK_INTERVAL);

    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [user, isAuthenticated, handleInactivityLock]);

  // Check security status on mount - only once per user
  useEffect(() => {
    // Only run check if user changed (new login)
    if (user && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      checkSecurityStatus();
    } else if (!user) {
      // User logged out - reset state
      userIdRef.current = null;
      setIsAuthenticated(false);
      setInitialCheckComplete(false);
      setSecurityStatus(null);
    }
    
    return () => {
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
      }
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [user?.id]);

  // Periodically check if re-auth session is still valid
  useEffect(() => {
    if (isAuthenticated && user) {
      sessionCheckRef.current = setInterval(() => {
        checkSessionValidity();
      }, 60000); // Check every minute
    }
    
    return () => {
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
      }
    };
  }, [isAuthenticated, user]);

  const checkSecurityStatus = async () => {
    try {
      const status = await api('/api/auth/security-status');
      setSecurityStatus(status);
      
      // Check if there's a valid re-auth session
      const sessionValid = await checkSessionValidity();
      
      if (!sessionValid) {
        setShowReAuthDialog(true);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Failed to check security status:', err);
      setShowReAuthDialog(true);
    } finally {
      setInitialCheckComplete(true);
    }
  };

  const checkSessionValidity = async () => {
    if (checkingSession) return false;
    setCheckingSession(true);
    
    try {
      const result = await api('/api/auth/check-reauth');
      if (result.is_valid) {
        setIsAuthenticated(true);
        return true;
      } else {
        setIsAuthenticated(false);
        setShowReAuthDialog(true);
        return false;
      }
    } catch (err) {
      setIsAuthenticated(false);
      setShowReAuthDialog(true);
      return false;
    } finally {
      setCheckingSession(false);
    }
  };

  const verifyReAuth = async (method, credential) => {
    try {
      await api('/api/auth/verify-reauth', {
        method: 'POST',
        body: JSON.stringify({ method, credential })
      });
      setIsAuthenticated(true);
      setShowReAuthDialog(false);
      setLockReason('');
      // Reset activity timer on successful authentication
      lastActivityRef.current = Date.now();
      
      // Log unlock event for audit
      await logSecurityEvent('session_unlocked', {
        method: method,
        unlock_reason: lockReason || 'manual_verification'
      });
      
      toast.success('Session unlocked successfully');
      return true;
    } catch (err) {
      // Log failed attempt for audit
      await logSecurityEvent('unlock_failed', {
        method: method,
        error: err.message
      });
      toast.error(err.message || 'Authentication failed');
      return false;
    }
  };

  const setupPin = async (pin, confirmPin) => {
    try {
      await api('/api/auth/setup-pin', {
        method: 'POST',
        body: JSON.stringify({ pin, confirm_pin: confirmPin })
      });
      setSecurityStatus({ ...securityStatus, has_pin: true });
      setShowPinSetup(false);
      toast.success('PIN set successfully');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to set PIN');
      return false;
    }
  };

  // Sensitive action verification
  // FIX: Avoid `null` initial state which can cause a brief render where the dialog
  // has no action details yet (visual flash). Use a stable default shape + loaded flag.
  const [sensitiveAction, setSensitiveAction] = useState({
    actionName: '',
    actionDescription: '',
    onConfirm: null
  });
  const [isSensitiveActionReady, setIsSensitiveActionReady] = useState(false);
  const [showSensitiveAuthDialog, setShowSensitiveAuthDialog] = useState(false);

  const requireSensitiveAuth = (actionName, actionDescription, onConfirm) => {
    setSensitiveAction({ actionName, actionDescription, onConfirm });
    setIsSensitiveActionReady(true);
    setShowSensitiveAuthDialog(true);
  };

  const handleSensitiveAuthVerify = async (method, credential) => {
    try {
      await api('/api/auth/verify-reauth', {
        method: 'POST',
        body: JSON.stringify({ method, credential })
      });
      setShowSensitiveAuthDialog(false);
      if (sensitiveAction?.onConfirm) {
        await sensitiveAction.onConfirm();
      }
      setSensitiveAction(null);
      return true;
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
      return false;
    }
  };

  const cancelSensitiveAuth = () => {
    setShowSensitiveAuthDialog(false);
    setSensitiveAction(null);
  };

  const requireReAuth = useCallback(() => {
    setShowReAuthDialog(true);
    setIsAuthenticated(false);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isAuthenticated,
    securityStatus,
    showReAuthDialog,
    showPinSetup,
    setShowPinSetup,
    verifyReAuth,
    setupPin,
    requireReAuth,
    checkSessionValidity,
    // Sensitive action methods
    requireSensitiveAuth,
    cancelSensitiveAuth
  }), [
    isAuthenticated,
    securityStatus,
    showReAuthDialog,
    showPinSetup,
    verifyReAuth,
    setupPin,
    requireReAuth,
    checkSessionValidity,
    requireSensitiveAuth,
    cancelSensitiveAuth
  ]);

  // REMOVED: Blocking loading overlay that caused blinking
  // The app now renders immediately and shows re-auth dialog when needed

  return (
    <ReAuthContext.Provider value={value}>
      {children}
      
      {/* Re-Authentication Dialog (Page Load) */}
      <ReAuthDialog 
        open={showReAuthDialog && !showPinSetup}
        securityStatus={securityStatus}
        lockReason={lockReason}
        onVerify={verifyReAuth}
        onSetupPin={() => setShowPinSetup(true)}
      />
      
      {/* PIN Setup Dialog */}
      <PinSetupDialog
        open={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        onSetup={setupPin}
      />

      {/* Sensitive Action Auth Dialog */}
      <SensitiveActionAuthDialog
        open={showSensitiveAuthDialog}
        action={sensitiveAction}
        securityStatus={securityStatus}
        onVerify={handleSensitiveAuthVerify}
        onCancel={cancelSensitiveAuth}
      />
    </ReAuthContext.Provider>
  );
}

// Re-Authentication Dialog Component
function ReAuthDialog({ open, securityStatus, lockReason, onVerify, onSetupPin }) {
  const [method, setMethod] = useState('password');
  const [credential, setCredential] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!credential) {
      toast.error('Please enter your ' + (method === 'pin' ? 'PIN' : 'password'));
      return;
    }
    
    setVerifying(true);
    await onVerify(method, credential);
    setVerifying(false);
    setCredential('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Security Verification Required
          </DialogTitle>
          <DialogDescription>
            For your security, please verify your identity to continue.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Lock Reason Banner */}
          {lockReason && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {lockReason}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Re-authentication is required to access the system
                </p>
              </div>
            </div>
          )}
          
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{securityStatus?.user_name || 'User'}</p>
              <p className="text-xs text-muted-foreground capitalize">{securityStatus?.user_role}</p>
            </div>
          </div>
          
          {/* Authentication Tabs */}
          <Tabs value={method} onValueChange={setMethod} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" className="gap-2">
                <KeyRound className="w-4 h-4" />
                Password
              </TabsTrigger>
              <TabsTrigger value="pin" disabled={!securityStatus?.has_pin} className="gap-2">
                <Fingerprint className="w-4 h-4" />
                PIN
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="password" className="mt-4">
              <div className="space-y-2">
                <Label>Enter your password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pr-10"
                    data-testid="reauth-password-input"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="pin" className="mt-4">
              {securityStatus?.has_pin ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Enter your 4-digit PIN</Label>
                    <Input
                      type="password"
                      placeholder="• • • •"
                      value={credential}
                      onChange={(e) => setCredential(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      onKeyPress={handleKeyPress}
                      maxLength={4}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      data-testid="reauth-pin-input"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMethod('password')}
                    className="text-sm text-primary hover:underline w-full text-center"
                    data-testid="forgot-pin-btn"
                  >
                    Forgot PIN? Use password instead
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    You haven't set up a PIN yet.
                  </p>
                  <Button variant="outline" onClick={onSetupPin}>
                    Set Up PIN
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!securityStatus?.has_pin && (
            <Button variant="ghost" onClick={onSetupPin} className="w-full sm:w-auto">
              Set Up PIN for faster access
            </Button>
          )}
          <Button 
            onClick={handleVerify} 
            disabled={verifying || !credential}
            className="w-full sm:w-auto"
            data-testid="reauth-verify-btn"
          >
            {verifying ? 'Verifying...' : 'Verify & Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// PIN Setup Dialog Component
function PinSetupDialog({ open, onClose, onSetup }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setting, setSetting] = useState(false);
  const [step, setStep] = useState(1);

  const handleSetup = async () => {
    if (pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    
    setSetting(true);
    const success = await onSetup(pin, confirmPin);
    setSetting(false);
    
    if (success) {
      setPin('');
      setConfirmPin('');
      setStep(1);
    }
  };

  const handlePinChange = (value, isConfirm = false) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 4);
    if (isConfirm) {
      setConfirmPin(cleanValue);
    } else {
      setPin(cleanValue);
    }
  };

  const handleClose = () => {
    setPin('');
    setConfirmPin('');
    setStep(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-primary" />
            {step === 1 ? 'Create Security PIN' : 'Confirm Your PIN'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Set a 4-digit PIN for quick re-authentication'
              : 'Enter your PIN again to confirm'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex justify-center gap-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                      i < pin.length 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border'
                    }`}
                  >
                    {i < pin.length ? '•' : ''}
                  </div>
                ))}
              </div>
              <Input
                type="password"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                className="opacity-0 absolute"
                autoFocus
                data-testid="pin-setup-input"
              />
              <p className="text-center text-sm text-muted-foreground">
                Enter 4 digits
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center gap-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                      i < confirmPin.length 
                        ? pin[i] === confirmPin[i] 
                          ? 'border-green-500 bg-green-50 text-green-600' 
                          : 'border-red-500 bg-red-50 text-red-600'
                        : 'border-border'
                    }`}
                  >
                    {i < confirmPin.length ? '•' : ''}
                  </div>
                ))}
              </div>
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => handlePinChange(e.target.value, true)}
                className="opacity-0 absolute"
                autoFocus
                data-testid="pin-confirm-input"
              />
              <p className="text-center text-sm text-muted-foreground">
                Re-enter your PIN to confirm
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === 1 ? (
            <Button 
              onClick={() => setStep(2)} 
              disabled={pin.length !== 4}
              data-testid="pin-next-btn"
            >
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleSetup} 
              disabled={setting || confirmPin.length !== 4 || pin !== confirmPin}
              data-testid="pin-confirm-btn"
            >
              {setting ? 'Setting...' : 'Confirm PIN'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sensitive Action Authentication Dialog
function SensitiveActionAuthDialog({ open, action, securityStatus, onVerify, onCancel }) {
  const [method, setMethod] = useState('password');
  const [credential, setCredential] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setCredential('');
      setMethod(securityStatus?.has_pin ? 'pin' : 'password');
    }
  }, [open, securityStatus?.has_pin]);

  const handleVerify = async () => {
    if (!credential) {
      toast.error('Please enter your ' + (method === 'pin' ? 'PIN' : 'password'));
      return;
    }
    
    setVerifying(true);
    const success = await onVerify(method, credential);
    setVerifying(false);
    if (success) {
      setCredential('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  const getActionIcon = (actionName) => {
    const icons = {
      'delete': <AlertTriangle className="w-6 h-6 text-red-500" />,
      'approve_loan': <ShieldCheck className="w-6 h-6 text-amber-500" />,
      'payroll': <Lock className="w-6 h-6 text-blue-500" />,
      'user_management': <ShieldCheck className="w-6 h-6 text-purple-500" />,
      'default': <ShieldCheck className="w-6 h-6 text-primary" />
    };
    return icons[actionName] || icons['default'];
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getActionIcon(action?.name)}
            Confirm Sensitive Action
          </DialogTitle>
          <DialogDescription>
            This action requires additional security verification.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Action Description */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {action?.description || 'Sensitive action requires verification'}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  Please verify your identity to proceed.
                </p>
              </div>
            </div>
          </div>
          
          {/* Authentication Tabs */}
          <Tabs value={method} onValueChange={setMethod} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" className="gap-2">
                <KeyRound className="w-4 h-4" />
                Password
              </TabsTrigger>
              <TabsTrigger value="pin" disabled={!securityStatus?.has_pin} className="gap-2">
                <Fingerprint className="w-4 h-4" />
                PIN
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="password" className="mt-4">
              <div className="space-y-2">
                <Label>Enter your password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pr-10"
                    data-testid="sensitive-password-input"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="pin" className="mt-4">
              <div className="space-y-2">
                <Label>Enter your PIN</Label>
                <Input
                  type="password"
                  placeholder="Enter 4-6 digit PIN"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyPress={handleKeyPress}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  data-testid="sensitive-pin-input"
                  autoFocus
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleVerify} 
            disabled={verifying || !credential}
            className="flex-1"
            data-testid="sensitive-verify-btn"
          >
            {verifying ? 'Verifying...' : 'Verify & Proceed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReAuthProvider;
