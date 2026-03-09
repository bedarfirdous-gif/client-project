import React from 'react';
import { Plus, Minus, Trash2, ShoppingCart, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';

export default function POSCart({
  cart,
  setCart,
  selectedCustomer,
  onSelectCustomer,
  voucherCode,
  setVoucherCode,
  voucherDiscount,
  voucherApplied,
  onApplyVoucher,
  onRemoveVoucher,
  onCheckout,
  formatCurrency,
  customers = []
}) {
  const updateQuantity = (index, change) => {
    setCart(cart.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateDiscount = (index, value) => {
    const discount = parseFloat(value) || 0;
    setCart(cart.map((item, i) => i === index ? { ...item, discount } : item));
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.selling_price * item.quantity;
    return sum + itemTotal;
  }, 0);

  const itemDiscounts = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalDiscount = itemDiscounts + voucherDiscount;
  const taxAmount = cart.reduce((sum, item) => {
    const itemTotal = item.selling_price * item.quantity - (item.discount || 0);
    const gstRate = item.gst_rate || 0;
    return sum + (itemTotal * gstRate / 100);
  }, 0);
  const grandTotal = subtotal - totalDiscount + taxAmount;

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Cart</h3>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {cart.length} items
            </span>
          </div>
          {cart.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive"
              onClick={() => setCart([])}
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Customer Selection */}
        <div className="mb-3">
          <select
            className="w-full p-2 text-sm border rounded-lg bg-background"
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const customer = customers.find(c => c.id === e.target.value);
              onSelectCustomer(customer || null);
            }}
          >
            <option value="">Walk-in Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
            ))}
          </select>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Add items to start billing</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div 
                key={`${item.id}-${item.variant_id || 'base'}-${index}`}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm truncate">{item.name}</h4>
                    {item.variant_name && (
                      <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-accent rounded-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => updateQuantity(index, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => updateQuantity(index, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(item.selling_price * item.quantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @ {formatCurrency(item.selling_price)}
                    </p>
                  </div>
                </div>
                
                {/* Item Discount */}
                <div className="mt-2 flex items-center gap-2">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Discount"
                    value={item.discount || ''}
                    onChange={(e) => updateDiscount(index, e.target.value)}
                    className="h-7 text-xs flex-1"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Voucher Section */}
        {cart.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter voucher code"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                disabled={voucherApplied}
                className="flex-1"
              />
              {voucherApplied ? (
                <Button variant="outline" size="sm" onClick={onRemoveVoucher}>
                  Remove
                </Button>
              ) : (
                <Button size="sm" onClick={onApplyVoucher} disabled={!voucherCode}>
                  Apply
                </Button>
              )}
            </div>
            {voucherApplied && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Voucher applied: {formatCurrency(voucherDiscount)} discount
              </p>
            )}
          </div>
        )}

        {/* Totals */}
        {cart.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
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
                <span className="text-muted-foreground">Tax (GST)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        )}

        {/* Checkout Button */}
        <Button 
          className="w-full mt-4" 
          size="lg"
          disabled={cart.length === 0}
          onClick={onCheckout}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Checkout ({formatCurrency(grandTotal)})
        </Button>
      </CardContent>
    </Card>
  );
}
