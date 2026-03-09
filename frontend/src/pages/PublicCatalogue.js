import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Package, ShoppingCart, Eye, Search, X, Loader2, 
  Share2, Copy, QrCode, ExternalLink, Check, Phone, MessageCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';

import { useCurrency } from '../contexts/CurrencyContext';
const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PublicCatalogue() {
  const { formatWithConversion } = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Initialize with a stable empty object instead of null to prevent transient null-based rendering flashes
  // when opening/closing the item modal.
  const [selectedItem, setSelectedItem] = useState({});
  const [showItemModal, setShowItemModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null); // Store info with phone/whatsapp

  // Derived flag ensures we only consider an item "selected" when it has an id
  const hasSelectedItem = !!selectedItem?.id;
  
  // Get tenant from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('store') || urlParams.get('t') || urlParams.get('tenant');
  const storeName = urlParams.get('name') || storeInfo?.business_name || 'My Store';
  // Default WhatsApp number if not set in store info
  const DEFAULT_WHATSAPP = '+917006775959';
  const storePhone = storeInfo?.whatsapp_number || storeInfo?.phone || urlParams.get('phone') || DEFAULT_WHATSAPP;

  useEffect(() => {
    fetchPublicItems();
    if (tenantId) {
      fetchStoreInfo();
    }
  }, [tenantId]);

  const fetchPublicItems = async () => {
    try {
      const response = await fetch(`${API_URL}/api/public/catalogue${tenantId ? `?tenant=${tenantId}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch catalogue');
      const data = await response.json();
      setItems(data.items || []);
      // Store info might be included in catalogue response
      if (data.store) {
        setStoreInfo(data.store);
      }
    } catch (err) {
      console.error('Failed to fetch catalogue:', err);
      toast.error('Failed to load catalogue');
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/public/store-info?tenant=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setStoreInfo(data);
      }
    } catch (err) {
      console.warn('Could not fetch store info:', err);
    }
  };

  const filteredItems = items.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = i.quantity + delta;
        return newQty > 0 ? { ...i, quantity: newQty } : i;
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Format phone number for WhatsApp (remove spaces, dashes, etc.)
  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
  };

  const handleWhatsAppOrder = () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    const orderText = cart.map(item => 
      `• ${item.name} x${item.quantity} - ${formatWithConversion(item.selling_price * item.quantity)}`
    ).join('\n');
    
    const message = `🛒 *New Order from ${storeName}*\n\n${orderText}\n\n💰 *Total: ${formatWithConversion(cartTotal)}*\n\n📱 Please confirm my order and share payment details.`;
    
    const formattedPhone = formatPhoneForWhatsApp(storePhone);
    const whatsappUrl = formattedPhone 
      ? `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    toast.success('Opening WhatsApp...');
  };

  // Share single item via WhatsApp
  const handleShareItemWhatsApp = (item) => {
    const message = `Check out this product from ${storeName}!\n\n*${item.name}*\nPrice: ${formatWithConversion(item.selling_price)}\n${item.description || ''}\n\n${window.location.href}`;
    
    const formattedPhone = formatPhoneForWhatsApp(storePhone);
    const whatsappUrl = formattedPhone 
      ? `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading catalogue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{storeName}</h1>
              <p className="text-sm text-gray-500">{items.length} Products</p>
            </div>
            <Button 
              variant="outline" 
              className="relative"
              onClick={() => setShowCart(true)}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
          
          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 rounded-xl"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Product Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map((item) => (
              <div 
                key={item.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Image */}
                <div 
                  className="aspect-square bg-gray-100 relative cursor-pointer"
                  onClick={() => { setSelectedItem(item); setShowItemModal(true); }}
                >
                  {item.images?.[0] ? (
                    <img loading="lazy" src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {item.mrp > item.selling_price && (
                    <Badge className="absolute top-2 left-2 bg-red-500">
                      {Math.round((1 - item.selling_price / item.mrp) * 100)}% OFF
                    </Badge>
                  )}
                </div>
                
                {/* Info */}
                <div className="p-3">
                  {item.brand && (
                    <p className="text-xs text-blue-600 font-medium uppercase">{item.brand}</p>
                  )}
                  <h3 className="font-medium text-sm line-clamp-2 mt-1">{item.name}</h3>
                  
                  {/* Size/Color */}
                  {(item.sizes?.length > 0 || item.colors?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.sizes?.slice(0, 3).map((s, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">{s}</span>
                      ))}
                      {item.colors?.slice(0, 2).map((c, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">{c}</span>
                      ))}
                    </div>
                  )}
                  
                  {/* Price */}
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{formatWithConversion(item.selling_price || 0)}</p>
                      {item.mrp > item.selling_price && (
                        <p className="text-xs text-gray-400 line-through">{formatWithConversion(item.mrp || 0)}</p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700"
                      onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      disabled={item.current_stock <= 0}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Item Detail Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="max-w-lg">
          {selectedItem && (
            <>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                {selectedItem.images?.[0] ? (
                  <img loading="lazy" src={selectedItem.images[0]} alt={selectedItem.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-20 h-20 text-gray-300" />
                  </div>
                )}
              </div>
              
              {selectedItem.brand && (
                <p className="text-sm text-blue-600 font-semibold uppercase">{selectedItem.brand}</p>
              )}
              <h2 className="text-xl font-bold">{selectedItem.name}</h2>
              
              {/* Sizes & Colors */}
              {selectedItem.sizes?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-1">Sizes:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.sizes.map((s, i) => (
                      <Badge key={i} variant="outline">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedItem.colors?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-1">Colors:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.colors.map((c, i) => (
                      <Badge key={i} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Price & Stock */}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  {selectedItem.mrp > selectedItem.selling_price && (
                    <p className="text-sm text-gray-400 line-through">MRP: {formatWithConversion(selectedItem.mrp || 0)}</p>
                  )}
                  <p className="text-2xl font-bold text-emerald-600">{formatWithConversion(selectedItem.selling_price || 0)}</p>
                </div>
                <p className={`text-sm ${selectedItem.current_stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedItem.current_stock > 0 ? `${selectedItem.current_stock} in stock` : 'Out of stock'}
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <Button 
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { addToCart(selectedItem); setShowItemModal(false); }}
                  disabled={selectedItem.current_stock <= 0}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart
                </Button>
                
                {/* WhatsApp Share for single item */}
                <Button 
                  className="h-12 px-4 bg-green-500 hover:bg-green-600"
                  onClick={() => handleShareItemWhatsApp(selectedItem)}
                  title="Ask about this product on WhatsApp"
                  data-testid="whatsapp-share-item"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Drawer */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your Cart ({cartCount} items)</DialogTitle>
          </DialogHeader>
          
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">Your cart is empty</p>
              <Button 
                onClick={() => setShowCart(false)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Continue Shopping
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {item.images?.[0] ? (
                        <img loading="lazy" src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                      <p className="text-sm text-gray-500">{formatWithConversion(item.selling_price || 0)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.id, -1)}>-</Button>
                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.id, 1)}>+</Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 ml-auto" onClick={() => removeFromCart(item.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between text-lg font-bold mb-4">
                  <span>Total</span>
                  <span>{formatWithConversion(cartTotal)}</span>
                </div>
                
                {/* WhatsApp Order Button - Prominent */}
                <Button 
                  className="w-full h-14 bg-green-500 hover:bg-green-600 text-white font-semibold text-lg shadow-lg"
                  onClick={handleWhatsAppOrder}
                  data-testid="whatsapp-order-btn"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 mr-2 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Order via WhatsApp
                </Button>
                
                {storePhone && (
                  <p className="text-center text-sm text-gray-500 mt-2">
                    Your order will be sent to our WhatsApp
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-6 right-6 z-50" data-testid="whatsapp-float-container">
        <div className="relative group">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-sm py-2 px-3 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {cartCount > 0 ? `Order ${cartCount} items via WhatsApp` : 'Chat with us on WhatsApp'}
            <div className="absolute left-full top-1/2 -translate-y-1/2 border-8 border-transparent border-l-gray-800" />
          </div>
          
          <button
            onClick={cartCount > 0 ? handleWhatsAppOrder : () => {
              const message = `Hi! I'm browsing your catalogue at ${storeName}. I have a question.`;
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
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
          
          {/* Pulse animation ring */}
          <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25" />
        </div>
      </div>
    </div>
  );
}

// Catalogue Share Component for Admin
export function CatalogueShareButton({ tenantId, storeName }) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const catalogueUrl = `${window.location.origin}/catalogue?store=${tenantId}&name=${encodeURIComponent(storeName || 'Our Store')}`;
  
  const copyLink = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(catalogueUrl);
      } else {
        // Fallback for mobile/restricted browsers
        const textArea = document.createElement('textarea');
        textArea.value = catalogueUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Final fallback - show the link for manual copy
      toast.info('Please copy the link manually', {
        description: catalogueUrl
      });
    }
  };
  
  const shareOnWhatsApp = () => {
    const message = `🛍️ Check out our product catalogue: ${catalogueUrl}`;
    window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };
  
  const downloadQR = () => {
    const svg = document.getElementById('catalogue-qr');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      
      const link = document.createElement('a');
      link.download = 'catalogue-qr-code.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };
  
  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setShowModal(true)}
        className="gap-2"
      >
        <QrCode className="w-4 h-4" /> Share Catalogue
      </Button>
      
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" /> Share Your Catalogue
            </DialogTitle>
            <DialogDescription>
              Share this link or QR code with your customers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-xl border">
              <QRCodeSVG 
                id="catalogue-qr"
                value={catalogueUrl}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            
            {/* Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Catalogue Link</label>
              <div className="flex gap-2">
                <Input 
                  value={catalogueUrl} 
                  readOnly 
                  className="text-sm"
                />
                <Button onClick={copyLink} variant="outline" className="shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={downloadQR} variant="outline" className="gap-2">
                <QrCode className="w-4 h-4" /> Download QR
              </Button>
              <Button onClick={shareOnWhatsApp} className="gap-2 bg-green-600 hover:bg-green-700">
                <Share2 className="w-4 h-4" /> WhatsApp
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.open(catalogueUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4" /> Preview Catalogue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
