import React, { useState } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn, UserPlus, KeyRound, ArrowLeft, Shield, Check, Mail, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [timeout, setTimeout] = useState(false);
  const [item, setItem] = useState(false);
  const [requestHeader, setRequestHeader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  
  // Backup code recovery state
  const [showBackupCodeModal, setShowBackupCodeModal] = useState(false);
  const [backupCodeForm, setBackupCodeForm] = useState({ email: '', backupCode: '' });
  const [backupLoading, setBackupLoading] = useState(false);
  
  // Forgot password state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
        toast.success('Welcome back!');
      } else {
        await register(form.email, form.password, form.name);
        toast.success('Account created! Please login.');
        setIsLogin(true);
        setForm({ ...form, password: '' });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle backup code recovery login
  const handleBackupCodeRecovery = async (e) => {
    e.preventDefault();
    if (!backupCodeForm.email || !backupCodeForm.backupCode) {
      toast.error('Please enter both email and backup code');
      return;
    }
    
    setBackupLoading(true);
    try {
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/auth/recover-with-backup-code`;
      const body = JSON.stringify({
        email: backupCodeForm.email.toLowerCase().trim(),
        backup_code: backupCodeForm.backupCode.toUpperCase().replace(/[\s-]/g, '')
      });
      
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onload = function() {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.detail || 'Invalid backup code'));
            }
          } catch (e) {
            reject(new Error('Invalid server response'));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Network error - please check your connection'));
        };
        
        xhr.send(body);
      });
      
      localStorage.setItem('token', result.access_token);
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
      }
      
      toast.success(`Recovery successful! ${result.remaining_codes} backup codes remaining.`, {
        description: 'Please update your password in settings.',
        duration: 5000
      });
      
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      console.error('Backup code recovery error:', err);
      toast.error(err.message || 'Failed to recover with backup code');
    } finally {
      setBackupLoading(false);
    }
  };

  // State for reset link display
  const [resetLink, setResetLink] = useState('');
  
  // Handle forgot password email request
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast.error('Please enter your email address');
      return;
    }
    
    setForgotPasswordLoading(true);
    setResetLink(''); // Clear previous link
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail.toLowerCase().trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send reset email');
      }
      
      setForgotPasswordSent(true);
      
      // If reset_url is returned (no email service configured), show it directly
      if (data.reset_url) {
        setResetLink(data.reset_url);
        toast.success('Reset link generated!', {
          description: 'Copy the link below or click it to reset your password',
          duration: 10000
        });
      } else {
        toast.success('Password reset link sent!', {
          description: 'Please check your email inbox (and spam folder)',
          duration: 5000
        });
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const features = [
    'Inventory & Stock Management',
    'POS & Billing',
    'Purchase & Sales Tracking',
    'Loyalty & Vouchers',
    'Multi-Store Support'
  ];

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Panel - Purple/Violet Theme Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Deep Purple Gradient Background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 30%, #3d2066 60%, #2d1b4e 100%)'
          }}
        />
        
        {/* Animated Glow Effects - Purple/Violet */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" 
          style={{ background: 'rgba(139, 92, 246, 0.25)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl animate-pulse" 
          style={{ background: 'rgba(34, 211, 238, 0.15)', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl animate-pulse" 
          style={{ background: 'rgba(167, 139, 250, 0.2)', animationDelay: '0.5s' }} />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-center">
          {/* Logo - Purple accent */}
          <div className="w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-2xl mb-8 ring-4 ring-violet-500/30"
            style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
            <div className="text-xl font-bold tracking-tight flex items-baseline">
              <span className="text-white">bijn</span>
              <span className="text-white/70 font-extrabold">is</span>
              <span className="text-white">b</span>
              <span className="text-white/70 font-extrabold">oo</span>
              <span className="text-white">ks</span>
            </div>
            <p className="text-[10px] text-white/80 font-medium mt-1">घंटों का हिसाब, अब मिनटों में</p>
          </div>
          
          {/* Title - Cyan accent text */}
          <p className="text-violet-300/80 text-sm uppercase tracking-widest mb-2">Redefine</p>
          <h1 className="text-4xl font-bold leading-tight mb-4" style={{ color: '#22D3EE' }}>
            Customer Experiences
          </h1>
          <h2 className="text-2xl font-semibold text-white mb-2">
            Complete Multi-Store Business
          </h2>
          <h3 className="text-xl text-violet-200/80 mb-10">
            Management System
          </h3>
          
          {/* Feature List */}
          <div className="space-y-4 text-left max-w-md">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 group">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #22D3EE 0%, #8B5CF6 100%)' }}>
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
                <span className="text-violet-100/90 text-lg group-hover:text-white transition-colors">{feature}</span>
              </div>
            ))}
          </div>
          
          {/* Bottom decoration - Purple/Cyan dots */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#8B5CF6', animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#22D3EE', animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#A78BFA', animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-violet-50/30">
        {/* Location Notice - Purple themed */}
        <div className="bg-violet-500/10 border-b border-violet-500/20 px-6 py-3">
          <div className="flex items-center gap-2 text-violet-700 text-sm">
            <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
              <span className="text-violet-600 text-xs">📍</span>
            </div>
            <span className="text-violet-700">Please allow location access for store security features</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 xl:px-24 py-12">
          {/* Mobile Logo - Only visible on small screens */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg ring-4 ring-violet-500/30"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
              <div className="text-base font-bold tracking-tight flex items-baseline">
                <span className="text-white">bijn</span>
                <span className="text-white/70 font-extrabold">is</span>
                <span className="text-white">b</span>
                <span className="text-white/70 font-extrabold">oo</span>
                <span className="text-white">ks</span>
              </div>
            </div>
          </div>
          
          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-violet-500/10 p-8 max-w-md mx-auto w-full border border-violet-200/50">
            {/* Form Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-gray-500 text-sm">
                {isLogin ? 'Enter your credentials to access your account' : 'Fill in your details to get started'}
              </p>
            </div>
            
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-gray-700 text-sm font-medium">Full Name</Label>
                  <Input
                    id="name"
                    data-testid="register-name"
                    placeholder="Enter your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required={!isLogin}
                    className="h-11 bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>
              )}
              
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-700 text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="login-email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="h-11 bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-700 text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    data-testid="login-password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    className="pr-11 h-11 bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-600 transition-colors"
                    data-testid="toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 font-semibold rounded-lg mt-2 transition-all shadow-lg shadow-violet-500/25" 
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isLogin ? (
                  <><LogIn className="w-4 h-4 mr-2" /> Sign In</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" /> Create Account</>
                )}
              </Button>

              <div className="text-center text-sm pt-2">
                <span className="text-gray-500">
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                </span>
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-violet-600 font-semibold hover:text-violet-500 hover:underline"
                  data-testid="toggle-auth-mode"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </div>
              
              {/* Forgot Password Links */}
              {isLogin && (
                <div className="text-center pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="text-sm text-violet-600 hover:text-violet-500 font-medium flex items-center justify-center gap-1.5 mx-auto transition-colors"
                    data-testid="forgot-password-link"
                  >
                    <Mail className="w-4 h-4" />
                    Forgot Password? Reset via Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBackupCodeModal(true)}
                    className="text-sm text-gray-500 hover:text-violet-500 font-medium flex items-center justify-center gap-1.5 mx-auto transition-colors"
                    data-testid="use-backup-code-link"
                  >
                    <KeyRound className="w-4 h-4" />
                    Use Backup Code
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
      
      {/* Backup Code Recovery Modal */}
      <Dialog open={showBackupCodeModal} onOpenChange={setShowBackupCodeModal}>
        <DialogContent className="sm:max-w-md rounded-2xl" data-testid="backup-code-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet-600" />
              Account Recovery
            </DialogTitle>
            <DialogDescription>
              Enter your email and one of your backup recovery codes to access your account.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleBackupCodeRecovery} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email" className="text-gray-700 font-medium">Email Address</Label>
              <Input
                id="recovery-email"
                type="email"
                placeholder="Enter your email"
                value={backupCodeForm.email}
                onChange={(e) => setBackupCodeForm({ ...backupCodeForm, email: e.target.value })}
                required
                data-testid="backup-code-email"
                className="h-11 bg-gray-50 border-gray-200 rounded-lg focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="backup-code" className="text-gray-700 font-medium">Backup Recovery Code</Label>
              <Input
                id="backup-code"
                type="text"
                placeholder="XXXXXXXX"
                value={backupCodeForm.backupCode}
                onChange={(e) => setBackupCodeForm({ ...backupCodeForm, backupCode: e.target.value.toUpperCase() })}
                required
                data-testid="backup-code-input"
                className="h-11 bg-gray-50 border-gray-200 rounded-lg font-mono tracking-widest text-center text-lg focus:ring-violet-500 focus:border-violet-500"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground">
                Enter one of your 8-character backup codes (spaces and dashes are ignored)
              </p>
            </div>
            
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-sm text-foreground">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Each backup code can only be used once</li>
                <li>After login, please update your password immediately</li>
                <li>Contact admin if you've exhausted all backup codes</li>
              </ul>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowBackupCodeModal(false);
                  setBackupCodeForm({ email: '', backupCode: '' });
                }}
                className="flex-1 rounded-lg"
                data-testid="backup-code-cancel"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
              <Button
                type="submit"
                disabled={backupLoading}
                className="flex-1 rounded-lg"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}
                data-testid="backup-code-submit"
              >
                {backupLoading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Recover Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Forgot Password Modal */}
      <Dialog open={showForgotPasswordModal} onOpenChange={(open) => {
        setShowForgotPasswordModal(open);
        if (!open) {
          setForgotPasswordEmail('');
          setForgotPasswordSent(false);
        }
      }}>
        <DialogContent className="sm:max-w-md rounded-2xl" data-testid="forgot-password-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-violet-600" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              {forgotPasswordSent 
                ? "We've sent a password reset link to your email."
                : "Enter your email address and we'll send you a link to reset your password."
              }
            </DialogDescription>
          </DialogHeader>
          
          {forgotPasswordSent ? (
            <div className="space-y-4 mt-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-medium text-green-800 mb-1">
                  {resetLink ? 'Reset Link Generated!' : 'Email Sent!'}
                </p>
                <p className="text-sm text-green-600">
                  {resetLink 
                    ? 'Click the button below or copy the link to reset your password'
                    : <>Check your inbox for <span className="font-medium">{forgotPasswordEmail}</span></>
                  }
                </p>
                {!resetLink && (
                  <p className="text-xs text-green-500 mt-2">
                    Don't forget to check your spam folder
                  </p>
                )}
              </div>
              
              {/* Show reset link directly if email service not configured */}
              {resetLink && (
                <div className="space-y-3">
                  <a
                    href={resetLink}
                    className="block w-full bg-violet-600 hover:bg-violet-700 text-white text-center py-3 px-4 rounded-lg font-medium transition-colors"
                    data-testid="reset-password-direct-link"
                  >
                    Reset Password Now
                  </a>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-2">Or copy this link:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={resetLink}
                        readOnly
                        className="flex-1 text-xs bg-white border rounded px-2 py-1.5 text-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(resetLink);
                          toast.success('Link copied to clipboard!');
                        }}
                        className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded text-xs font-medium hover:bg-violet-200"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ This link expires in 1 hour
                    </p>
                  </div>
                </div>
              )}
              
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPasswordModal(false);
                  setForgotPasswordEmail('');
                  setForgotPasswordSent(false);
                  setResetLink('');
                }}
                className="w-full rounded-lg"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-gray-700 font-medium">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="Enter your email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  data-testid="forgot-password-email"
                  className="h-11 bg-gray-50 border-gray-200 rounded-lg focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
              
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-sm text-foreground">
                <p className="text-xs text-violet-700">
                  A password reset link will be sent to your email. The link will expire in 1 hour.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForgotPasswordModal(false);
                    setForgotPasswordEmail('');
                  }}
                  className="flex-1 rounded-lg"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={forgotPasswordLoading}
                  className="flex-1 rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}
                  data-testid="forgot-password-submit"
                >
                  {forgotPasswordLoading ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Reset Link
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
