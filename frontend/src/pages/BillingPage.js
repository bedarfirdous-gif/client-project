import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import {
  CreditCard, Check, X, Crown, Zap, Building2, Rocket,
  ArrowRight, RefreshCw, History, AlertCircle, CheckCircle,
  TrendingUp, Users, Store, Package, ShoppingCart, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';

const PLAN_ICONS = {
  free: Building2,
  starter: Building2,
  basic: Zap,
  pro: Crown,
  enterprise: Rocket
};

const PLAN_COLORS = {
  free: 'bg-gray-100 text-gray-700 border-gray-300',
  starter: 'bg-amber-100 text-amber-700 border-amber-300',
  basic: 'bg-blue-100 text-blue-700 border-blue-300',
  pro: 'bg-purple-100 text-purple-700 border-purple-300',
  enterprise: 'bg-rose-100 text-rose-700 border-rose-300'
};

export default function BillingPage() {
  const { api, user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [timeout, setTimeout] = useState(false);
  const [plans, setPlans] = useState([]);

  // FIX: avoid `null` initial async data states which can cause a first-paint flash
  // (null -> populated) when the UI conditionally renders sections.
  // Use stable empty shapes while `loading` is true.
  const [currentSubscription, setCurrentSubscription] = useState({});
  const [usage, setUsage] = useState({});
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('plans');
  
  // Checkout flow
  // FIX: Avoid null initial state that can cause a flash when UI conditionally renders
  // based on a selected plan existing. Use a stable empty object + explicit flag.
  const [selectedPlan, setSelectedPlan] = useState({});
  const [hasSelectedPlan, setHasSelectedPlan] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  // Upgrade/Downgrade flow
  const [planComparison, setPlanComparison] = useState({});
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  // FIX: Same pattern for change plan target to prevent initial null -> object flash.
  const [changePlanTarget, setChangePlanTarget] = useState({});
  const [hasChangePlanTarget, setHasChangePlanTarget] = useState(false);
  const [planChangeEstimate, setPlanChangeEstimate] = useState({});
  const [changingPlan, setChangingPlan] = useState(false);
  const [planChangeHistory, setPlanChangeHistory] = useState([]);

  // Keep pendingRequest as an explicit tri-state:
  // null = no pending request; object = pending request; (avoids undefined checks)
  const [pendingRequest, setPendingRequest] = useState(null);

  useEffect(() => {
    fetchData();
    checkUrlParams();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansData, subscriptionData, usageData, historyData, comparisonData, changeHistoryData, pendingRequestData] = await Promise.all([
        api('/api/billing/plans'),
        api('/api/billing/subscription'),
        api('/api/billing/usage'),
        api('/api/billing/history'),
        api('/api/billing/compare-plans').catch(() => null),
        api('/api/billing/plan-change-history').catch(() => ({ history: [] })),
        api('/api/billing/upgrade-request-status').catch(() => ({ has_pending_request: false }))
      ]);
      
      setPlans(plansData.plans);
      setCurrentSubscription(subscriptionData);
      setUsage(usageData);
      setHistory(historyData.transactions);
      if (comparisonData) setPlanComparison(comparisonData);
      setPlanChangeHistory(changeHistoryData?.history || []);
      if (pendingRequestData?.has_pending_request) {
        setPendingRequest(pendingRequestData.request);
      } else {
        setPendingRequest(null);
      }
    } catch (err) {
      console.error('Failed to fetch billing data:', err);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const cancelPendingRequest = async () => {
    try {
      await api('/api/billing/cancel-upgrade-request', { method: 'DELETE' });
      toast.success('Upgrade request cancelled');
      setPendingRequest(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to cancel request');
    }
  };

  // Check URL for payment status
  const checkUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const status = params.get('status');
    
    if (sessionId && status === 'success') {
      pollPaymentStatus(sessionId);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === 'cancelled') {
      toast.info('Payment was cancelled');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Poll payment status
  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000;
    
    if (attempts >= maxAttempts) {
      toast.error('Payment verification timed out. Please check your email for confirmation.');
      setCheckingStatus(false);
      return;
    }
    
    setCheckingStatus(true);
    
    try {
      const result = await api(`/api/billing/checkout/status/${sessionId}`);
      
      if (result.payment_status === 'paid') {
        toast.success(result.message || 'Payment successful! Your plan has been upgraded.');
        setCheckingStatus(false);
        fetchData(); // Refresh data
        return;
      } else if (result.status === 'expired') {
        toast.error('Payment session expired. Please try again.');
        setCheckingStatus(false);
        return;
      }
      
      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (err) {
      console.error('Status check error:', err);
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    }
  };

  // Initiate checkout
  const handleUpgrade = async (plan) => {
    setSelectedPlan(plan);
    setShowConfirmModal(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan) return;
    
    setProcessing(true);
    
    try {
      const result = await api('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          origin_url: window.location.origin
        })
      });
      
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to initiate payment');
      setProcessing(false);
    }
  };

  // Cancel subscription
  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free plan at the end of your billing period.')) {
      return;
    }
    
    try {
      const result = await api('/api/billing/cancel', { method: 'POST' });
      toast.success(result.message);
      fetchData();
    } catch (err) {
      toast.error('Failed to cancel subscription');
    }
  };

  // Open plan change modal
  const openChangePlanModal = async (plan) => {
    if (pendingRequest) {
      toast.error('You already have a pending upgrade request. Please wait for approval or cancel it first.');
      return;
    }
    
    setChangePlanTarget(plan);
    setShowChangePlanModal(true);
    
    // Get estimate
    try {
      const estimate = await api(`/api/billing/estimate-change?new_plan=${plan.id}`);
      setPlanChangeEstimate(estimate);
    } catch (err) {
      console.error('Failed to get estimate:', err);
      setPlanChangeEstimate(null);
    }
  };

  // Confirm plan change
  const confirmPlanChange = async () => {
    if (!changePlanTarget) return;
    
    setChangingPlan(true);
    try {
      const result = await api('/api/billing/change-plan', {
        method: 'POST',
        body: JSON.stringify({
          new_plan: changePlanTarget.id,
          billing_cycle: 'year'
        })
      });
      
      if (result.requires_approval) {
        toast.success('Upgrade request submitted! Awaiting SuperAdmin approval after payment confirmation.', {
          duration: 6000
        });
        setPendingRequest({
          ...result,
          to_plan: changePlanTarget.id,
          to_plan_name: changePlanTarget.name,
          amount_due: result.amount_due,
          status: 'pending',
          payment_status: 'unpaid'
        });
      } else {
        toast.success(result.message);
      }
      
      setShowChangePlanModal(false);
      setChangePlanTarget(null);
      setPlanChangeEstimate(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to change plan');
    } finally {
      setChangingPlan(false);
    }
  };

  // formatCurrency now comes from useCurrency context

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (checkingStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">Verifying Payment...</h2>
        <p className="text-muted-foreground">Please wait while we confirm your payment</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Upgrade Request Banner */}
      {pendingRequest && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Pending Upgrade Request
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Upgrade to <span className="font-semibold">{pendingRequest.to_plan_name || pendingRequest.to_plan}</span> • 
                    Amount: <span className="font-semibold">{formatCurrency(pendingRequest.amount_due)}</span>
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Status: <Badge variant="outline" className="ml-1 bg-amber-100 text-amber-700 border-amber-300">
                      {pendingRequest.payment_status === 'paid' ? 'Payment Confirmed - Awaiting Approval' : 'Awaiting Payment & Approval'}
                    </Badge>
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={cancelPendingRequest}
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                Cancel Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your plan and view billing history</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Current Plan Card */}
      {currentSubscription && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(() => {
                  const IconComponent = PLAN_ICONS[currentSubscription.plan] || Building2;
                  return (
                    <div className="p-3 rounded-xl bg-primary/10">
                      <IconComponent className="w-8 h-8 text-primary" />
                    </div>
                  );
                })()}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">{currentSubscription.plan_details?.name || 'Free'} Plan</h2>
                    <Badge className={PLAN_COLORS[currentSubscription.plan] || PLAN_COLORS.free}>
                      {currentSubscription.status === 'active' ? 'Active' : currentSubscription.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {currentSubscription.plan_details?.price > 0 
                      ? `${formatCurrency(currentSubscription.plan_details.price)}/${currentSubscription.plan_details?.interval || 'year'}`
                      : 'Free forever'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {currentSubscription.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    Renews on {new Date(currentSubscription.current_period_end).toLocaleDateString()}
                  </p>
                )}
                {currentSubscription.plan !== 'free' && (
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={handleCancelSubscription}>
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="plans" className="gap-2">
            <Crown className="w-4 h-4" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          {/* Current Usage Summary */}
          {planComparison && (
            <Card className="bg-accent/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Current Usage</p>
                    <p className="text-xs text-muted-foreground">
                      {planComparison.current_usage?.stores || 0} stores, {planComparison.current_usage?.products || 0} products, {planComparison.current_usage?.users || 0} users
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{planComparison.current_plan} Plan</Badge>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const IconComponent = PLAN_ICONS[plan.id] || Building2;
              const isCurrentPlan = currentSubscription?.plan === plan.id;
              const comparisonPlan = planComparison?.plans?.find(p => p.id === plan.id);
              const isUpgrade = comparisonPlan?.is_upgrade;
              const isDowngrade = comparisonPlan?.is_downgrade;
              const canAccommodate = comparisonPlan?.can_accommodate !== false;
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative overflow-hidden transition-all hover:shadow-lg ${
                    isCurrentPlan ? 'ring-2 ring-primary' : ''
                  } ${plan.id === 'pro' ? 'border-purple-300' : ''}`}
                >
                  {plan.id === 'pro' && (
                    <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs px-3 py-1 rounded-bl-lg">
                      Popular
                    </div>
                  )}
                  
                  <CardHeader className="pb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                      plan.id === 'free' ? 'bg-gray-100' :
                      plan.id === 'starter' ? 'bg-amber-100' :
                      plan.id === 'basic' ? 'bg-blue-100' :
                      plan.id === 'pro' ? 'bg-purple-100' :
                      plan.id === 'enterprise' ? 'bg-rose-100' :
                      'bg-gray-100'
                    }`}>
                      <IconComponent className={`w-6 h-6 ${
                        plan.id === 'free' ? 'text-gray-600' :
                        plan.id === 'starter' ? 'text-amber-600' :
                        plan.id === 'basic' ? 'text-blue-600' :
                        plan.id === 'pro' ? 'text-purple-600' :
                        plan.id === 'enterprise' ? 'text-rose-600' :
                        'text-gray-600'
                      }`} />
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">
                        {plan.price > 0 ? formatCurrency(plan.price) : 'Free'}
                      </span>
                      {plan.price > 0 && <span className="text-muted-foreground">/{plan.interval || 'year'}</span>}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-4">
                    <ul className="space-y-2">
                      {(plan.features || []).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {/* Warning for downgrade */}
                    {isDowngrade && !canAccommodate && comparisonPlan?.warnings?.length > 0 && (
                      <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Cannot downgrade - usage exceeds limits
                        </p>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter>
                    {isCurrentPlan ? (
                      <Button className="w-full" disabled>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Current Plan
                      </Button>
                    ) : (
                      <Button 
                        className={`w-full ${isDowngrade ? 'bg-gray-600 hover:bg-gray-700' : ''}`}
                        variant={plan.id === 'pro' ? 'default' : 'outline'}
                        onClick={() => openChangePlanModal(plan)}
                        disabled={isDowngrade && !canAccommodate}
                        data-testid={`select-plan-${plan.id}`}
                      >
                        {isUpgrade ? (
                          <>
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Upgrade
                          </>
                        ) : isDowngrade ? (
                          <>
                            <ArrowRight className="w-4 h-4 mr-2 rotate-90" />
                            Downgrade
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Switch
                          </>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          
          {/* Plan Change History */}
          {planChangeHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plan Change History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {planChangeHistory.slice(0, 5).map((change) => (
                    <div key={change.id} className="flex items-center justify-between p-2 rounded bg-accent/30">
                      <div className="flex items-center gap-2">
                        {change.is_upgrade ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingUp className="w-4 h-4 text-amber-500 rotate-180" />
                        )}
                        <span className="text-sm">
                          {change.from_plan} → {change.to_plan}
                        </span>
                        <Badge variant={change.is_upgrade ? 'default' : 'secondary'} className="text-xs">
                          {change.is_upgrade ? 'Upgrade' : 'Downgrade'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(change.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Usage</CardTitle>
              <CardDescription>Your resource usage compared to plan limits</CardDescription>
            </CardHeader>
            <CardContent>
              {usage && usage.usage && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(usage.usage || {}).map(([key, data]) => {
                    const icons = {
                      stores: Store,
                      products: Package,
                      users: Users,
                      customers: Users,
                      sales_this_month: ShoppingCart
                    };
                    const IconComponent = icons[key] || TrendingUp;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{label}</span>
                          </div>
                          <span className={`text-sm ${data.exceeded ? 'text-red-600 font-semibold' : ''}`}>
                            {data.current} / {data.limit}
                          </span>
                        </div>
                        <Progress 
                          value={data.percentage} 
                          className={`h-2 ${data.exceeded ? 'bg-red-100' : ''}`}
                        />
                        {data.exceeded && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Limit exceeded - Upgrade recommended
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Your past transactions and invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          tx.payment_status === 'paid' ? 'bg-green-100' :
                          tx.payment_status === 'pending' ? 'bg-amber-100' :
                          'bg-gray-100'
                        }`}>
                          <CreditCard className={`w-5 h-5 ${
                            tx.payment_status === 'paid' ? 'text-green-600' :
                            tx.payment_status === 'pending' ? 'text-amber-600' :
                            'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{tx.plan_name} Plan</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(tx.amount)}</p>
                        <Badge variant={
                          tx.payment_status === 'paid' ? 'default' :
                          tx.payment_status === 'pending' ? 'secondary' :
                          'destructive'
                        }>
                          {tx.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No payment history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Upgrade Modal (Stripe) */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              You will be charged {selectedPlan && formatCurrency(selectedPlan.price)} per month
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="space-y-4">
              <Card className="bg-accent/50">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">What you&apos;ll get:</h4>
                  <ul className="space-y-1">
                    {(selectedPlan?.features || []).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              
              <p className="text-sm text-muted-foreground">
                You&apos;ll be redirected to Stripe to complete the payment securely.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmUpgrade} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Proceed to Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Change Modal (Upgrade/Downgrade) */}
      <Dialog open={showChangePlanModal} onOpenChange={(open) => {
        if (!open) {
          setShowChangePlanModal(false);
          setChangePlanTarget(null);
          setPlanChangeEstimate(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {planChangeEstimate?.is_upgrade ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingUp className="w-5 h-5 text-amber-500 rotate-180" />
              )}
              {planChangeEstimate?.is_upgrade ? 'Upgrade' : 'Downgrade'} to {changePlanTarget?.name}
            </DialogTitle>
            <DialogDescription>
              {planChangeEstimate?.message || 'Change your subscription plan'}
            </DialogDescription>
          </DialogHeader>
          
          {changePlanTarget && (
            <div className="space-y-4">
              {/* Plan Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-accent/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Current Plan</p>
                    <p className="font-semibold capitalize">{planChangeEstimate?.current_plan || currentSubscription?.plan}</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(planChangeEstimate?.current_price || 0)}
                      <span className="text-xs font-normal">/{currentSubscription?.plan_details?.interval || 'year'}</span>
                    </p>
                  </CardContent>
                </Card>
                <Card className={`${planChangeEstimate?.is_upgrade ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200'}`}>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">New Plan</p>
                    <p className="font-semibold">{changePlanTarget.name}</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(changePlanTarget.price || 0)}
                      <span className="text-xs font-normal">/{changePlanTarget.interval || 'year'}</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Proration Info */}
              {planChangeEstimate && (
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Days remaining in billing cycle</span>
                      <span className="font-medium">{planChangeEstimate.days_remaining} days</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm">{planChangeEstimate.is_upgrade ? 'Amount to pay now' : 'Credit to account'}</span>
                      <span className={`font-bold ${planChangeEstimate.is_upgrade ? 'text-red-600' : 'text-green-600'}`}>
                        {planChangeEstimate.is_upgrade ? '' : '-'}{formatCurrency(Math.abs(planChangeEstimate.proration_amount || 0))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* New Features */}
              <div>
                <p className="text-sm font-medium mb-2">
                  {planChangeEstimate?.is_upgrade ? 'New features you will get:' : 'Features included:'}
                </p>
                <ul className="space-y-1">
                  {(changePlanTarget.features || []).slice(0, 5).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Warning for downgrade */}
              {!planChangeEstimate?.is_upgrade && (
                <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Your new limits will take effect immediately. Make sure your current usage fits within the new plan limits.
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowChangePlanModal(false);
              setChangePlanTarget(null);
              setPlanChangeEstimate(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={confirmPlanChange} 
              disabled={changingPlan}
              className={planChangeEstimate?.is_upgrade ? '' : 'bg-amber-600 hover:bg-amber-700'}
              data-testid="confirm-plan-change-btn"
            >
              {changingPlan ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {planChangeEstimate?.is_upgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
