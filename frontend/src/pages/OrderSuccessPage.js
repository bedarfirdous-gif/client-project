import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, Truck, Clock, ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function OrderSuccessPage() {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  // FIX: Avoid `null` initial state which can cause a brief UI branch flip (flash)
  // when `order` transitions from null -> loaded object.
  // Use a stable default object shape and rely on `loading`/`showEmailPrompt` to control rendering.
  const [order, setOrder] = useState({ items: [] });
  const [item, setItem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);

  useEffect(() => {
    // Try to get email from localStorage
    const savedEmail = localStorage.getItem('checkout_email');
    if (savedEmail && orderId) {
      fetchOrder(savedEmail);
    } else {
      setShowEmailPrompt(true);
      setLoading(false);
    }
  }, [orderId]);

  const fetchOrder = async (customerEmail) => {
    try {
      const response = await fetch(
        `${API_URL}/api/storefront/${tenantSlug}/order/${orderId}?email=${encodeURIComponent(customerEmail)}`
      );
      if (response.ok) {
        const data = await response.json();
        setOrder(data);
        localStorage.setItem('checkout_email', customerEmail);
      } else {
        setShowEmailPrompt(true);
      }
    } catch (err) {
      console.error(err);
      setShowEmailPrompt(true);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price || 0);
  };

  const getStatusStep = (status) => {
    const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    return steps.indexOf(status);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showEmailPrompt && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Package className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">View Your Order</h1>
            <p className="text-gray-500 mb-4">Enter the email address you used to place the order.</p>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
            />
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => fetchOrder(email)}
              disabled={!email}
            >
              View Order
            </Button>
            <Link 
              to={`/store/${tenantSlug}`}
              className="block mt-4 text-sm text-blue-600 hover:underline"
            >
              Continue Shopping
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="order-success-page">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Order Placed Successfully!</h1>
          <p className="text-gray-500 mt-1">Order ID: {orderId}</p>
          {order?.payment_method === 'cod' && (
            <p className="text-amber-600 mt-2 text-sm">
              Pay {formatPrice(order.total_amount)} on delivery
            </p>
          )}
        </div>

        {order && (
          <>
            {/* Order Status Timeline */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4">Order Status</h2>
                <div className="relative">
                  <div className="flex justify-between">
                    {['Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered'].map((step, index) => {
                      const isActive = getStatusStep(order.status) >= index - 1;
                      const isCurrent = getStatusStep(order.status) === index - 1;
                      return (
                        <div key={step} className="flex flex-col items-center flex-1">
                          <div 
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              isActive 
                                ? 'bg-green-500 text-white' 
                                : 'bg-gray-200 text-gray-500'
                            } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}
                          >
                            {index + 1}
                          </div>
                          <span className={`text-xs mt-2 ${isActive ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress Line */}
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10" style={{ width: '100%', marginLeft: '4%', marginRight: '4%', maxWidth: '92%' }}>
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${Math.max(0, getStatusStep(order.status)) * 25}%` }}
                    />
                  </div>
                </div>
                
                {order.tracking_number && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <Truck className="w-4 h-4 inline mr-2" />
                      Tracking Number: <span className="font-mono font-medium">{order.tracking_number}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4">Order Details</h2>
                <div className="space-y-3">
                  {order.items?.map((item, index) => (
                    <div key={index} className="flex gap-3 py-2 border-b last:border-0">
                      {item.image ? (
                        <img loading="lazy" src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
                        <p className="text-sm text-gray-500">Qty: {item.quantity} × {formatPrice(item.price)}</p>
                      </div>
                      <p className="font-semibold">{formatPrice(item.total)}</p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Delivery</span>
                    <span>{order.delivery_charge > 0 ? formatPrice(order.delivery_charge) : 'FREE'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span>{formatPrice(order.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-green-600">{formatPrice(order.total_amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Info */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4">Delivery Information</h2>
                <div className="space-y-3 text-sm">
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span>{order.shipping_address}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{order.customer_email}</span>
                  </p>
                  {order.customer_phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{order.customer_phone}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={`/store/${tenantSlug}`}>
            <Button variant="outline" className="w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
