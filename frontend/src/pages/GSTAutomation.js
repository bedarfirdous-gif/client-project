import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Calculator, FileText, Download, RefreshCw, CheckCircle, AlertTriangle, 
  IndianRupee, Receipt, TrendingUp, ArrowRight, Building2, Clock,
  FileCheck, FilePlus, PieChart, BarChart3
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GSTAutomation() {
  const { token } = useAuth();
  // Fix: avoid `null` initial state to prevent a render pass with missing content
  // that can cause a visible flash when data arrives.
  // Use stable empty objects and render only when populated.
  const [dashboard, setDashboard] = useState({});
  const [returns, setReturns] = useState([]);
  const [itcSummary, setItcSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [gstin, setGstin] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7).replace('-', ''));
  
  // Generation states
  const [generatingGstr1, setGeneratingGstr1] = useState(false);
  const [generatingGstr3b, setGeneratingGstr3b] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  // Fix: avoid `null` initial state which can cause a UI flash when the result arrives
  // and conditional rendering switches from "nothing" to "content".
  // Use a stable empty object shape instead.
  const [calculatorResult, setCalculatorResult] = useState({});

  // Calculator form
  const [calcForm, setCalcForm] = useState({
    sellerGstin: '',
    buyerGstin: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, gstRate: 18 }]
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/gst-automation/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
        if (data.gstin) setGstin(data.gstin);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  }, [token]);

  const fetchReturns = useCallback(async () => {
    if (!gstin) return;
    try {
      const response = await fetch(`${API_URL}/api/gst-automation/returns?gstin=${gstin}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReturns(data.returns || []);
      }
    } catch (error) {
      console.error('Failed to fetch returns:', error);
    }
  }, [token, gstin]);

  const fetchItcSummary = useCallback(async () => {
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7).replace('-', '').replace(/(\d{4})(\d{2})/, '$2$1');
      const response = await fetch(`${API_URL}/api/gst-automation/itc/summary?period=${currentPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItcSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch ITC summary:', error);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchItcSummary()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchItcSummary]);

  useEffect(() => {
    if (gstin) fetchReturns();
  }, [gstin, fetchReturns]);

  const generateGstr1 = async () => {
    if (!gstin) return;
    setGeneratingGstr1(true);
    try {
      const response = await fetch(`${API_URL}/api/gst-automation/returns/gstr1/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gstin, period })
      });
      if (response.ok) {
        await fetchReturns();
        alert('GSTR-1 generated successfully!');
      }
    } catch (error) {
      console.error('Failed to generate GSTR-1:', error);
    } finally {
      setGeneratingGstr1(false);
    }
  };

  const generateGstr3b = async () => {
    if (!gstin) return;
    setGeneratingGstr3b(true);
    try {
      const response = await fetch(`${API_URL}/api/gst-automation/returns/gstr3b/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gstin, period })
      });
      if (response.ok) {
        await fetchReturns();
        alert('GSTR-3B generated successfully!');
      }
    } catch (error) {
      console.error('Failed to generate GSTR-3B:', error);
    } finally {
      setGeneratingGstr3b(false);
    }
  };

  const calculateGst = async () => {
    try {
      const response = await fetch(`${API_URL}/api/gst-automation/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          seller_gstin: calcForm.sellerGstin,
          buyer_gstin: calcForm.buyerGstin,
          items: calcForm.items.map(item => ({
            description: item.description,
            quantity: parseFloat(item.quantity) || 1,
            unit_price: parseFloat(item.unitPrice) || 0,
            gst_rate: parseFloat(item.gstRate) || 18
          }))
        })
      });
      if (response.ok) {
        const result = await response.json();
        setCalculatorResult(result);
      }
    } catch (error) {
      console.error('Failed to calculate GST:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="gst-automation">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
            <IndianRupee className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">GST Automation</h1>
            <p className="text-sm text-muted-foreground">
              Complete GST compliance, returns & ITC management
            </p>
          </div>
          <Badge variant="outline" className="ml-2 bg-gradient-to-r from-orange-50 to-red-50">
            Automated
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowCalculator(true)}
            data-testid="calculator-btn"
          >
            <Calculator className="w-4 h-4 mr-2" />
            GST Calculator
          </Button>
          <Button 
            size="sm"
            onClick={() => Promise.all([fetchDashboard(), fetchReturns(), fetchItcSummary()])}
            data-testid="refresh-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {dashboard && !dashboard.error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tax Collected (Month)</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(dashboard.tax_collected?.total_tax)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ITC Available</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(dashboard.itc_available)}
                  </p>
                </div>
                <Receipt className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Liability</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(dashboard.net_liability)}
                  </p>
                </div>
                <IndianRupee className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Compliance Status</p>
                  <p className={`text-2xl font-bold ${dashboard.compliance_status === 'compliant' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {dashboard.compliance_status === 'compliant' ? 'Compliant' : 'Pending'}
                  </p>
                </div>
                {dashboard.compliance_status === 'compliant' ? (
                  <CheckCircle className="w-8 h-8 text-green-200" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-yellow-200" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GSTIN Warning */}
      {dashboard?.error && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-medium">GSTIN Not Configured</p>
              <p className="text-sm text-muted-foreground">
                Please configure your GSTIN in Store Settings to enable GST automation features.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="itc">ITC</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Generate GST returns and manage compliance</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>GSTIN</Label>
                <Input 
                  placeholder="Enter GSTIN (e.g., 27AABCU9603R1ZM)"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-3">
                <Label>Period (MMYYYY)</Label>
                <Input 
                  placeholder="e.g., 122025"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              </div>
            </CardContent>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-0">
              <Button 
                className="h-auto py-4 justify-start"
                variant="outline"
                onClick={generateGstr1}
                disabled={generatingGstr1 || !gstin}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Generate GSTR-1</p>
                    <p className="text-xs text-muted-foreground">Outward supplies return</p>
                  </div>
                </div>
                {generatingGstr1 && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
              
              <Button 
                className="h-auto py-4 justify-start"
                variant="outline"
                onClick={generateGstr3b}
                disabled={generatingGstr3b || !gstin}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Generate GSTR-3B</p>
                    <p className="text-xs text-muted-foreground">Summary return</p>
                  </div>
                </div>
                {generatingGstr3b && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
            </CardContent>
          </Card>

          {/* Month Summary */}
          {dashboard && !dashboard.error && (
            <Card>
              <CardHeader>
                <CardTitle>Current Month Summary</CardTitle>
                <CardDescription>Tax details for {dashboard.current_month}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Invoices</p>
                    <p className="text-2xl font-bold">{dashboard.month_invoices}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Taxable Value</p>
                    <p className="text-xl font-bold">{formatCurrency(dashboard.tax_collected?.taxable_value)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Tax</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(dashboard.tax_collected?.total_tax)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-xl font-bold">{formatCurrency(dashboard.tax_collected?.total_amount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="returns" className="space-y-4">
          {returns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium">No returns generated</p>
                <p className="text-muted-foreground">Generate GSTR-1 or GSTR-3B from the Dashboard</p>
              </CardContent>
            </Card>
          ) : (
            returns.map((ret) => (
              <Card key={`${ret.return_type}-${ret.period}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium uppercase">{ret.return_type}</h3>
                        <Badge variant={ret.status === 'filed' ? 'default' : 'outline'}>
                          {ret.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Period: {ret.period || ret.fp}</p>
                      {ret.summary && (
                        <div className="flex gap-4 text-sm">
                          <span>Invoices: {ret.summary.total_invoices}</span>
                          <span>Tax: {formatCurrency(ret.summary.total_tax)}</span>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="itc" className="space-y-4">
          {itcSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-green-50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Available ITC</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(itcSummary.available?.total)}</p>
                  <p className="text-xs text-muted-foreground">{itcSummary.available?.count} entries</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Utilized ITC</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(itcSummary.utilized?.total)}</p>
                  <p className="text-xs text-muted-foreground">{itcSummary.utilized?.count} entries</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Reversed ITC</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(itcSummary.reversed?.total)}</p>
                  <p className="text-xs text-muted-foreground">{itcSummary.reversed?.count} entries</p>
                </CardContent>
              </Card>
            </div>
          )}

          {itcSummary?.by_category && (
            <Card>
              <CardHeader>
                <CardTitle>ITC by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Inputs</span>
                    <span className="font-bold">{formatCurrency(itcSummary.by_category.inputs)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Capital Goods</span>
                    <span className="font-bold">{formatCurrency(itcSummary.by_category.capital_goods)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Input Services</span>
                    <span className="font-bold">{formatCurrency(itcSummary.by_category.input_services)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium">GST Reports</p>
              <p className="text-muted-foreground">Generate detailed GST reports and analytics</p>
              <div className="flex justify-center gap-4 mt-4">
                <Button variant="outline">
                  <PieChart className="w-4 h-4 mr-2" />
                  Tax Summary
                </Button>
                <Button variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  HSN Summary
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* GST Calculator Dialog */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              GST Calculator
            </DialogTitle>
            <DialogDescription>
              Calculate GST automatically based on GSTIN (Inter/Intra state)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Seller GSTIN</Label>
                <Input 
                  placeholder="27AABCU9603R1ZM"
                  value={calcForm.sellerGstin}
                  onChange={(e) => setCalcForm({...calcForm, sellerGstin: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <Label>Buyer GSTIN (optional)</Label>
                <Input 
                  placeholder="Leave empty for B2C"
                  value={calcForm.buyerGstin}
                  onChange={(e) => setCalcForm({...calcForm, buyerGstin: e.target.value.toUpperCase()})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              {calcForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2">
                  <Input 
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => {
                      const newItems = [...calcForm.items];
                      newItems[idx].description = e.target.value;
                      setCalcForm({...calcForm, items: newItems});
                    }}
                  />
                  <Input 
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...calcForm.items];
                      newItems[idx].quantity = e.target.value;
                      setCalcForm({...calcForm, items: newItems});
                    }}
                  />
                  <Input 
                    type="number"
                    placeholder="Unit Price"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const newItems = [...calcForm.items];
                      newItems[idx].unitPrice = e.target.value;
                      setCalcForm({...calcForm, items: newItems});
                    }}
                  />
                  <Select
                    value={String(item.gstRate)}
                    onValueChange={(v) => {
                      const newItems = [...calcForm.items];
                      newItems[idx].gstRate = v;
                      setCalcForm({...calcForm, items: newItems});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCalcForm({
                  ...calcForm, 
                  items: [...calcForm.items, { description: '', quantity: 1, unitPrice: 0, gstRate: 18 }]
                })}
              >
                Add Item
              </Button>
            </div>

            <Button onClick={calculateGst} className="w-full">
              Calculate GST
            </Button>

            {calculatorResult && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supply Type:</span>
                  <Badge>{calculatorResult.is_inter_state ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Taxable Value:</span>
                  <span className="font-medium">{formatCurrency(calculatorResult.total_taxable_value)}</span>
                </div>
                {calculatorResult.is_inter_state ? (
                  <div className="flex justify-between">
                    <span>IGST:</span>
                    <span className="font-medium">{formatCurrency(calculatorResult.total_igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span className="font-medium">{formatCurrency(calculatorResult.total_cgst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span className="font-medium">{formatCurrency(calculatorResult.total_sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total Amount:</span>
                  <span className="text-green-600">{formatCurrency(calculatorResult.total_amount)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCalculator(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
