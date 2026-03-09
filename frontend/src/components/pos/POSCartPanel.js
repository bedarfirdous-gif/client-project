// POS Cart Panel Component
import React from 'react';
import { ShoppingCart, Plus, Minus, Trash2, X, Clock, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { useCurrency } from '../../contexts/CurrencyContext';

export default function POSCartPanel({
  cart,
  updateQuantity,
  removeFromCart,
  clearCart,
  holdCurrentOrder,
  holdOrders,
  setShowHoldOrders,
  manualDiscount,
  setManualDiscount,
  discountType,
  setDiscountType,
  subtotal,
  gstAmount,
  totalDiscount,
  totalAmount,
  selectedGst,
  gstInclusive,
  openCheckout,
  formatCurrency
}) {
  const { currencySymbol } = useCurrency();
  
  return (
    <div className="w-full lg:w-80 xl:w-96 flex flex-col h-full bg-card rounded-xl border shadow-sm">
      {/* Cart Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <span className="font-semibold">Cart</span>
          <Badge variant="secondary" className="text-xs">{cart.length}</Badge>
        </div>
        <div className="flex gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setShowHoldOrders(true)} 
            className="relative"
            data-testid="hold-orders-btn"
          >
            <Clock className="w-4 h-4" />
            {holdOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] rounded-full bg-amber-500 text-white flex items-center justify-center">
                {holdOrders.length}
              </span>
            )}
          </Button>
          {cart.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearCart} data-testid="clear-cart-btn">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 opacity-30 mb-2" />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs">Add items to get started</p>
          </div>
        ) : (
          cart.map((item) => (
            <Card key={item.variant_id} className="p-0 overflow-hidden">
              <CardContent className="p-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.item_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.size && <span className="mr-1">{item.size}</span>}
                      {item.color && <span className="mr-1">/ {item.color}</span>}
                      {item.sku && <span className="font-mono">({item.sku})</span>}
                    </p>
                    <p className="text-xs mt-0.5">
                      <span className="font-mono">{currencySymbol}{item.rate.toLocaleString()}</span>
                      <span className="text-muted-foreground"> × {item.quantity}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">{currencySymbol}{(item.rate * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 w-7 p-0" 
                      onClick={() => updateQuantity(item.variant_id, -1)}
                      data-testid={`cart-minus-${item.variant_id}`}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 w-7 p-0" 
                      onClick={() => updateQuantity(item.variant_id, 1)}
                      data-testid={`cart-plus-${item.variant_id}`}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive" 
                    onClick={() => removeFromCart(item.variant_id)}
                    data-testid={`cart-remove-${item.variant_id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Discount Input */}
      {cart.length > 0 && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <Input
              type="number"
              placeholder="Discount"
              value={manualDiscount || ''}
              onChange={(e) => setManualDiscount(Number(e.target.value))}
              className="h-8 text-sm flex-1"
            />
            <select 
              value={discountType} 
              onChange={(e) => setDiscountType(e.target.value)}
              className="h-8 px-2 text-sm border rounded-md bg-background"
            >
              <option value="amount">{currencySymbol}</option>
              <option value="percent">%</option>
            </select>
          </div>
        </div>
      )}

      {/* Cart Summary */}
      <div className="border-t p-3 space-y-2 bg-muted/30">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-mono">{formatCurrency ? formatCurrency(subtotal) : `${currencySymbol}${subtotal.toLocaleString()}`}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount</span>
            <span className="font-mono">-{formatCurrency ? formatCurrency(totalDiscount) : `${currencySymbol}${totalDiscount.toLocaleString()}`}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>GST ({selectedGst}%){gstInclusive ? ' (incl.)' : ''}</span>
          <span className="font-mono">{formatCurrency ? formatCurrency(gstAmount) : `${currencySymbol}${gstAmount.toLocaleString()}`}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t">
          <span>Total</span>
          <span className="font-mono text-primary">{formatCurrency ? formatCurrency(totalAmount) : `${currencySymbol}${totalAmount.toLocaleString()}`}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-t flex gap-2">
        <Button 
          variant="outline" 
          onClick={holdCurrentOrder} 
          disabled={cart.length === 0}
          className="flex-1"
          data-testid="hold-btn"
        >
          <Clock className="w-4 h-4 mr-2" /> Hold
        </Button>
        <Button 
          onClick={openCheckout} 
          disabled={cart.length === 0}
          className="flex-1 text-lg font-semibold"
          data-testid="checkout-btn"
        >
          Pay {formatCurrency ? formatCurrency(totalAmount) : `${currencySymbol}${totalAmount.toLocaleString()}`}
        </Button>
      </div>
    </div>
  );
}
