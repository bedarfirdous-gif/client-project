import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { 
  ShoppingCart, X, Trash2, Plus, Minus, CreditCard, 
  Loader2, Package, ArrowRight, CheckCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from './ui/sheet';
import { Separator } from './ui/separator';

export default function CartSidebar({ isOpen, onClose }) {
  const { api, user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [cart, setCart] = useState({ items: [], total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  
  // Customer details for checkout
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const fetchCart = async () => {
    try {
      const data = await api('/api/cart');
      setCart(data);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCart();
    }
  }, [isOpen]);

  // Listen for cart open event
  useEffect(() => {
    const handleOpenCart = () => {
      fetchCart();
    };
    window.addEventListener('open-cart', handleOpenCart);
    return () => window.removeEventListener('open-cart', handleOpenCart);
  }, []);

  const updateQuantity = async (cartItemId, delta) => {
    const item = cart.items.find(i => i.cart_item_id === cartItemId);
    if (!item) return;
    
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await removeItem(cartItemId);
      return;
    }
    
    // Update locally first for instant feedback
    setCart(prev => ({
      ...prev,
      items: prev.items.map(i => 
        i.cart_item_id === cartItemId 
          ? { ...i, quantity: newQty }
          : i
      ),
      total: prev.items.reduce((sum, i) => 
        sum + i.price * (i.cart_item_id === cartItemId ? newQty : i.quantity), 0
      ),
      count: prev.count + delta
    }));
    
    // Then sync with server
    try {
      await api('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({
          item_id: item.item_id,
          name: item.name,
          brand: item.brand,
          price: item.price,
          mrp: item.mrp,
          quantity: delta,
          image: item.image,
          size: item.size,
          color: item.color
        })
      });
    } catch (err) {
      fetchCart(); // Revert on error
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (cartItemId) => {
    try {
      await api(`/api/cart/item/${cartItemId}`, { method: 'DELETE' });
      setCart(prev => ({
        ...prev,
        items: prev.items.filter(i => i.cart_item_id !== cartItemId),
        total: prev.items.filter(i => i.cart_item_id !== cartItemId)
          .reduce((sum, i) => sum + i.price * i.quantity, 0),
        count: prev.items.filter(i => i.cart_item_id !== cartItemId)
          .reduce((sum, i) => sum + i.quantity, 0)
      }));
      toast.success('Item removed from cart');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      await api('/api/cart/clear', { method: 'DELETE' });
      setCart({ items: [], total: 0, count: 0 });
      toast.success('Cart cleared');
    } catch (err) {
      toast.error('Failed to clear cart');
    }
  };

  const handleCheckout = async () => {
    if (!customerDetails.name || !customerDetails.phone) {
      toast.error('Please fill in your name and phone number');
      return;
    }
    
    setCheckingOut(true);
    
    try {
      // Create order
      const order = await api('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          customer: customerDetails,
          items: cart.items,
          total: cart.total
        })
      });
      
      // Initialize Razorpay payment
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: cart.total * 100, // Convert to paise
        currency: 'INR',
        name: 'Your Store',
        description: `Order ${order.order_id}`,
        order_id: order.razorpay_order_id,
        handler: async function(response) {
          // Verify payment
          try {
            await api('/api/orders/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                order_id: order.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            
            toast.success('Payment successful! Order placed.');
            await clearCart();
            setShowCheckout(false);
            onClose();
          } catch (err) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone
        },
        theme: {
          color: '#8B5CF6'
        }
      };
      
      // Check if Razorpay is loaded
      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback: Direct order without payment gateway
        toast.success('Order placed successfully! Pay on delivery.');
        await clearCart();
        setShowCheckout(false);
        onClose();
      }
    } catch (err) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  const savings = cart.items.reduce((sum, item) => 
    sum + ((item.mrp - item.price) * item.quantity), 0
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Shopping Cart
            {cart.count > 0 && (
              <Badge className="ml-2">{cart.count} items</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Review your items and proceed to checkout
          </SheetDescription>
        </SheetHeader>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : cart.items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <ShoppingCart className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Your cart is empty</h3>
            <p className="text-sm text-muted-foreground mb-4">Add items from the catalogue to get started</p>
            <Button onClick={onClose}>
              Continue Shopping
            </Button>
          </div>
        ) : showCheckout ? (
          /* Checkout Form */
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Ready to checkout</span>
              </div>
              <p className="text-sm mt-1">Total: {currencySymbol}{cart.total.toLocaleString()}</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={customerDetails.name}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Delivery Address (Optional)</Label>
                <Input
                  id="address"
                  value={customerDetails.address}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter delivery address"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCheckout(false)} className="flex-1">
                Back to Cart
              </Button>
              <Button 
                onClick={handleCheckout} 
                disabled={checkingOut}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {checkingOut ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><CreditCard className="w-4 h-4 mr-2" /> Pay {currencySymbol}{cart.total.toLocaleString()}</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Cart Items */
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.items.map((item) => (
                <div 
                  key={item.cart_item_id}
                  className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  {/* Image */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                    {item.image ? (
                      <img loading="lazy" src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    {item.brand && (
                      <p className="text-xs text-blue-600 font-medium uppercase">{item.brand}</p>
                    )}
                    <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                    {(item.size || item.color) && (
                      <p className="text-xs text-muted-foreground">
                        {item.size && `Size: ${item.size}`}
                        {item.size && item.color && ' • '}
                        {item.color && `Color: ${item.color}`}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <p className="font-semibold">{currencySymbol}{item.price.toLocaleString()}</p>
                        {item.mrp > item.price && (
                          <p className="text-xs text-gray-400 line-through">{currencySymbol}{item.mrp.toLocaleString()}</p>
                        )}
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.cart_item_id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.cart_item_id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(item.cart_item_id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator />
            
            {/* Cart Summary */}
            <div className="space-y-3 py-4">
              {savings > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">You're saving</span>
                  <span className="text-emerald-600 font-medium">{currencySymbol}{savings.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="font-medium">Subtotal</span>
                <span className="font-bold text-lg">{currencySymbol}{cart.total.toLocaleString()}</span>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={clearCart}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Clear
                </Button>
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setShowCheckout(true)}
                >
                  Checkout <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Cart Icon Button for Header
export function CartButton({ onClick }) {
  const { api } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCartCount = async () => {
    try {
      const cart = await api('/api/cart');
      setCount(cart.count || 0);
    } catch (err) {
      console.error('Failed to fetch cart count');
    }
  };

  useEffect(() => {
    fetchCartCount();
    
    // Listen for cart updates
    const handleCartUpdate = () => fetchCartCount();
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('open-cart', handleCartUpdate);
    
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('open-cart', handleCartUpdate);
    };
  }, []);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={onClick}
      data-testid="cart-button"
    >
      <ShoppingCart className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  );
}
