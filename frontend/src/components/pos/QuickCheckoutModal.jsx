import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Banknote, CreditCard, Smartphone, QrCode, Building2, Zap, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';

// Payment methods configuration
const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-700 border-green-200', shortcut: 'C' },
  { id: 'gpay', label: 'GPay', icon: Smartphone, color: 'bg-blue-100 text-blue-700 border-blue-200', shortcut: 'G' },
  { id: 'upi', label: 'UPI', icon: QrCode, color: 'bg-amber-100 text-amber-700 border-amber-200', shortcut: 'U' },
  { id: 'card', label: 'Card', icon: CreditCard, color: 'bg-red-100 text-red-700 border-red-200', shortcut: 'D' },
  { id: 'bank', label: 'Bank', icon: Building2, color: 'bg-purple-100 text-purple-700 border-purple-200', shortcut: 'B' },
];

// Quick cash amounts
const QUICK_CASH_AMOUNTS = [100, 200, 500, 1000, 2000];

const QuickCheckoutModal = ({
  open,
  onClose,
  cart,
  total,
  subtotal,
  taxAmount,
  formatCurrency,
  onCompleteSale,
  selectedCustomer,
  selectedStore
}) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [processing, setProcessing] = useState(false);

  // Calculate change
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = useMemo(() => Math.max(0, cashReceivedNum - total), [cashReceivedNum, total]);
  const canComplete = paymentMethod !== 'cash' || cashReceivedNum >= total;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPaymentMethod('cash');
      setCashReceived('');
      setProcessing(false);
    }
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      // Payment method shortcuts
      const method = PAYMENT_METHODS.find(m => m.shortcut.toLowerCase() === e.key.toLowerCase());
      if (method && !e.ctrlKey && !e.metaKey) {
        setPaymentMethod(method.id);
        return;
      }

      // Enter to complete
      if (e.key === 'Enter' && canComplete) {
        e.preventDefault();
        handleComplete();
        return;
      }

      // Escape to close
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, canComplete, onClose]);

  // Handle quick cash button
  const handleQuickCash = useCallback((amount) => {
    setCashReceived(prev => {
      const current = parseFloat(prev) || 0;
      return String(current + amount);
    });
  }, []);

  // Handle exact amount
  const handleExactAmount = useCallback(() => {
    setCashReceived(String(Math.ceil(total)));
  }, [total]);

  // Complete sale
  const handleComplete = useCallback(async () => {
    if (!canComplete) {
      toast.error('Insufficient payment amount');
      return;
    }

    setProcessing(true);
    try {
      await onCompleteSale({
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? cashReceivedNum : total,
        change: paymentMethod === 'cash' ? change : 0
      });
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to complete sale');
    } finally {
      setProcessing(false);
    }
  }, [canComplete, paymentMethod, cashReceivedNum, total, change, onCompleteSale, onClose]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Quick Checkout
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Items ({cart.length})</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">GST</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl pt-2 border-t mt-2">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <Label className="mb-2 block">Payment Method (use shortcut keys)</Label>
            <div className="grid grid-cols-5 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                      isSelected 
                        ? `${method.color} border-current` 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    data-testid={`payment-method-${method.id}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{method.label}</span>
                    <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 rounded">
                      {method.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Payment Section */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div>
                <Label>Cash Received</Label>
                <Input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  className="text-2xl h-14 text-right font-bold"
                  autoFocus
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExactAmount}
                  className="flex-1"
                >
                  Exact ({formatCurrency(Math.ceil(total))})
                </Button>
                {QUICK_CASH_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickCash(amount)}
                  >
                    +{formatCurrency(amount)}
                  </Button>
                ))}
              </div>

              {/* Change Display */}
              {cashReceivedNum > 0 && (
                <div className={`p-3 rounded-lg ${
                  cashReceivedNum >= total 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' 
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {cashReceivedNum >= total ? 'Change' : 'Remaining'}
                    </span>
                    <span className={`text-xl font-bold ${
                      cashReceivedNum >= total ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(cashReceivedNum >= total ? change : total - cashReceivedNum)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-cash confirmation */}
          {paymentMethod !== 'cash' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Confirm {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label} payment of{' '}
                <strong>{formatCurrency(total)}</strong>
              </p>
            </div>
          )}

          {/* Customer Info */}
          {selectedCustomer?.name && (
            <div className="text-sm text-muted-foreground">
              Customer: <strong>{selectedCustomer.name}</strong>
              {selectedCustomer.phone && ` (${selectedCustomer.phone})`}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!canComplete || processing}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-testid="complete-sale-btn"
            >
              {processing ? (
                'Processing...'
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Complete Sale (Enter)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QuickCheckoutModal);
