import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Gift, Download, Share2, Copy, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

import { useCurrency } from '../contexts/CurrencyContext';
const VOUCHER_TEMPLATES = [
  { id: 'red', name: 'Classic Red', bg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', accent: '#fecaca' },
  { id: 'blue', name: 'Ocean Blue', bg: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', accent: '#bfdbfe' },
  { id: 'green', name: 'Fresh Green', bg: 'linear-gradient(135deg, #16a34a 0%, #166534 100%)', accent: '#bbf7d0' },
  { id: 'purple', name: 'Royal Purple', bg: 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)', accent: '#e9d5ff' },
  { id: 'orange', name: 'Sunset Orange', bg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', accent: '#fed7aa' },
  { id: 'pink', name: 'Rose Pink', bg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', accent: '#fbcfe8' },
];

export default function VoucherImageGenerator({ isOpen, onClose, voucher, storeName = 'Your Store' }) {
  const { currencySymbol } = useCurrency();
  const voucherRef = useRef(null);
  const [selectedTemplate, setSelectedTemplate] = useState('red');
  const [timeout, setTimeout] = useState(false);
  const [customStoreName, setCustomStoreName] = useState(storeName);
  const [contactNumber, setContactNumber] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentTemplate = VOUCHER_TEMPLATES.find(t => t.id === selectedTemplate) || VOUCHER_TEMPLATES[0];

  const downloadImage = async () => {
    if (!voucherRef.current) return;
    
    setDownloading(true);
    try {
      const canvas = await html2canvas(voucherRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `voucher_${voucher?.code || 'promo'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Voucher image downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download image');
    } finally {
      setDownloading(false);
    }
  };

  const shareToWhatsApp = async () => {
    if (!voucherRef.current) return;
    
    try {
      const canvas = await html2canvas(voucherRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
      });
      
      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `voucher_${voucher?.code || 'promo'}.png`, { type: 'image/png' });
          try {
            await navigator.share({
              files: [file],
              title: '🎁 Gift Voucher',
              text: `Use code ${voucher?.code} to get ${currencySymbol}${voucher?.discount_value || 100} off! Min. purchase ${currencySymbol}${voucher?.min_order || 0}`,
            });
          } catch (err) {
            // Fallback to WhatsApp URL
            const message = `🎁 *GIFT VOUCHER* from ${customStoreName}\n\n💰 Get ${currencySymbol}${voucher?.discount_value || 100} OFF!\n🔖 Code: *${voucher?.code}*\n📦 Min. Purchase: ${currencySymbol}${voucher?.min_order || 0}\n📅 Valid Until: ${voucher?.valid_until ? new Date(voucher.valid_until).toLocaleDateString() : 'Limited Time'}\n\n${contactNumber ? `📞 Contact: ${contactNumber}` : ''}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
          }
        } else {
          // Fallback for browsers without Web Share API
          const message = `🎁 *GIFT VOUCHER* from ${customStoreName}\n\n💰 Get ${currencySymbol}${voucher?.discount_value || 100} OFF!\n🔖 Code: *${voucher?.code}*\n📦 Min. Purchase: ${currencySymbol}${voucher?.min_order || 0}\n📅 Valid Until: ${voucher?.valid_until ? new Date(voucher.valid_until).toLocaleDateString() : 'Limited Time'}\n\n${contactNumber ? `📞 Contact: ${contactNumber}` : ''}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share');
    }
  };

  const copyCode = async () => {
    const codeText = voucher?.code || '';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codeText);
      } else {
        // Fallback for mobile/restricted browsers
        const textArea = document.createElement('textarea');
        textArea.value = codeText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  if (!voucher) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Create Shareable Voucher
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input 
                value={customStoreName}
                onChange={(e) => setCustomStoreName(e.target.value)}
                placeholder="Your Store Name"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Number (optional)</Label>
              <Input 
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g., 9876543210"
              />
            </div>

            <div className="space-y-2">
              <Label>Color Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                {VOUCHER_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      selectedTemplate === template.id 
                        ? 'border-gray-900 dark:border-white scale-105' 
                        : 'border-transparent'
                    }`}
                    style={{ background: template.bg }}
                    title={template.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={downloadImage} 
                disabled={downloading}
                className="flex-1 gap-2"
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Downloading...' : 'Download'}
              </Button>
              <Button 
                onClick={shareToWhatsApp}
                variant="outline"
                className="flex-1 gap-2 border-green-500 text-green-600 hover:bg-green-50"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div 
              ref={voucherRef}
              className="w-[280px] rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: currentTemplate.bg }}
            >
              {/* Gift Icon */}
              <div className="pt-6 pb-2 flex justify-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <Gift className="w-10 h-10 text-white" />
                </div>
              </div>

              {/* Store Name */}
              <p className="text-center text-white/90 text-sm font-medium">
                {customStoreName || 'Your Store'}
              </p>

              {/* Gift Voucher Title */}
              <h2 className="text-center text-white text-2xl font-bold mt-2">
                GIFT VOUCHER
              </h2>

              {/* Value */}
              <div className="text-center py-4">
                <span className="text-5xl font-black text-white drop-shadow-lg">
                  {currencySymbol}{voucher.discount_value || 100}
                </span>
                {voucher.discount_type === 'percentage' && (
                  <span className="text-2xl text-white/90 ml-1">OFF</span>
                )}
              </div>

              {/* Voucher Code Box */}
              <div className="mx-6 rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <p className="text-white/80 text-xs uppercase tracking-wider mb-1">Voucher Code</p>
                <p className="text-white text-2xl font-bold tracking-widest">{voucher.code}</p>
              </div>

              {/* Details */}
              <div className="px-6 py-4 space-y-1 text-center">
                <p className="text-white/90 text-sm">
                  Min. Purchase: {currencySymbol}{voucher.min_order || 0}
                </p>
                {voucher.max_uses && (
                  <p className="text-white/90 text-sm">
                    Uses: {voucher.used_count || 0}/{voucher.max_uses}
                  </p>
                )}
                <div className="inline-block px-4 py-1.5 rounded-full mt-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <p className="text-white font-semibold text-sm">
                    Valid Until: {voucher.valid_until 
                      ? new Date(voucher.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'No Expiry'
                    }
                  </p>
                </div>
              </div>

              {/* Terms */}
              <div className="border-t border-white/20 border-dashed mx-4" />
              <div className="px-6 py-4 text-white/80 text-xs space-y-1">
                <p>• Present this voucher at billing</p>
                <p>• Cannot be combined with other offers</p>
                {contactNumber && (
                  <p className="pt-1 font-medium">📞 Contact: {contactNumber}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Copy Code Button */}
        <div className="flex items-center justify-center gap-2 pt-2 border-t">
          <span className="text-sm text-gray-500">Quick copy:</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={copyCode}
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {voucher.code}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
