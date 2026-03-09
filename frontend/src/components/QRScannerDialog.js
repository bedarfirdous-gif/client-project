import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  QrCode, Camera, X, User, Phone, Mail, Star, 
  Clock, ShoppingBag, CreditCard, Loader2, Check
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';

export default function QRScannerDialog({ open, onClose, onCustomerScanned, mode = 'loyalty' }) {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const [scanning, setScanning] = useState(true);
  const [scanner, setScanner] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [loading, setLoading] = useState(false);
  // Avoid `null` initial state which can cause a brief UI flash when conditional
  // rendering switches between branches; use an explicit "empty" state instead.
  const [scannedData, setScannedData] = useState({ type: null, data: null });
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  useEffect(() => {
    if (open && scanning) {
      initScanner();
    }
    return () => {
      cleanupScanner();
    };
  }, [open, scanning]);

  const initScanner = () => {
    if (scannerInstanceRef.current) return;
    
    setTimeout(() => {
      if (!scannerRef.current) return;
      
      try {
        const scanner = new Html5QrcodeScanner(
          "qr-scanner-container",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          false
        );
        
        scanner.render(onScanSuccess, onScanFailure);
        scannerInstanceRef.current = scanner;
      } catch (err) {
        console.error('Scanner init error:', err);
      }
    }, 100);
  };

  const cleanupScanner = () => {
    if (scannerInstanceRef.current) {
      try {
        scannerInstanceRef.current.clear();
      } catch (e) {
        // Ignore cleanup errors
      }
      scannerInstanceRef.current = null;
    }
  };

  const onScanSuccess = async (decodedText) => {
    cleanupScanner();
    setScanning(false);
    setLoading(true);

    try {
      let result;
      
      if (decodedText.startsWith('LOYALTY:')) {
        // Scan loyalty card
        result = await api(`/api/loyalty/scan/${encodeURIComponent(decodedText)}`);
        setScannedData({
          type: 'customer',
          data: result.customer,
          recent_purchases: result.recent_purchases,
          quick_info: result.quick_info
        });
      } else if (decodedText.startsWith('EMPLOYEE:')) {
        // Scan employee ID for attendance
        result = await api('/api/attendance/scan-id', {
          method: 'POST',
          body: JSON.stringify({ qr_data: decodedText })
        });
        setScannedData({
          type: 'employee',
          action: result.action,
          message: result.message,
          data: result.employee,
          time: result.check_in_time || result.check_out_time
        });
        
        toast.success(result.message);
      } else {
        toast.error('Unknown QR code format');
        resetScanner();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to process QR code');
      resetScanner();
    } finally {
      setLoading(false);
    }
  };

  const onScanFailure = (error) => {
    // Ignore scan failures (happens continuously while scanning)
  };

  const resetScanner = () => {
    setScannedData(null);
    setScanning(true);
  };

  const handleUseCustomer = () => {
    if (scannedData?.type === 'customer' && scannedData.data) {
      onCustomerScanned?.(scannedData.data);
      onClose?.();
    }
  };

  const handleClose = () => {
    cleanupScanner();
    setScanning(true);
    setScannedData(null);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-purple-600" />
            {mode === 'loyalty' ? 'Scan Loyalty Card' : 'Scan Employee ID'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'loyalty' 
              ? 'Scan customer loyalty card for quick checkout'
              : 'Scan employee ID card for attendance'
            }
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <div className="relative">
            <div 
              id="qr-scanner-container" 
              ref={scannerRef}
              className="rounded-lg overflow-hidden"
            />
            <p className="text-center text-sm text-gray-500 mt-2">
              Position QR code within the frame
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
            <p className="text-gray-500">Processing...</p>
          </div>
        ) : scannedData?.type === 'customer' ? (
          <div className="space-y-4">
            {/* Customer Info */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center">
                  <User className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{scannedData.data.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone className="w-3 h-3" />
                    {scannedData.data.phone || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {scannedData.quick_info?.loyalty_points?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-gray-500">Points</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {currencySymbol}{scannedData.quick_info?.outstanding_balance?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-gray-500">Balance</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {scannedData.recent_purchases?.length || 0}
                </div>
                <div className="text-xs text-gray-500">Purchases</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetScanner} className="flex-1">
                Scan Again
              </Button>
              <Button onClick={handleUseCustomer} className="flex-1 bg-purple-600 hover:bg-purple-700">
                <Check className="w-4 h-4 mr-2" />
                Use for Billing
              </Button>
            </div>
          </div>
        ) : scannedData?.type === 'employee' ? (
          <div className="space-y-4">
            {/* Attendance Result */}
            <div className={`rounded-xl p-6 text-center ${
              scannedData.action === 'check_in' 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : scannedData.action === 'check_out'
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'bg-yellow-50 dark:bg-yellow-900/20'
            }`}>
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                scannedData.action === 'check_in'
                  ? 'bg-green-100'
                  : scannedData.action === 'check_out'
                  ? 'bg-blue-100'
                  : 'bg-yellow-100'
              }`}>
                <Clock className={`w-8 h-8 ${
                  scannedData.action === 'check_in'
                    ? 'text-green-600'
                    : scannedData.action === 'check_out'
                    ? 'text-blue-600'
                    : 'text-yellow-600'
                }`} />
              </div>
              
              <h3 className="font-bold text-lg">{scannedData.data?.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{scannedData.message}</p>
              
              {scannedData.time && (
                <Badge className="mt-3">
                  {new Date(scannedData.time).toLocaleTimeString()}
                </Badge>
              )}
            </div>

            {/* Action Button */}
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
