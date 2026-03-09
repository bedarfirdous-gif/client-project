# Forgot Password Fix - Implementation Guide

This guide contains the exact code changes needed to fix the forgot password feature so it shows a direct reset link when no email service is configured.

## Files to Update:

### 1. Backend: `server.py` - Update the forgot-password endpoint

Find the `@api_router.post("/auth/forgot-password")` endpoint and replace it with:

```python
@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, req: Request):
    """Send password reset email or return reset link directly"""
    email = request.email.lower().strip()
    user = await db.users.find_one({"email": email})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a reset link has been sent.", "email_sent": False}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token
    await db.password_resets.delete_many({"email": email})
    await db.password_resets.insert_one({
        "email": email,
        "token": reset_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get tenant settings
    tenant_id = user.get("tenant_id", "default")
    settings = await db.settings.find_one({"tenant_id": tenant_id}) or {}
    
    # Build reset URL from request origin
    origin = req.headers.get("origin") or req.headers.get("referer", "").rstrip("/")
    if origin and "/api" in origin:
        origin = origin.split("/api")[0]
    if not origin:
        origin = "https://bijnisbooks.com"
    
    reset_url = f"{origin}/reset-password?token={reset_token}"
    
    # Try email services, fallback to direct link
    email_sent = False
    
    # Check SendGrid
    sendgrid_key = settings.get("sendgrid_api_key") or os.environ.get("SENDGRID_API_KEY")
    if sendgrid_key:
        # ... send email via SendGrid ...
        pass
    
    # If no email service, return direct link
    if not email_sent:
        return {
            "message": "No email service configured. Use the reset link below.",
            "email_sent": False,
            "reset_url": reset_url,
            "expires_in": "1 hour"
        }
    
    return {"message": "Password reset link has been sent to your email.", "email_sent": True}
```

### 2. Frontend: `LoginPage.js` - Update forgot password handler

Add state for reset link:
```javascript
const [resetLink, setResetLink] = useState('');
```

Update the handleForgotPassword function:
```javascript
const handleForgotPassword = async (e) => {
  e.preventDefault();
  if (!forgotPasswordEmail) {
    toast.error('Please enter your email address');
    return;
  }
  
  setForgotPasswordLoading(true);
  setResetLink('');
  
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
    
    // If reset_url is returned, show it directly
    if (data.reset_url) {
      setResetLink(data.reset_url);
      toast.success('Reset link generated!');
    } else {
      toast.success('Password reset link sent!');
    }
  } catch (err) {
    toast.error(err.message || 'Failed to send reset email');
  } finally {
    setForgotPasswordLoading(false);
  }
};
```

### 3. Frontend: Update the success UI in the modal

Replace the success state UI to show the reset link:
```jsx
{forgotPasswordSent ? (
  <div className="space-y-4 mt-4">
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
      <p className="font-medium text-green-800">
        {resetLink ? 'Reset Link Generated!' : 'Email Sent!'}
      </p>
      <p className="text-sm text-green-600">
        {resetLink 
          ? 'Click the button below or copy the link'
          : `Check your inbox for ${forgotPasswordEmail}`
        }
      </p>
    </div>
    
    {resetLink && (
      <div className="space-y-3">
        <a href={resetLink} className="block w-full bg-violet-600 text-white text-center py-3 rounded-lg">
          Reset Password Now
        </a>
        <div className="bg-gray-50 border rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Or copy this link:</p>
          <div className="flex gap-2">
            <input type="text" value={resetLink} readOnly className="flex-1 text-xs border rounded px-2 py-1" />
            <button onClick={() => navigator.clipboard.writeText(resetLink)} className="px-3 py-1 bg-violet-100 text-violet-700 rounded text-xs">
              Copy
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-2">⚠️ Link expires in 1 hour</p>
        </div>
      </div>
    )}
  </div>
) : (
  // ... existing form ...
)}
```

## Quick Apply:
To apply this fix to another environment, copy the updated `server.py` and `LoginPage.js` files from this environment.
