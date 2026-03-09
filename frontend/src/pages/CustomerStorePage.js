import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, ChevronLeft, Search, Filter, Heart, Star, Truck, Shield, RotateCcw, MessageCircle, CheckCircle, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to format phone number for WhatsApp
const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  // Remove all non-numeric characters except + at the start
  let cleaned = phone.replace(/[^\d+]/g, '');
  // If starts with +, keep it, otherwise add country code
  if (!cleaned.startsWith('+')) {
    // If it's a 10-digit Indian number, add +91
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    }
  }
  // Remove the + for WhatsApp URL (wa.me expects number without +)
  return cleaned.replace(/^\+/, '');
};

export default function CustomerStorePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [storeInfo, setStoreInfo] = useState(null);
  
  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    paymentMethod: 'cod',
    notes: ''
  });

  // Get tenant from URL or default
  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('tenant') || urlParams.get('store') || urlParams.get('t') || 'superadmin';
  const storePhone = storeInfo?.whatsapp_number || storeInfo?.phone || '+917006775959';
  const storeName = storeInfo?.business_name || 'Our Store';

  // Fetch store info for WhatsApp
  useEffect(() => {
    const fetchStoreInfo = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/store-info?tenant=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setStoreInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch store info:', err);
      }
    };
    fetchStoreInfo();
  }, [tenantId]);

  // Fetch products from public API
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/store/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        
        // Extract unique categories
        const cats = [...new Set(data.products?.map(p => p.category).filter(Boolean))];
        setCategories(cats);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique sizes and colors for a product
  const getAvailableSizes = (product) => {
    if (!product?.variants) return [];
    return [...new Set(product.variants.map(v => v.size).filter(Boolean))];
  };

  const getAvailableColors = (product) => {
    if (!product?.variants) return [];
    return [...new Set(product.variants.map(v => v.color).filter(Boolean))];
  };

  // Find variant by size and color
  const findVariant = (product, size, color) => {
    return product?.variants?.find(v => v.size === size && v.color === color);
  };

  // Add to cart
  const addToCart = () => {
    if (!selectedProduct || !selectedVariant) {
      toast.error('Please select size and color');
      return;
    }

    if (selectedVariant.current_stock < quantity) {
      toast.error('Not enough stock available');
      return;
    }

    const existingIndex = cart.findIndex(item => item.variant_id === selectedVariant.id);
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += quantity;
      setCart(newCart);
    } else {
      setCart([...cart, {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        variant_id: selectedVariant.id,
        size: selectedVariant.size,
        color: selectedVariant.color,
        price: selectedVariant.selling_price || selectedVariant.mrp,
        quantity: quantity,
        image: selectedProduct.images?.[0]
      }]);
    }

    toast.success(`Added ${quantity} ${selectedProduct.name} (${selectedVariant.size}) to cart`);
    setSelectedProduct(null);
    setSelectedVariant(null);
    setQuantity(1);
  };

  // Remove from cart
  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Calculate cart total
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const taxAmount = cartTotal * 0.18;
  const orderTotal = cartTotal + taxAmount;

  // Handle checkout submission
  const handleCheckout = async () => {
    if (!checkoutForm.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!checkoutForm.phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setCheckoutLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/public/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          customer_name: checkoutForm.name,
          customer_phone: checkoutForm.phone,
          customer_email: checkoutForm.email,
          shipping_address: checkoutForm.address,
          payment_method: checkoutForm.paymentMethod,
          notes: checkoutForm.notes,
          items: cart.map(item => ({
            item_id: item.item_id,
            variant_id: item.variant_id,
            name: item.product_name,
            size: item.size,
            color: item.color,
            price: item.price,
            quantity: item.quantity
          }))
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setOrderConfirmed(data.order);
        setCart([]);
        toast.success('Order placed successfully!');
      } else {
        throw new Error(data.detail || 'Failed to place order');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Reset checkout state
  const resetCheckout = () => {
    setShowCheckout(false);
    setOrderConfirmed(null);
    setCheckoutForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      paymentMethod: 'cod',
      notes: ''
    });
  };

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  // Reset size/color when product changes
  useEffect(() => {
    if (selectedProduct) {
      const sizes = getAvailableSizes(selectedProduct);
      const colors = getAvailableColors(selectedProduct);
      setSelectedSize(sizes[0] || '');
      setSelectedColor(colors[0] || '');
    }
  }, [selectedProduct]);

  // Update variant when size/color changes
  useEffect(() => {
    if (selectedProduct && selectedSize && selectedColor) {
      const variant = findVariant(selectedProduct, selectedSize, selectedColor);
      setSelectedVariant(variant);
    }
  }, [selectedProduct, selectedSize, selectedColor]);

  // Product Card Component
  const ProductCard = ({ product }) => {
    const hasStock = product.current_stock > 0;
    const price = product.variants?.[0]?.selling_price || product.variants?.[0]?.mrp || product.mrp || 0;
    
    return (
      <div 
        className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer border border-gray-100"
        onClick={() => {
          setSelectedProduct(product);
          setSelectedVariant(null);
          setQuantity(1);
        }}
        data-testid={`product-card-${product.id}`}
      >
        {/* Image */}
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          {product.images?.[0] ? (
            <img loading="lazy" 
              src={product.images[0].startsWith('/api') ? `${API_URL}${product.images[0]}` : product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ShoppingCart className="w-16 h-16" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {!hasStock && (
              <Badge className="bg-red-500 text-white">Out of Stock</Badge>
            )}
            {product.discount > 0 && (
              <Badge className="bg-green-500 text-white">{product.discount}% OFF</Badge>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100">
              <Heart className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Details */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
          <p className="text-sm text-gray-500 mt-1 truncate">{product.category || 'General'}</p>
          
          {/* Sizes Preview */}
          {product.variants?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {getAvailableSizes(product).slice(0, 4).map(size => (
                <span key={size} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                  {size}
                </span>
              ))}
              {getAvailableSizes(product).length > 4 && (
                <span className="text-xs px-2 py-1 text-gray-400">+{getAvailableSizes(product).length - 4}</span>
              )}
            </div>
          )}
          
          {/* Price */}
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-xl font-bold text-gray-900">₹{price.toLocaleString()}</span>
              {product.mrp > price && (
                <span className="text-sm text-gray-400 line-through ml-2">₹{product.mrp.toLocaleString()}</span>
              )}
            </div>
            {hasStock && (
              <span className="text-xs text-green-600 font-medium">{product.current_stock} in stock</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Product Detail Modal
  const ProductDetailModal = () => {
    if (!selectedProduct) return null;

    const sizes = getAvailableSizes(selectedProduct);
    const colors = getAvailableColors(selectedProduct);

    const currentVariant = findVariant(selectedProduct, selectedSize, selectedColor);
    const price = currentVariant?.selling_price || currentVariant?.mrp || selectedProduct.mrp || 0;
    const stock = currentVariant?.current_stock || 0;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
        <div 
          className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="grid md:grid-cols-2">
            {/* Image Section */}
            <div className="relative bg-gray-50 aspect-square md:aspect-auto">
              {selectedProduct.images?.[0] ? (
                <img loading="lazy" 
                  src={selectedProduct.images[0].startsWith('/api') ? `${API_URL}${selectedProduct.images[0]}` : selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 min-h-[300px]">
                  <ShoppingCart className="w-24 h-24" />
                </div>
              )}
              
              <button 
                className="absolute top-4 left-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                onClick={() => setSelectedProduct(null)}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            {/* Details Section */}
            <div className="p-6 md:p-8 overflow-y-auto max-h-[50vh] md:max-h-[90vh]">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="outline" className="mb-2">{selectedProduct.category || 'General'}</Badge>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                </div>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full"
                  onClick={() => setSelectedProduct(null)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {selectedProduct.description && (
                <p className="text-gray-600 mt-3">{selectedProduct.description}</p>
              )}
              
              {/* Price */}
              <div className="mt-6">
                <span className="text-3xl font-bold text-gray-900">₹{price.toLocaleString()}</span>
                {selectedProduct.mrp > price && (
                  <span className="text-lg text-gray-400 line-through ml-3">₹{selectedProduct.mrp.toLocaleString()}</span>
                )}
              </div>
              
              {/* Size Selection */}
              {sizes.length > 0 && (
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Select Size</label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map(size => {
                      const variant = findVariant(selectedProduct, size, selectedColor);
                      const hasStock = variant?.current_stock > 0;
                      return (
                        <button
                          key={size}
                          className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                            selectedSize === size 
                              ? 'border-blue-600 bg-blue-50 text-blue-600' 
                              : hasStock
                                ? 'border-gray-200 hover:border-gray-300 text-gray-700'
                                : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          }`}
                          onClick={() => hasStock && setSelectedSize(size)}
                          disabled={!hasStock}
                          data-testid={`size-${size}`}
                        >
                          {size}
                          {!hasStock && <span className="text-xs ml-1">(Out)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Color Selection */}
              {colors.length > 0 && (
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Select Color</label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map(color => {
                      const variant = findVariant(selectedProduct, selectedSize, color);
                      const hasStock = variant?.current_stock > 0;
                      return (
                        <button
                          key={color}
                          className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                            selectedColor === color 
                              ? 'border-blue-600 bg-blue-50 text-blue-600' 
                              : hasStock
                                ? 'border-gray-200 hover:border-gray-300 text-gray-700'
                                : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          }`}
                          onClick={() => hasStock && setSelectedColor(color)}
                          disabled={!hasStock}
                          data-testid={`color-${color}`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Stock Info */}
              <div className="mt-4">
                {stock > 0 ? (
                  <span className="text-green-600 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    {stock} items in stock
                  </span>
                ) : (
                  <span className="text-red-500 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Out of stock
                  </span>
                )}
              </div>
              
              {/* Quantity & Add to Cart */}
              <div className="mt-6 flex items-center gap-4">
                <div className="flex items-center border rounded-lg">
                  <button 
                    className="p-3 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 font-semibold">{quantity}</span>
                  <button 
                    className="p-3 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    disabled={quantity >= stock}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <Button 
                  className="flex-1 h-12 text-lg font-semibold"
                  onClick={() => {
                    setSelectedVariant(currentVariant);
                    addToCart();
                  }}
                  disabled={stock === 0}
                  data-testid="add-to-cart-btn"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
              </div>
              
              {/* Features */}
              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t">
                <div className="text-center">
                  <Truck className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                  <span className="text-xs text-gray-600">Free Delivery</span>
                </div>
                <div className="text-center">
                  <Shield className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                  <span className="text-xs text-gray-600">Genuine Product</span>
                </div>
                <div className="text-center">
                  <RotateCcw className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                  <span className="text-xs text-gray-600">Easy Returns</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Cart Sidebar
  const CartSidebar = () => (
    <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform ${showCart ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Shopping Cart ({cartItemCount})</h2>
          <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item, index) => (
                <div key={index} className="flex gap-4 p-3 bg-gray-50 rounded-xl">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img loading="lazy" 
                        src={item.image.startsWith('/api') ? `${API_URL}${item.image}` : item.image}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ShoppingCart className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{item.product_name}</h4>
                    <p className="text-sm text-gray-500">{item.size} • {item.color}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold">₹{(item.price * item.quantity).toLocaleString()}</span>
                      <span className="text-sm text-gray-500">Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFromCart(index)}
                    className="p-1 hover:bg-gray-200 rounded-full self-start"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-4">
            <div className="flex justify-between text-lg">
              <span className="font-semibold">Total</span>
              <span className="font-bold">₹{cartTotal.toLocaleString()}</span>
            </div>
            <Button 
              className="w-full h-12 text-lg font-semibold" 
              data-testid="checkout-btn"
              onClick={() => { setShowCart(false); setShowCheckout(true); }}
            >
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Checkout Modal
  const CheckoutModal = () => (
    <div className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 ${showCheckout ? 'block' : 'hidden'}`}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {orderConfirmed ? (
          // Order Confirmation
          <div className="p-6 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
            <p className="text-gray-600 mb-4">Thank you for your order</p>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Order Number</span>
                <span className="font-bold">{orderConfirmed.order_number}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-bold">₹{orderConfirmed.total?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium capitalize">{orderConfirmed.payment_method === 'cod' ? 'Cash on Delivery' : orderConfirmed.payment_method}</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              We'll contact you shortly to confirm your order. You can also reach us on WhatsApp for any queries.
            </p>
            
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={resetCheckout}>
                Continue Shopping
              </Button>
              <a 
                href={`https://wa.me/${formatPhoneForWhatsApp(storePhone)}?text=${encodeURIComponent(`Hi! I just placed order ${orderConfirmed.order_number}. Please confirm.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </Button>
              </a>
            </div>
          </div>
        ) : (
          // Checkout Form
          <>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">Checkout</h2>
              <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-gray-600">{item.product_name} ({item.size}) x{item.quantity}</span>
                      <span>₹{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>₹{cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">CGST (9%)</span>
                      <span>₹{(taxAmount / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SGST (9%)</span>
                      <span>₹{(taxAmount / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg mt-2">
                      <span>Total</span>
                      <span>₹{orderTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Customer Details */}
              <div>
                <h3 className="font-semibold mb-3">Your Details</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Full Name *"
                    value={checkoutForm.name}
                    onChange={(e) => setCheckoutForm({...checkoutForm, name: e.target.value})}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    data-testid="checkout-name"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={checkoutForm.phone}
                    onChange={(e) => setCheckoutForm({...checkoutForm, phone: e.target.value})}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    data-testid="checkout-phone"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={checkoutForm.email}
                    onChange={(e) => setCheckoutForm({...checkoutForm, email: e.target.value})}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    data-testid="checkout-email"
                  />
                  <textarea
                    placeholder="Delivery Address"
                    value={checkoutForm.address}
                    onChange={(e) => setCheckoutForm({...checkoutForm, address: e.target.value})}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={2}
                    data-testid="checkout-address"
                  />
                </div>
              </div>
              
              {/* Payment Method */}
              <div>
                <h3 className="font-semibold mb-3">Payment Method</h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutForm({...checkoutForm, paymentMethod: 'cod'})}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      checkoutForm.paymentMethod === 'cod'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid="payment-cod"
                  >
                    <Banknote className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-xs font-medium">Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutForm({...checkoutForm, paymentMethod: 'upi'})}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      checkoutForm.paymentMethod === 'upi'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid="payment-upi"
                  >
                    <Smartphone className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-xs font-medium">UPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutForm({...checkoutForm, paymentMethod: 'online'})}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      checkoutForm.paymentMethod === 'online'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid="payment-online"
                  >
                    <CreditCard className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-xs font-medium">Card</span>
                  </button>
                </div>
              </div>
              
              {/* Notes */}
              <textarea
                placeholder="Order notes (optional)"
                value={checkoutForm.notes}
                onChange={(e) => setCheckoutForm({...checkoutForm, notes: e.target.value})}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={2}
                data-testid="checkout-notes"
              />
            </div>
            
            {/* Submit Button */}
            <div className="p-4 border-t">
              <Button 
                className="w-full h-12 text-lg font-semibold"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                data-testid="place-order-btn"
              >
                {checkoutLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  `Place Order • ₹${orderTotal.toLocaleString()}`
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 bg-white shadow-sm z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <h1 className="text-2xl font-bold text-gray-900">Store</h1>
            
            {/* Search */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            {/* Cart Button */}
            <button 
              className="relative p-3 hover:bg-gray-100 rounded-full"
              onClick={() => setShowCart(true)}
              data-testid="cart-button"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
          
          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              <button
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setSelectedCategory('all')}
              >
                All Products
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-20 h-20 mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Products Found</h2>
            <p className="text-gray-500">Try adjusting your search or filter</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">{filteredProducts.length} products found</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </main>
      
      {/* Product Detail Modal */}
      <ProductDetailModal />
      
      {/* Cart Sidebar */}
      <CartSidebar />
      
      {/* Cart Overlay */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowCart(false)} />
      )}

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-6 right-6 z-50" data-testid="whatsapp-float-container">
        <div className="relative group">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-sm py-2 px-3 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {cart.length > 0 ? `Order ${cart.reduce((sum, i) => sum + i.quantity, 0)} items via WhatsApp` : 'Chat with us on WhatsApp'}
            <div className="absolute left-full top-1/2 -translate-y-1/2 border-8 border-transparent border-l-gray-800" />
          </div>
          
          <button
            onClick={() => {
              const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
              let message = '';
              
              if (cartCount > 0) {
                // Build order message
                const orderLines = cart.map(item => 
                  `• ${item.name}${item.variant_name ? ` (${item.variant_name})` : ''} x ${item.quantity} = ₹${((item.price || 0) * item.quantity).toLocaleString()}`
                ).join('\n');
                const total = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
                
                message = `🛒 *New Order from ${storeName}*\n\n${orderLines}\n\n💰 *Total: ₹${total.toLocaleString()}*\n\nPlease confirm availability and delivery.`;
              } else {
                message = `Hi! I'm browsing your store at ${storeName}. I have a question.`;
              }
              
              const formattedPhone = formatPhoneForWhatsApp(storePhone);
              const whatsappUrl = formattedPhone 
                ? `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
                : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
              window.open(whatsappUrl, '_blank');
            }}
            className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
            data-testid="whatsapp-float-btn"
            aria-label="Chat on WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            
            {/* Cart count badge */}
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
          
          {/* Pulse animation ring */}
          <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25" />
        </div>
      </div>
      
      {/* Checkout Modal */}
      <CheckoutModal />
    </div>
  );
}
