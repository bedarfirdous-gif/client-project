import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  CreditCard, Download, Printer, Star, Gift, Award,
  Phone, Mail, Calendar, ShoppingBag, Loader2, X,
  Crown, Medal, BadgeCheck, Sparkles
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';

import { useCurrency } from '../contexts/CurrencyContext';
// Tier colors and icons
const TIER_CONFIG = {
  Bronze: { color: 'from-amber-600 to-amber-800', icon: Medal, textColor: 'text-amber-100' },
  Silver: { color: 'from-gray-400 to-gray-600', icon: BadgeCheck, textColor: 'text-gray-100' },
  Gold: { color: 'from-yellow-500 to-yellow-700', icon: Star, textColor: 'text-yellow-100' },
  Platinum: { color: 'from-purple-500 to-purple-800', icon: Crown, textColor: 'text-purple-100' }
};

export default function CustomerLoyaltyCard({ customerId, customerName, onClose }) {
  const { currencySymbol } = useCurrency();
  const { api } = useAuth();
  const cardRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [timeout, setTimeout] = useState(false);
  // Avoid `null` initial state to prevent a brief "no content" render (visual flash)
  const [cardData, setCardData] = useState({});
  // Explicitly track first load so UI stays on loader until we have a response
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (customerId) {
      fetchLoyaltyCard();
    }
  }, [customerId]);

  const fetchLoyaltyCard = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/customers/${customerId}/loyalty-card`);
      setCardData(data);
    } catch (err) {
      toast.error('Failed to load loyalty card');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = cardRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Loyalty Card - ${cardData?.card_data?.customer_name}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .card { width: 350px; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
            .header { padding: 20px; color: white; text-align: center; }
            .header.Bronze { background: linear-gradient(135deg, #b45309, #92400e); }
            .header.Silver { background: linear-gradient(135deg, #9ca3af, #4b5563); }
            .header.Gold { background: linear-gradient(135deg, #eab308, #a16207); }
            .header.Platinum { background: linear-gradient(135deg, #a855f7, #6b21a8); }
            .content { padding: 20px; background: white; }
            .qr { text-align: center; margin: 15px 0; }
            .info { margin: 10px 0; }
            .label { font-size: 12px; color: #666; }
            .value { font-size: 14px; font-weight: bold; }
            .stats { display: flex; justify-content: space-around; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
            .stat { text-align: center; }
            .stat-value { font-size: 18px; font-weight: bold; color: #7c3aed; }
            .stat-label { font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header ${cardData?.card_data?.tier}">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Loyalty Card</div>
              <div style="font-size: 20px; font-weight: bold; margin: 8px 0;">${cardData?.card_data?.customer_name}</div>
              <div style="font-size: 24px; font-weight: bold;">${cardData?.card_data?.tier} Member</div>
            </div>
            <div class="content">
              <div class="qr">
                <img loading="lazy" src="${document.querySelector('.qr-code-svg')?.outerHTML ? `data:image/svg+xml,${encodeURIComponent(document.querySelector('.qr-code-svg')?.outerHTML)}` : ''}" width="120" height="120" />
              </div>
              <div class="info">
                <div class="label">Phone</div>
                <div class="value">${cardData?.card_data?.customer_phone || 'N/A'}</div>
              </div>
              <div class="info">
                <div class="label">Member Since</div>
                <div class="value">${cardData?.card_data?.member_since ? new Date(cardData.card_data.member_since).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div class="stats">
                <div class="stat">
                  <div class="stat-value">${cardData?.card_data?.loyalty_points || 0}</div>
                  <div class="stat-label">Points</div>
                </div>
                <div class="stat">
                  <div class="stat-value">${cardData?.card_data?.total_visits || 0}</div>
                  <div class="stat-label">Visits</div>
                </div>
                <div class="stat">
                  <div class="stat-value">{currencySymbol}${cardData?.card_data?.total_purchases?.toLocaleString() || 0}</div>
                  <div class="stat-label">Spent</div>
                </div>
              </div>
              <div style="text-align: center; margin-top: 15px; font-size: 11px; color: #666;">
                <div style="font-weight: bold; color: #333;">${cardData?.business?.name || cardData?.business?.store_name || 'Our Store'}</div>
                ${cardData?.business?.store_name && cardData?.business?.name !== cardData?.business?.store_name ? `<div>${cardData.business.store_name}</div>` : ''}
                ${cardData?.business?.address ? `<div>${cardData.business.address}</div>` : ''}
                ${cardData?.business?.phone ? `<div>Tel: ${cardData.business.phone}</div>` : ''}
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const tier = cardData?.card_data?.tier || 'Bronze';
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig?.icon || Medal;

  return (
    <Dialog open={!!customerId} onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : cardData ? (
          <div ref={cardRef}>
            {/* Card Header */}
            <div className={`bg-gradient-to-br ${tierConfig?.color} p-6 text-white`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase tracking-widest opacity-80">Loyalty Card</p>
                  <h2 className="text-2xl font-bold mt-1">{cardData.card_data.customer_name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <TierIcon className="w-5 h-5" />
                    <span className="font-semibold">{tier} Member</span>
                  </div>
                </div>
                <div className="text-right">
                  <Sparkles className="w-8 h-8 opacity-80" />
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6 bg-white dark:bg-gray-900">
              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="p-3 bg-white rounded-xl shadow-md">
                  <QRCodeSVG
                    value={cardData.card_data.qr_code_data}
                    size={140}
                    level="H"
                    includeMargin={false}
                    className="qr-code-svg"
                  />
                </div>
              </div>

              <p className="text-center text-xs text-gray-500 mb-4">
                Scan for quick checkout
              </p>

              {/* Customer Info */}
              <div className="space-y-3">
                {cardData.card_data.customer_phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{cardData.card_data.customer_phone}</span>
                  </div>
                )}
                {cardData.card_data.customer_email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{cardData.card_data.customer_email}</span>
                  </div>
                )}
                {cardData.card_data.member_since && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Member since {new Date(cardData.card_data.member_since).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {cardData.card_data.loyalty_points?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500">Points</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {cardData.card_data.total_visits || 0}
                  </div>
                  <div className="text-xs text-gray-500">Visits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {currencySymbol}{cardData.card_data.total_purchases?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500">Spent</div>
                </div>
              </div>

              {/* Business Footer - Store Name & Address */}
              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {cardData.business?.name || cardData.business?.store_name}
                </p>
                {cardData.business?.store_name && cardData.business?.name !== cardData.business?.store_name && (
                  <p className="text-xs text-gray-500 mt-0.5">{cardData.business?.store_name}</p>
                )}
                {cardData.business?.address && (
                  <p className="text-xs text-gray-400 mt-1">{cardData.business?.address}</p>
                )}
                {cardData.business?.phone && (
                  <p className="text-xs text-gray-400">Tel: {cardData.business?.phone}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print Card
                </Button>
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => onClose?.()}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            Failed to load loyalty card data
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
