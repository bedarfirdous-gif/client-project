import React, { useState, useEffect } from 'react';
import { User, Key, Mail, Save, X, Eye, EyeOff, Fingerprint, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../App';
import { Badge } from './ui/badge';

export default function MyProfileButton() {
  const { user, api } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinForm, setPinForm] = useState({ pin: '', confirm_pin: '' });
  const [settingPin, setSettingPin] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (isOpen) {
      checkPinStatus();
      // Reset PIN setup form when dialog opens
      setShowPinSetup(false);
      setPinForm({ pin: '', confirm_pin: '' });
    }
  }, [isOpen]);

  const checkPinStatus = async () => {
    try {
      const status = await api('/api/auth/security-status');
      setHasPin(status.has_pin);
    } catch (err) {
      console.error('Failed to check PIN status');
    }
  };

  const handleSetupPin = async () => {
    if (pinForm.pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    if (pinForm.pin !== pinForm.confirm_pin) {
      toast.error('PINs do not match');
      return;
    }
    
    setSettingPin(true);
    try {
      await api('/api/auth/setup-pin', {
        method: 'POST',
        body: JSON.stringify({
          pin: pinForm.pin,
          confirm_pin: pinForm.confirm_pin
        })
      });
      toast.success('Security PIN set successfully!');
      setHasPin(true);
      setShowPinSetup(false);
      setPinForm({ pin: '', confirm_pin: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to set PIN');
    } finally {
      setSettingPin(false);
    }
  };

  const handleOpen = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setFormData({
      name: '',
      email: '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords if changing
    if (formData.new_password) {
      if (!formData.current_password) {
        toast.error('Please enter your current password');
        return;
      }
      if (formData.new_password.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      if (formData.new_password !== formData.confirm_password) {
        toast.error('New passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      const updateData = {
        name: formData.name
      };

      // Add password change if provided
      if (formData.new_password && formData.current_password) {
        updateData.current_password = formData.current_password;
        updateData.new_password = formData.new_password;
      }

      await api('/api/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      toast.success('Profile updated successfully!');
      
      if (formData.new_password) {
        toast.info('Password changed. Please login again with your new password.');
        // Clear token and reload after password change
        setTimeout(() => {
          localStorage.removeItem('token');
          window.location.reload();
        }, 2000);
      } else {
        handleClose();
      }
    } catch (err) {
      // Show specific error messages
      const errorMsg = err.message || 'Failed to update profile';
      if (errorMsg.includes('Current password is incorrect')) {
        toast.error('Current password is incorrect. Please try again.');
      } else if (errorMsg.includes('at least 6 characters')) {
        toast.error('New password must be at least 6 characters long.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="flex items-center gap-2"
        data-testid="my-profile-btn"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">My Profile</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              My Profile
            </DialogTitle>
            <DialogDescription>
              Update your profile information and change your password
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* User Info Section */}
            <div className="p-3 bg-muted rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">Logged in as</p>
              <p className="font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">Role: {user.role}</p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                data-testid="profile-name-input"
              />
            </div>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Change Password (Optional)
                </span>
              </div>
            </div>

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current_password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={formData.current_password}
                  onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                  placeholder="Enter current password"
                  data-testid="profile-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.new_password}
                  onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                  placeholder="Enter new password (min 6 chars)"
                  data-testid="profile-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                  data-testid="profile-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Security PIN Section */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Security PIN
                </span>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Quick Authentication PIN</p>
                    <p className="text-xs text-muted-foreground">
                      {hasPin ? 'PIN is set for faster re-authentication' : 'Set up a PIN for quick verification'}
                    </p>
                  </div>
                </div>
                {hasPin ? (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Active
                  </Badge>
                ) : (
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={() => setShowPinSetup(true)}
                    data-testid="setup-pin-btn"
                  >
                    Set Up PIN
                  </Button>
                )}
              </div>
              
              {showPinSetup && (
                <div className="mt-4 space-y-3 pt-3 border-t">
                  <div className="space-y-2">
                    <Label>{hasPin ? 'New PIN (4 digits)' : 'Create PIN (4 digits)'}</Label>
                    <Input
                      type="password"
                      value={pinForm.pin}
                      onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="• • • •"
                      maxLength={4}
                      className="text-center tracking-[0.5em] text-xl font-mono"
                      data-testid="profile-pin-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm PIN</Label>
                    <Input
                      type="password"
                      value={pinForm.confirm_pin}
                      onChange={(e) => setPinForm({ ...pinForm, confirm_pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="• • • •"
                      maxLength={4}
                      className="text-center tracking-[0.5em] text-xl font-mono"
                      data-testid="profile-confirm-pin-input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setShowPinSetup(false); setPinForm({ pin: '', confirm_pin: '' }); }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={handleSetupPin}
                      disabled={settingPin || pinForm.pin.length !== 4}
                      data-testid="save-pin-btn"
                    >
                      {settingPin ? (hasPin ? 'Updating...' : 'Setting...') : (hasPin ? 'Update PIN' : 'Save PIN')}
                    </Button>
                  </div>
                </div>
              )}
              
              {hasPin && !showPinSetup && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 w-full border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPinSetup(true);
                  }}
                  data-testid="change-pin-btn"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Change PIN
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
                data-testid="profile-save-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
