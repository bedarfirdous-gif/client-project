import React, { useState } from 'react';
import { Download, Share2, CreditCard, FileText, Loader2, QrCode, Crown, Award, Star, Diamond, Printer } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../App';
import { QRCodeSVG } from 'qrcode.react';

// Tier configurations matching LoyaltyProgramPage
const TIER_CONFIG = {
  bronze: {
    icon: Award,
    gradient: 'from-amber-600 via-orange-500 to-amber-700',
    bgClass: 'bg-gradient-to-br from-amber-600 via-orange-500 to-amber-700',
    textColor: 'text-white'
  },
  silver: {
    icon: Star,
    gradient: 'from-slate-400 via-gray-300 to-slate-500',
    bgClass: 'bg-gradient-to-br from-slate-400 via-gray-300 to-slate-500',
    textColor: 'text-gray-900'
  },
  gold: {
    icon: Crown,
    gradient: 'from-yellow-400 via-amber-400 to-yellow-500',
    bgClass: 'bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500',
    textColor: 'text-gray-900'
  },
  platinum: {
    icon: Diamond,
    gradient: 'from-violet-500 via-purple-500 to-indigo-600',
    bgClass: 'bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600',
    textColor: 'text-white'
  }
};

// Card Preview Component
const MembershipCardPreview = ({ customer, orgName = "Your Store", storeName, storeAddress, tenantId }) => {
  const tier = (customer?.loyalty_tier || 'bronze').toLowerCase();
  const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const TierIcon = config.icon;
  
  // Generate QR code data for scanning
  const qrCodeData = `LOYALTY:${tenantId || 'default'}:${customer?.id || ''}`;
  
  const enrolledDate = customer?.loyalty_enrolled_at || customer?.created_at;
  let validFrom = 'N/A';
  if (enrolledDate) {
    try {
      const date = new Date(enrolledDate);
      validFrom = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (e) {
      validFrom = 'N/A';
    }
  }

  return (
    <div className={`relative w-full max-w-sm aspect-[1.586] rounded-xl overflow-hidden shadow-2xl ${config.bgClass}`}>
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
        }} />
      </div>
      
      {/* Card content */}
      <div className={`relative h-full p-4 flex flex-col ${config.textColor}`}>
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg tracking-wide">{orgName}</h3>
            {storeName && storeName !== orgName && (
              <p className="text-xs opacity-90">{storeName}</p>
            )}
            <p className="text-xs opacity-80">MEMBERSHIP CARD</p>
          </div>
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
            <TierIcon className="w-3 h-3" />
            <span className="text-xs font-bold uppercase">{tier}</span>
          </div>
        </div>
        
        {/* Member Info */}
        <div className="mt-3">
          <p className="text-xl font-bold tracking-wide">{customer?.name || 'Member Name'}</p>
          <p className="text-xs opacity-80 mt-1">ID: {(customer?.id || '').substring(0, 12).toUpperCase()}</p>
        </div>
        
        {/* Bottom section */}
        <div className="mt-auto flex justify-between items-end">
          <div>
            <p className="text-2xl font-bold">{(customer?.loyalty_points || 0).toLocaleString()}</p>
            <p className="text-xs opacity-80">LOYALTY POINTS</p>
          </div>
          
          <div className="text-right text-xs">
            <div className="opacity-80">
              <span>VALID FROM: </span>
              <span className="font-semibold">{validFrom}</span>
            </div>
            <div className="opacity-80">
              <span>VALID TILL: </span>
              <span className="font-semibold">Lifetime</span>
            </div>
          </div>
          
          {/* QR Code for scanning */}
          <div className="w-16 h-16 bg-white rounded-lg p-1 shadow-inner">
            {customer?.id ? (
              <QRCodeSVG
                value={qrCodeData}
                size={56}
                level="M"
                includeMargin={false}
                bgColor="transparent"
              />
            ) : (
              <QrCode className="w-full h-full text-gray-800" />
            )}
          </div>
        </div>
        
        {/* Store Address at bottom */}
        <div className="mt-2 text-right">
          {customer?.phone && (
            <p className="text-xs opacity-70">Ph: {customer.phone}</p>
          )}
          {storeAddress && (
            <p className="text-xs opacity-60 truncate">{storeAddress}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Membership Card Button Component
export default function MembershipCardButton({ customer, variant = "default", size = "default", showPreview = false, tenantId }) {
  const { api, user } = useAuth();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Avoid null initial state to prevent a "null -> object" re-render flash when the preview opens.
  // Use an explicit loaded flag for stable conditional rendering.
  const [businessInfo, setBusinessInfo] = useState({});
  const [isBusinessInfoLoaded, setIsBusinessInfoLoaded] = useState(false);
  
  // Fetch business info when preview opens
  React.useEffect(() => {
    // Only fetch once per customer/preview open; keep UI stable while loading.
    if (isPreviewOpen && customer?.id && !isBusinessInfoLoaded) {
      api(`/api/customers/${customer.id}/loyalty-card`)
        .then(data => {
          setBusinessInfo(data.business || {});
          setIsBusinessInfoLoaded(true);
        })
        .catch(err => {
          console.error('Failed to load business info:', err);
          // Mark as loaded to avoid repeated fetch loops/flicker on errors.
          setIsBusinessInfoLoaded(true);
        });
    }
  }, [isPreviewOpen, customer?.id, isBusinessInfoLoaded]);

  // Optional: render a small loader in the preview until business info is ready
  // to avoid content swapping/flash.
  const businessInfoLoadingIndicator = (!isBusinessInfoLoaded && isPreviewOpen) ? (
    <div className="flex items-center justify-center py-4">
      <Loader2 className="w-4 h-4 animate-spin" />
    </div>
  ) : null;
  
  // Use tenant_id from user or passed prop
  const actualTenantId = tenantId || user?.tenant_id;

  // Track card actions for history
  const trackCardAction = async (action) => {
    try {
      await api(`/api/card-history?card_type=loyalty&card_id=${customer?.id}&action=${action}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to track card action:', err);
    }
  };

  const handleDownload = async (cardSize = 'credit') => {
    if (!customer?.id) {
      toast.error('Customer data not available');
      return;
    }
    
    setDownloading(true);
    try {
      // Track download action
      trackCardAction('download');
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/customers/${customer.id}/membership-card?card_size=${cardSize}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to generate card');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `membership_card_${customer.name?.replace(/\s+/g, '_')}_${customer.id.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Membership card downloaded!');
    } catch (err) {
      console.error('Download error:', err);
      toast.error(err.message || 'Failed to download membership card');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!customer?.id) {
      toast.error('Customer data not available');
      return;
    }
    
    setSharing(true);
    try {
      // Track share action
      trackCardAction('share');
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/customers/${customer.id}/membership-card?card_size=credit`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to generate card');
      }
      
      const blob = await response.blob();
      const file = new File([blob], `membership_card_${customer.name}.pdf`, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Membership Card - ${customer.name}`,
          text: `Here is your membership card from our store!`,
          files: [file]
        });
        toast.success('Card shared successfully!');
      } else {
        // Fallback: Copy link or download
        const url = window.URL.createObjectURL(blob);
        await navigator.clipboard.writeText(`Membership Card for ${customer.name} - ${customer.loyalty_tier?.toUpperCase()} tier with ${customer.loyalty_points || 0} points`);
        toast.info('Card details copied! Share the downloaded PDF manually.');
        
        // Auto download as fallback
        const a = document.createElement('a');
        a.href = url;
        a.download = `membership_card_${customer.name?.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Share error:', err);
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Failed to share membership card');
      }
    } finally {
      setSharing(false);
    }
  };

  // Simple button variant
  if (variant === "icon-only") {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDownload('credit')}
          disabled={downloading}
          title="Download Membership Card"
          data-testid="download-membership-card-btn"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleShare}
          disabled={sharing}
          title="Share Membership Card"
          data-testid="share-membership-card-btn"
        >
          {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        </Button>
      </div>
    );
  }

  // Button with preview option
  if (showPreview) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          onClick={() => setIsPreviewOpen(true)}
          data-testid="membership-card-preview-btn"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Membership Card
        </Button>

        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Membership Card Preview
              </DialogTitle>
              <DialogDescription>
                Preview and download the membership card for {customer?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-4">
              <MembershipCardPreview 
                customer={customer} 
                tenantId={actualTenantId}
                orgName={businessInfo?.name || 'Your Store'}
                storeName={businessInfo?.store_name}
                storeAddress={businessInfo?.address}
              />
              
              <p className="text-xs text-gray-500 text-center">
                Scan QR code for quick checkout and loyalty rewards
              </p>
              
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDownload('credit')}
                  disabled={downloading}
                  data-testid="download-card-credit"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download Card
                </Button>
                
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { trackCardAction('print'); window.print(); }}
                  data-testid="print-card"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
              
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDownload('a4')}
                  disabled={downloading}
                  data-testid="download-card-a4"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Download A4
                </Button>
                
                <Button
                  className="flex-1"
                  onClick={handleShare}
                  disabled={sharing}
                  data-testid="share-card-btn"
                >
                  {sharing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-2" />
                  )}
                  Share
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Default buttons
  return (
    <div className="flex gap-2">
      <Button
        variant={variant}
        size={size}
        onClick={() => handleDownload('credit')}
        disabled={downloading}
        data-testid="download-membership-card"
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        Download PDF
      </Button>
      
      <Button
        variant="outline"
        size={size}
        onClick={handleShare}
        disabled={sharing}
        data-testid="share-membership-card"
      >
        {sharing ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Share2 className="w-4 h-4 mr-2" />
        )}
        Share PDF
      </Button>
    </div>
  );
}

// Export the preview component for use in other places
export { MembershipCardPreview };
