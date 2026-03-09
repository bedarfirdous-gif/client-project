import React from 'react';
import { ShoppingCart, Plus, Minus, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const CartSection = ({
  cart,
  updateQuantity,
  removeFromCart,
  updateItemRate,
  updateItemDiscount,
  formatCurrency,
  subtotal,
  taxAmount,
  total,
  onCheckout,
  onClearCart,
  gstInclusive,
  selectedGst
}) => {
  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-8">
        <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Cart is empty</p>
        <p className="text-sm">Add items to start billing</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="cart-section">
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {cart.map((item, idx) => (
          <div
            key={item.variant_id}
            className="bg-white dark:bg-gray-800 rounded-lg border p-3 space-y-2"
            data-testid={`cart-item-${idx}`}
          >
            {/* Item Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.item_name}</p>
                {(item.size || item.color) && (
                  <p className="text-xs text-muted-foreground">
                    {[item.size, item.color].filter(Boolean).join(' / ')}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFromCart(item.variant_id)}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Quantity & Price */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateQuantity(item.variant_id, -1)}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-8 text-center font-medium text-sm">
                  {item.quantity}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateQuantity(item.variant_id, 1)}
                  className="h-8 w-8 p-0"
                  disabled={item.quantity >= item.max_stock}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              
              <span className="text-xs text-muted-foreground">×</span>
              
              <Input
                type="number"
                value={item.rate}
                onChange={(e) => updateItemRate(item.variant_id, parseFloat(e.target.value) || 0)}
                className="w-20 h-8 text-sm text-right"
                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
              />
              
              <span className="ml-auto font-medium text-sm">
                {formatCurrency(item.rate * item.quantity)}
              </span>
            </div>

            {/* Item Discount (optional) */}
            {item.item_discount > 0 && (
              <div className="flex items-center justify-between text-xs text-green-600">
                <span>Item Discount</span>
                <span>-{formatCurrency(item.item_discount * item.quantity)}</span>
              </div>
            )}

            {/* Stock Warning */}
            {item.max_stock <= 3 && (
              <p className="text-xs text-amber-600">
                Only {item.max_stock} left in stock
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className="border-t pt-3 mt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal ({cart.length} items)</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        
        {taxAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              GST {gstInclusive ? '(Included)' : `(${selectedGst}%)`}
            </span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
        )}
        
        <div className="flex justify-between font-bold text-lg pt-2 border-t">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClearCart}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={onCheckout}
            data-testid="checkout-btn"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CartSection);
