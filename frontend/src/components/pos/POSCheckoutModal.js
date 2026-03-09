import React, { useState } from 'react';
import { CreditCard, Banknote, Smartphone, Building2, QrCode, Check, Printer, Download, MessageCircle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

// Payment methods configuration
const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
  { id: 'gpay', label: 'GPay', icon: Smartphone, color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  { id: 'jk_bank', label: 'JK Bank', icon: Building2, color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' },
  { id: 'hdfc_card', label: 'HDFC Card', icon: CreditCard, color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  { id: 'upi', label: 'UPI', icon: QrCode, color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
];

export default function POSCheckoutModal({
  isOpen,
  onClose,
  cart,
  selectedCustomer,
  voucherDiscount,
  formatCurrency,
  onCompleteSale,
  onPrintReceipt,
  onPrintThermal,
  onShareWhatsApp,
  processing
}) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [saleComplete, setSaleComplete] = useState(false);

  // FIX: Avoid `null` as the initial state for data used in conditional rendering.
  // A `null -> object` transition on open/complete can cause a brief render mismatch (flash).
  // Use a stable empty object for `lastSale` and gate rendering with an explicit loaded flag.
  const [lastSale, setLastSale] = useState({});
  const [isLastSaleLoaded, setIsLastSaleLoaded] = useState(false);

  // Only render receipt/actions when we *know* we've set lastSale for this lifecycle.
  const hasLastSale = isLastSaleLoaded;

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const itemDiscounts = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalDiscount = itemDiscounts + voucherDiscount;
  const taxAmount = cart.reduce((sum, item) => {
    const itemTotal = item.selling_price * item.quantity - (item.discount || 0);
    const gstRate = item.gst_rate || 0;
    return sum + (itemTotal * gstRate / 100);
  }, 0);
  const grandTotal = subtotal - totalDiscount + taxAmount;
  const change = parseFloat(amountReceived || 0) - grandTotal;

  const handleCompleteSale = async () => {
    const saleData = {
      paymentMethod,
      amountReceived: parseFloat(amountReceived) || grandTotal,
      change: Math.max(0, change)
    };
    
    const result = await onCompleteSale(saleData);
    if (result) {
      setLastSale(result);
      setSaleComplete(true);
    }
  };

  const handleClose = () => {
    setSaleComplete(false);
    setLastSale(null);
    setPaymentMethod('cash');
    setAmountReceived('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {saleComplete ? '✓ Sale Complete' : 'Checkout'}
          </DialogTitle>
        </DialogHeader>

        {!saleComplete ? (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-accent/50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Order Summary</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="truncate flex-1">
                      {item.name}
                      {item.variant_name && ` (${item.variant_name})`}
                      {' × '}{item.quantity}
                    </span>
                    <span className="font-medium ml-2">
                      {formatCurrency(item.selling_price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="border-t mt-3 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tax (GST)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            {selectedCustomer && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium">{selectedCustomer.name}</p>
                <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
              </div>
            )}

            {/* Payment Method Selection */}
            <div>
              <Label className="mb-3 block">Payment Method</Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PAYMENT_METHODS.map(method => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                        paymentMethod === method.id 
                          ? `${method.color} border-current ring-2 ring-offset-2 ring-current` 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{method.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Payment */}
            {paymentMethod === 'cash' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount Received</Label>
                  <Input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={grandTotal.toString()}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Change</Label>
                  <div className={`mt-1 p-2 rounded-lg text-center text-lg font-bold ${
                    change >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {formatCurrency(Math.max(0, change))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Amount Buttons */}
            {paymentMethod === 'cash' && (
              <div className="flex flex-wrap gap-2">
                {[100, 200, 500, 1000, 2000].map(amount => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmountReceived(amount.toString())}
                  >
                    {formatCurrency(amount)}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountReceived(Math.ceil(grandTotal).toString())}
                >
                  Exact
                </Button>
              </div>
            )}

            {/* Complete Sale Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleCompleteSale}
              disabled={processing || (paymentMethod === 'cash' && change < 0)}
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Complete Sale ({formatCurrency(grandTotal)})
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Sale Complete View */
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-green-600">Payment Successful!</h3>
              <p className="text-muted-foreground">
                Invoice #{lastSale?.invoice_number || 'N/A'}
              </p>
            </div>

            <div className="p-4 bg-accent/50 rounded-lg text-left">
              <div className="flex justify-between mb-2">
                <span>Amount Paid</span>
                <span className="font-bold">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Method</span>
                <span className="font-medium capitalize">{paymentMethod.replace('_', ' ')}</span>
              </div>
              {paymentMethod === 'cash' && change > 0 && (
                <div className="flex justify-between mt-2 pt-2 border-t">
                  <span>Change Given</span>
                  <span className="font-bold text-green-600">{formatCurrency(change)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onPrintReceipt}>
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
              <Button variant="outline" onClick={onPrintThermal}>
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
              <Button variant="outline" onClick={onShareWhatsApp} className="col-span-2">
                <MessageCircle className="w-4 h-4 mr-2" /> Share on WhatsApp
              </Button>
            </div>

            <Button className="w-full" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" /> Close & New Sale
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
