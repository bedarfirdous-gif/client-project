import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ShoppingCart, Search, Filter, Heart, Star, Plus, Minus, X, Trash2,
  ChevronRight, Store, Truck, Shield, CreditCard, Package, Phone, Mail,
  ArrowLeft, Check, Loader2, Tag, MapPin, Clock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Custom hook for API calls without auth
const usePublicApi = () => {
  const fetchApi = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }
    return response.json();
  };
  return { fetchApi };
};

export default function StorefrontPage() {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchApi } = usePublicApi();
  
  // Store state
  // FIX: Avoid initializing to `null` to prevent a brief "no data" render before the fetch completes.
  // Use an explicit loaded flag instead, so UI rendering can key off stable state.
  const [storeInfo, setStoreInfo] = useState({});
  const [item, setItem] = useState(false);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  
  // Cart state
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  // FIX: Prefer a stable empty object over null to avoid conditional UI flicker.
  const [cartValidation, setCartValidation] = useState({});
  
  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_address: '',
    payment_method: 'stripe',
    notes: ''
  });
  
  // Product detail
  // FIX: Use a stable empty object instead of null to prevent flash in product detail conditionals.
  const [selectedProduct, setSelectedProduct] = useState({});
  const [showProductDetail, setShowProductDetail] = useState(false);

  // Load store info
  useEffect(() => {
    const loadStore = async () => {
      try {
        const info = await fetchApi(`/api/storefront/${tenantSlug}`);
        setStoreInfo(info);
        
        const [productsData, categoriesData] = await Promise.all([
          fetchApi(`/api/storefront/${tenantSlug}/products?limit=50`),
          fetchApi(`/api/storefront/${tenantSlug}/categories`)
        ]);
        
        setProducts(productsData.products || []);
        setCategories(categoriesData.categories || []);
      } catch (err) {
        toast.error(err.message || 'Store not found');
      } finally {
        setLoading(false);
      }
    };
    
    loadStore();
    
    // Load cart from localStorage
    const savedCart = localStorage.getItem(`cart_${tenantSlug}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [tenantSlug]);

  // Save cart to localStorage
  useEffect(() => {
    if (tenantSlug) {
      localStorage.setItem(`cart_${tenantSlug}`, JSON.stringify(cart));
    }
  }, [cart, tenantSlug]);

  // Fetch products with filters
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      let url = `/api/storefront/${tenantSlug}/products?sort_by=${sortBy}&limit=50`;
      if (selectedCategory !== 'all') url += `&category_id=${selectedCategory}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (priceRange.min) url += `&min_price=${priceRange.min}`;
      if (priceRange.max) url += `&max_price=${priceRange.max}`;
      
      const data = await fetchApi(url);
      setProducts(data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (storeInfo) {
      fetchProducts();
    }
  }, [selectedCategory, sortBy, search]);

  // Cart functions
  const addToCart = (product, variant = null) => {
    const existingIndex = cart.findIndex(
      item => item.item_id === product.id && item.variant_id === (variant?.id || null)
    );
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, {
        item_id: product.id,
        variant_id: variant?.id || null,
        name: product.name,
        variant_name: variant?.name,
        price: variant?.price || product.selling_price,
        image: product.image || product.images?.[0],
        quantity: 1
      }]);
    }
    
    toast.success('Added to cart!');
  };

  const updateCartQuantity = (index, quantity) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    const newCart = [...cart];
    newCart[index].quantity = quantity;
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Validate cart before checkout
  const validateCart = async () => {
    try {
      const validation = await fetchApi(`/api/storefront/${tenantSlug}/cart/validate`, {
        method: 'POST',
        body: JSON.stringify(cart.map(item => ({
          item_id: item.item_id,
          variant_id: item.variant_id,
          quantity: item.quantity
        })))
      });
      setCartValidation(validation);
      return validation;
    } catch (err) {
      toast.error('Failed to validate cart');
      return null;
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    // Validate form
    if (!checkoutForm.customer_name || !checkoutForm.customer_email || !checkoutForm.shipping_address) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setCheckoutLoading(true);
    try {
      const response = await fetchApi(`/api/storefront/${tenantSlug}/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          cart_items: cart.map(item => ({
            item_id: item.item_id,
            variant_id: item.variant_id,
            quantity: item.quantity
          })),
          ...checkoutForm
        })
      });
      
      if (response.payment_url) {
        // Redirect to Stripe
        window.location.href = response.payment_url;
      } else {
        // COD order placed
        toast.success('Order placed successfully!');
        setCart([]);
        setShowCheckout(false);
        navigate(`/store/${tenantSlug}/order-success?order_id=${response.order_id}`);
      }
    } catch (err) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Format currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading store...</p>
        </div>
      </div>
    );
  }

  if (!storeInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">Store Not Found</h1>
          <p className="text-gray-500 mt-2">This store doesn't exist or is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="storefront-page">
      {/* Header */}
      <header 
        className="sticky top-0 z-40 bg-white shadow-sm"
        style={{ borderBottom: `3px solid ${storeInfo.theme_color}` }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo/Store Name */}
            <div className="flex items-center gap-3">
              {storeInfo.logo ? (
                <img loading="lazy" src={storeInfo.logo} alt={storeInfo.store_name} className="h-10 w-auto" />
              ) : (
                <Store className="w-8 h-8" style={{ color: storeInfo.theme_color }} />
              )}
              <span className="font-bold text-xl">{storeInfo.store_name}</span>
            </div>
            
            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-gray-50"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            {/* Cart Button */}
            <Button
              variant="outline"
              className="relative"
              onClick={() => setShowCart(true)}
              data-testid="cart-button"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
                  style={{ backgroundColor: storeInfo.theme_color }}
                >
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
          
          {/* Mobile Search */}
          <div className="md:hidden mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-gray-50"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Banner */}
      {storeInfo.banner_image && (
        <div className="w-full h-48 md:h-64 bg-gray-200 overflow-hidden">
          <img loading="lazy" 
            src={storeInfo.banner_image} 
            alt="Store Banner" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 shrink-0">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </h3>
                
                {/* Categories */}
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-2 block">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="category-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name} ({cat.product_count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Sort */}
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-2 block">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger data-testid="sort-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Price Range */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Price Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                      className="text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={fetchProducts}
                  >
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Store Info */}
            <Card className="mt-4">
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Truck className="w-4 h-4" />
                  <span>
                    {storeInfo.free_delivery_above > 0 
                      ? `Free delivery above ${formatPrice(storeInfo.free_delivery_above)}`
                      : `Delivery: ${formatPrice(storeInfo.delivery_charge)}`}
                  </span>
                </div>
                {storeInfo.accepts_cod && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <CreditCard className="w-4 h-4" />
                    <span>Cash on Delivery available</span>
                  </div>
                )}
                {storeInfo.contact_phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{storeInfo.contact_phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600">
                Showing {products.length} products
              </p>
            </div>
            
            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(product => (
                  <Card 
                    key={product.id} 
                    className="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => { setSelectedProduct(product); setShowProductDetail(true); }}
                    data-testid={`product-card-${product.id}`}
                  >
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                      {product.image || product.images?.[0] ? (
                        <img loading="lazy"
                          src={product.image || product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                      {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                        <Badge className="absolute top-2 left-2 bg-amber-500">
                          Only {product.stock_quantity} left
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ color: storeInfo.theme_color }}>
                          {formatPrice(product.selling_price)}
                        </span>
                        {product.mrp && product.mrp > product.selling_price && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatPrice(product.mrp)}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-2 text-xs"
                        style={{ backgroundColor: storeInfo.theme_color }}
                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                        data-testid={`add-to-cart-${product.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add to Cart
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="font-bold mb-3">{storeInfo.store_name}</h4>
              <p className="text-gray-400 text-sm">{storeInfo.description}</p>
            </div>
            <div>
              <h4 className="font-bold mb-3">Contact</h4>
              <div className="space-y-2 text-sm text-gray-400">
                {storeInfo.contact_email && (
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {storeInfo.contact_email}
                  </p>
                )}
                {storeInfo.contact_phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {storeInfo.contact_phone}
                  </p>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3">Policies</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <p>Shipping Policy</p>
                <p>Return Policy</p>
                <p>Privacy Policy</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-4 text-center text-sm text-gray-500">
            {storeInfo?.name || 'Welcome to Our Store'}
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Cart ({cartCount} items)
            </DialogTitle>
          </DialogHeader>
          
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                {cart.map((item, index) => (
                  <div key={`${item.item_id}-${item.variant_id || 'default'}`} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    {item.image ? (
                      <img loading="lazy" src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.name}</h4>
                      {item.variant_name && (
                        <p className="text-xs text-gray-500">{item.variant_name}</p>
                      )}
                      <p className="font-semibold text-sm mt-1">{formatPrice(item.price)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => updateCartQuantity(index, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => updateCartQuantity(index, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 ml-auto text-red-500"
                          onClick={() => removeFromCart(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatPrice(cartTotal)}</span>
                </div>
                {storeInfo.free_delivery_above > 0 && cartTotal < storeInfo.free_delivery_above && (
                  <p className="text-xs text-amber-600 mb-2">
                    Add {formatPrice(storeInfo.free_delivery_above - cartTotal)} more for free delivery!
                  </p>
                )}
                <Button 
                  className="w-full"
                  style={{ backgroundColor: storeInfo.theme_color }}
                  onClick={() => { validateCart(); setShowCart(false); setShowCheckout(true); }}
                  data-testid="proceed-to-checkout"
                >
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Checkout
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Customer Details */}
            <div>
              <Label>Full Name *</Label>
              <Input
                value={checkoutForm.customer_name}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_name: e.target.value })}
                placeholder="Enter your name"
                data-testid="checkout-name"
              />
            </div>
            
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={checkoutForm.customer_email}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_email: e.target.value })}
                placeholder="your@email.com"
                data-testid="checkout-email"
              />
            </div>
            
            <div>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={checkoutForm.customer_phone}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_phone: e.target.value })}
                placeholder="Phone number"
                data-testid="checkout-phone"
              />
            </div>
            
            <div>
              <Label>Shipping Address *</Label>
              <Input
                value={checkoutForm.shipping_address}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, shipping_address: e.target.value })}
                placeholder="Full delivery address"
                data-testid="checkout-address"
              />
            </div>
            
            {/* Payment Method */}
            <div>
              <Label>Payment Method</Label>
              <Select 
                value={checkoutForm.payment_method} 
                onValueChange={(v) => setCheckoutForm({ ...checkoutForm, payment_method: v })}
              >
                <SelectTrigger data-testid="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Pay Online (Card/UPI)</SelectItem>
                  {storeInfo.accepts_cod && (
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Order Summary */}
            {cartValidation && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="font-semibold">Order Summary</h4>
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartValidation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery</span>
                  <span>{cartValidation.delivery_charge > 0 ? formatPrice(cartValidation.delivery_charge) : 'FREE'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (GST)</span>
                  <span>{formatPrice(cartValidation.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span>
                  <span style={{ color: storeInfo.theme_color }}>{formatPrice(cartValidation.total)}</span>
                </div>
              </div>
            )}
            
            <Button
              className="w-full"
              style={{ backgroundColor: storeInfo.theme_color }}
              onClick={handleCheckout}
              disabled={checkoutLoading}
              data-testid="place-order-btn"
            >
              {checkoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : checkoutForm.payment_method === 'cod' ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              {checkoutForm.payment_method === 'cod' ? 'Place Order' : 'Pay Now'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Modal */}
      <Dialog open={showProductDetail} onOpenChange={setShowProductDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {selectedProduct.image || selectedProduct.images?.[0] ? (
                  <img loading="lazy"
                    src={selectedProduct.image || selectedProduct.images[0]}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-gray-300" />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">{selectedProduct.name}</h2>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-bold" style={{ color: storeInfo.theme_color }}>
                    {formatPrice(selectedProduct.selling_price)}
                  </span>
                  {selectedProduct.mrp && selectedProduct.mrp > selectedProduct.selling_price && (
                    <>
                      <span className="text-gray-400 line-through">{formatPrice(selectedProduct.mrp)}</span>
                      <Badge className="bg-green-500">
                        {Math.round((1 - selectedProduct.selling_price / selectedProduct.mrp) * 100)}% OFF
                      </Badge>
                    </>
                  )}
                </div>
                
                {selectedProduct.description && (
                  <p className="text-gray-600 text-sm mb-4">{selectedProduct.description}</p>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <Package className="w-4 h-4" />
                  <span>{selectedProduct.stock_quantity > 0 ? `${selectedProduct.stock_quantity} in stock` : 'Out of stock'}</span>
                </div>
                
                {/* Variants */}
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div className="mb-4">
                    <Label className="mb-2 block">Select Variant</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.variants.map(variant => (
                        <Button
                          key={variant.id}
                          variant="outline"
                          size="sm"
                          onClick={() => addToCart(selectedProduct, variant)}
                        >
                          {variant.name} - {formatPrice(variant.price)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button
                  className="w-full"
                  style={{ backgroundColor: storeInfo.theme_color }}
                  onClick={() => { addToCart(selectedProduct); setShowProductDetail(false); }}
                  disabled={selectedProduct.stock_quantity <= 0}
                  data-testid="add-to-cart-detail"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
