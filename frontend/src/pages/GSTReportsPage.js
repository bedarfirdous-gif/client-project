import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  FileText, Download, RefreshCw, Calendar, Filter, ChevronRight,
  FileJson, FileSpreadsheet, Building2, Package, ArrowUpRight, ArrowDownRight,
  Calculator, TrendingUp, Percent, IndianRupee, CheckCircle, AlertCircle,
  Clock, Search, Eye, ChevronDown, Truck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

export default function GSTReportsPage() {
  const { api } = useAuth();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(false);
  const [date, setDate] = useState(false);
  const [activeReport, setActiveReport] = useState('gstr3b');
  
  // Date filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Report data
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  const [hsnData, setHsnData] = useState(null);
  const [gstr2Data, setGstr2Data] = useState(null);
  const [ewayData, setEwayData] = useState(null);
  
  // Fetch report data
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const params = `?from_date=${fromDate}&to_date=${toDate}`;
      
      if (activeReport === 'gstr1') {
        const res = await api(`/api/gst-reports/gstr1${params}`);
        setGstr1Data(res);
      } else if (activeReport === 'gstr3b') {
        const res = await api(`/api/gst-reports/gstr3b${params}`);
        setGstr3bData(res);
      } else if (activeReport === 'hsn') {
        const res = await api(`/api/gst-reports/hsn-summary${params}`);
        setHsnData(res);
      } else if (activeReport === 'gstr2') {
        const res = await api(`/api/gst-reports/gstr2${params}`);
        setGstr2Data(res);
      } else if (activeReport === 'eway') {
        const res = await api(`/api/gst-reports/eway-bills${params}`);
        setEwayData(res);
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  }, [api, fromDate, toDate, activeReport]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export JSON for GST portal
  const exportJSON = async () => {
    try {
      const params = `?from_date=${fromDate}&to_date=${toDate}`;
      let endpoint = '/api/gst-reports/export/gstr1-json';
      let reportName = 'GSTR-1';
      
      if (activeReport === 'gstr3b') {
        endpoint = '/api/gst-reports/export/gstr3b-json';
        reportName = 'GSTR-3B';
      }
      
      const res = await api(`${endpoint}${params}`);
      
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`${reportName} JSON exported successfully`);
    } catch (err) {
      toast.error('Failed to export JSON');
    }
  };

  // Report menu items (Tally-style)
  const reportMenu = [
    { id: 'gstr1', label: 'GSTR-1', icon: ArrowUpRight, description: 'Outward Supplies', color: 'text-green-600' },
    { id: 'gstr3b', label: 'GSTR-3B', icon: Calculator, description: 'Monthly Summary', color: 'text-blue-600' },
    { id: 'hsn', label: 'HSN Summary', icon: Package, description: 'HSN/SAC wise', color: 'text-purple-600' },
    { id: 'gstr2', label: 'GSTR-2', icon: ArrowDownRight, description: 'Inward Supplies', color: 'text-orange-600' },
    { id: 'eway', label: 'e-Way Bill', icon: FileText, description: 'Transport Documents', color: 'text-cyan-600' },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="gst-reports-page">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <IndianRupee className="w-7 h-7 text-blue-600" />
            GST Reports
          </h1>
          <p className="text-gray-500 mt-1">Generate GSTR-1, GSTR-3B & HSN Summary for GST Filing</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={fetchReportData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={exportJSON} 
            className="bg-green-600 hover:bg-green-700"
            disabled={activeReport === 'hsn'}
            data-testid="export-json-btn"
          >
            <FileJson className="w-4 h-4 mr-2" />
            Export {activeReport === 'gstr1' ? 'GSTR-1' : activeReport === 'gstr3b' ? 'GSTR-3B' : ''} JSON
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Period:</span>
            </div>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date();
              d.setDate(1);
              setFromDate(d.toISOString().split('T')[0]);
              setToDate(new Date().toISOString().split('T')[0]);
            }}>
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 1);
              d.setDate(1);
              setFromDate(d.toISOString().split('T')[0]);
              const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
              setToDate(lastDay.toISOString().split('T')[0]);
            }}>
              Last Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Layout - Tally Style */}
      <div className="grid grid-cols-12 gap-6">
        {/* Report Menu (Left Sidebar) */}
        <div className="col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">GST Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {reportMenu.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeReport === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => !item.disabled && setActiveReport(item.id)}
                      disabled={item.disabled}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors
                        ${isActive ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'}
                        ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <Icon className={`w-5 h-5 ${item.color}`} />
                      <div className="flex-1">
                        <p className={`font-medium ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-blue-600" />}
                      {item.disabled && <Badge variant="outline" className="text-[10px]">Soon</Badge>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Content (Right Side) */}
        <div className="col-span-9">
          {/* GSTR-3B Report */}
          {activeReport === 'gstr3b' && gstr3bData && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Total Vouchers</p>
                    <p className="text-2xl font-bold text-gray-900">{gstr3bData.summary?.total_vouchers || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Output Tax</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(gstr3bData.summary?.total_output_tax || 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Input Tax Credit</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(gstr3bData.summary?.total_itc || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-blue-600 uppercase">Net Tax Payable</p>
                    <p className="text-2xl font-bold text-blue-700">{formatCurrency(gstr3bData.summary?.net_tax_payable || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Section 3.1 - Outward Supplies */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">3.1</span>
                    Details of Outward Supplies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[300px]">Particulars</TableHead>
                        <TableHead className="text-right">Vouchers</TableHead>
                        <TableHead className="text-right">Taxable Value</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">Cess</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gstr3bData.section_3_1 && Object.entries(gstr3bData.section_3_1).map(([key, data]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{data.description}</TableCell>
                          <TableCell className="text-right">{data.voucher_count || 0}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.taxable_value || 0)}</TableCell>
                          <TableCell className="text-right text-blue-600">{formatCurrency(data.integrated_tax || 0)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(data.central_tax || 0)}</TableCell>
                          <TableCell className="text-right text-purple-600">{formatCurrency(data.state_tax || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.cess || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Section 4 - ITC */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">4</span>
                    Eligible ITC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[300px]">Details</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">Cess</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gstr3bData.section_4 && Object.entries(gstr3bData.section_4).map(([key, data]) => (
                        <TableRow key={key} className={key === 'c_net_itc' ? 'bg-green-50 font-medium' : ''}>
                          <TableCell>{data.description}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.integrated_tax)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.central_tax)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.state_tax)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.cess)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Section 6 - Tax Payable */}
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="bg-blue-700 text-white text-xs px-2 py-1 rounded">6</span>
                    Payment of Tax
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Description</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">Cess</TableHead>
                        <TableHead className="text-right bg-blue-100">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="font-bold">
                        <TableCell>Tax Payable</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstr3bData.section_6?.tax_payable?.integrated_tax || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstr3bData.section_6?.tax_payable?.central_tax || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstr3bData.section_6?.tax_payable?.state_tax || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstr3bData.section_6?.tax_payable?.cess || 0)}</TableCell>
                        <TableCell className="text-right text-blue-700 font-bold text-lg">
                          {formatCurrency(gstr3bData.section_6?.tax_payable?.total || 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* GSTR-1 Report */}
          {activeReport === 'gstr1' && gstr1Data && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Total Invoices</p>
                    <p className="text-2xl font-bold">{gstr1Data.summary?.total_invoices || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">B2B</p>
                    <p className="text-2xl font-bold text-green-600">{gstr1Data.summary?.b2b_count || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">B2C Large</p>
                    <p className="text-2xl font-bold text-blue-600">{gstr1Data.summary?.b2c_large_count || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">B2C Small</p>
                    <p className="text-2xl font-bold text-purple-600">{gstr1Data.summary?.b2c_small_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-green-600 uppercase">Total Value</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(gstr1Data.totals?.total_invoice_value || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs for different sections */}
              <Tabs defaultValue="b2b">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="b2b">B2B Invoices ({gstr1Data.b2b?.length || 0})</TabsTrigger>
                  <TabsTrigger value="b2c">B2C Invoices ({(gstr1Data.b2c_large?.length || 0) + (gstr1Data.b2c_small?.length || 0)})</TabsTrigger>
                  <TabsTrigger value="hsn">HSN Summary ({gstr1Data.hsn_summary?.length || 0})</TabsTrigger>
                  <TabsTrigger value="totals">Totals</TabsTrigger>
                </TabsList>

                <TabsContent value="b2b">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>GSTIN</TableHead>
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Taxable</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gstr1Data.b2b?.slice(0, 50).map((inv, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{inv.gstin}</TableCell>
                              <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                              <TableCell>{inv.invoice_date}</TableCell>
                              <TableCell className="text-right">{formatCurrency(inv.taxable_value)}</TableCell>
                              <TableCell className="text-right text-blue-600">{formatCurrency(inv.igst)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(inv.cgst)}</TableCell>
                              <TableCell className="text-right text-purple-600">{formatCurrency(inv.sgst)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(inv.invoice_value)}</TableCell>
                            </TableRow>
                          ))}
                          {(!gstr1Data.b2b || gstr1Data.b2b.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                No B2B invoices found for this period
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="b2c">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Place of Supply</TableHead>
                            <TableHead className="text-right">Taxable</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...(gstr1Data.b2c_large || []), ...(gstr1Data.b2c_small || [])].slice(0, 50).map((inv, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                              <TableCell>{inv.invoice_date}</TableCell>
                              <TableCell>{inv.place_of_supply || '-'}</TableCell>
                              <TableCell className="text-right">{formatCurrency(inv.taxable_value)}</TableCell>
                              <TableCell className="text-right text-blue-600">{formatCurrency(inv.igst)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(inv.cgst)}</TableCell>
                              <TableCell className="text-right text-purple-600">{formatCurrency(inv.sgst)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(inv.invoice_value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="hsn">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>HSN Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Taxable</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gstr1Data.hsn_summary?.map((hsn, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono font-medium">{hsn.hsn_code}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{hsn.description}</TableCell>
                              <TableCell className="text-right">{hsn.total_quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(hsn.taxable_value)}</TableCell>
                              <TableCell className="text-right text-blue-600">{formatCurrency(hsn.igst)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(hsn.cgst)}</TableCell>
                              <TableCell className="text-right text-purple-600">{formatCurrency(hsn.sgst)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(hsn.total_value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="totals">
                  <Card>
                    <CardContent className="py-6">
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">Tax Summary</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">Total Taxable Value</span>
                              <span className="font-medium">{formatCurrency(gstr1Data.totals?.total_taxable || 0)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">Integrated Tax (IGST)</span>
                              <span className="font-medium text-blue-600">{formatCurrency(gstr1Data.totals?.total_igst || 0)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">Central Tax (CGST)</span>
                              <span className="font-medium text-green-600">{formatCurrency(gstr1Data.totals?.total_cgst || 0)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">State Tax (SGST)</span>
                              <span className="font-medium text-purple-600">{formatCurrency(gstr1Data.totals?.total_sgst || 0)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">Cess</span>
                              <span className="font-medium">{formatCurrency(gstr1Data.totals?.total_cess || 0)}</span>
                            </div>
                            <div className="flex justify-between py-3 bg-blue-50 px-3 rounded-lg">
                              <span className="font-semibold">Total Invoice Value</span>
                              <span className="font-bold text-blue-700">{formatCurrency(gstr1Data.totals?.total_invoice_value || 0)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">Invoice Breakdown</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">B2B Invoices</span>
                              <span className="font-medium">{gstr1Data.summary?.b2b_count || 0}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">B2C Large Invoices</span>
                              <span className="font-medium">{gstr1Data.summary?.b2c_large_count || 0}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">B2C Small Invoices</span>
                              <span className="font-medium">{gstr1Data.summary?.b2c_small_count || 0}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">Credit/Debit Notes</span>
                              <span className="font-medium">{gstr1Data.summary?.cdnr_count || 0}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-gray-600">Exports</span>
                              <span className="font-medium">{gstr1Data.summary?.exports_count || 0}</span>
                            </div>
                            <div className="flex justify-between py-3 bg-gray-100 px-3 rounded-lg">
                              <span className="font-semibold">Total Invoices</span>
                              <span className="font-bold">{gstr1Data.summary?.total_invoices || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* HSN Summary Report */}
          {activeReport === 'hsn' && hsnData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">HSN Codes</p>
                    <p className="text-2xl font-bold">{hsnData.record_count || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Total Quantity</p>
                    <p className="text-2xl font-bold text-blue-600">{hsnData.totals?.total_quantity || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Taxable Value</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(hsnData.totals?.taxable_value || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-purple-600 uppercase">Total Tax</p>
                    <p className="text-xl font-bold text-purple-700">
                      {formatCurrency((hsnData.totals?.igst || 0) + (hsnData.totals?.cgst || 0) + (hsnData.totals?.sgst || 0))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* HSN Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    HSN/SAC Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>HSN/SAC</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">UQC</TableHead>
                        <TableHead className="text-right">Rate %</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Taxable</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hsnData.hsn_summary?.map((hsn, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-medium text-purple-600">{hsn.hsn_code}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{hsn.description}</TableCell>
                          <TableCell className="text-right text-gray-500">{hsn.uqc}</TableCell>
                          <TableCell className="text-right">{hsn.rate}%</TableCell>
                          <TableCell className="text-right font-medium">{hsn.total_quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(hsn.taxable_value)}</TableCell>
                          <TableCell className="text-right text-blue-600">{formatCurrency(hsn.igst)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(hsn.cgst)}</TableCell>
                          <TableCell className="text-right text-orange-600">{formatCurrency(hsn.sgst)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(hsn.total_value)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-gray-100 font-bold">
                        <TableCell colSpan={4}>Total</TableCell>
                        <TableCell className="text-right">{hsnData.totals?.total_quantity || 0}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsnData.totals?.taxable_value || 0)}</TableCell>
                        <TableCell className="text-right text-blue-600">{formatCurrency(hsnData.totals?.igst || 0)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(hsnData.totals?.cgst || 0)}</TableCell>
                        <TableCell className="text-right text-orange-600">{formatCurrency(hsnData.totals?.sgst || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(hsnData.totals?.total_value || 0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* GSTR-2 Report - Inward Supplies */}
          {activeReport === 'gstr2' && gstr2Data && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Total Purchases</p>
                    <p className="text-2xl font-bold">{gstr2Data.summary?.total_purchases || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">B2B (Registered)</p>
                    <p className="text-2xl font-bold text-blue-600">{gstr2Data.summary?.b2b_count || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">B2BUR (Unregistered)</p>
                    <p className="text-2xl font-bold text-orange-600">{gstr2Data.summary?.b2bur_count || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Taxable Value</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(gstr2Data.summary?.total_taxable_value || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-green-600 uppercase">ITC Available</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(gstr2Data.summary?.total_itc_available || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* B2B Purchases Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-blue-600" />
                    B2B Purchases (From Registered Suppliers)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Supplier GSTIN</TableHead>
                        <TableHead>Supplier Name</TableHead>
                        <TableHead>Invoice/Voucher No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Taxable</TableHead>
                        <TableHead className="text-right text-blue-600">IGST</TableHead>
                        <TableHead className="text-right text-green-600">CGST</TableHead>
                        <TableHead className="text-right text-purple-600">SGST</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gstr2Data.b2b?.length > 0 ? gstr2Data.b2b.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">{item.supplier_gstin}</TableCell>
                          <TableCell>{item.supplier_name}</TableCell>
                          <TableCell>{item.invoice_number || item.voucher_number}</TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.taxable_value)}</TableCell>
                          <TableCell className="text-right text-blue-600">{formatCurrency(item.igst)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(item.cgst)}</TableCell>
                          <TableCell className="text-right text-purple-600">{formatCurrency(item.sgst)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                            No B2B purchases found for this period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* B2BUR Purchases Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-orange-600" />
                    B2BUR Purchases (From Unregistered Suppliers)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Supplier Name</TableHead>
                        <TableHead>Invoice/Voucher No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>HSN Code</TableHead>
                        <TableHead className="text-right">Taxable</TableHead>
                        <TableHead className="text-right text-blue-600">IGST</TableHead>
                        <TableHead className="text-right text-green-600">CGST</TableHead>
                        <TableHead className="text-right text-purple-600">SGST</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gstr2Data.b2bur?.length > 0 ? gstr2Data.b2bur.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.supplier_name}</TableCell>
                          <TableCell>{item.invoice_number || item.voucher_number}</TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell className="font-mono">{item.hsn_code || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.taxable_value)}</TableCell>
                          <TableCell className="text-right text-blue-600">{formatCurrency(item.igst)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(item.cgst)}</TableCell>
                          <TableCell className="text-right text-purple-600">{formatCurrency(item.sgst)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                            No B2BUR purchases found for this period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* e-Way Bill Report */}
          {activeReport === 'eway' && ewayData && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500 uppercase">Total Bills</p>
                    <p className="text-2xl font-bold">{ewayData.summary?.total_bills || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-green-600 uppercase">Active</p>
                    <p className="text-2xl font-bold text-green-700">{ewayData.summary?.active_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-red-600 uppercase">Expired</p>
                    <p className="text-2xl font-bold text-red-700">{ewayData.summary?.expired_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-orange-600 uppercase">Pending</p>
                    <p className="text-2xl font-bold text-orange-700">{ewayData.summary?.pending_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-blue-600 uppercase">Total Value</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(ewayData.summary?.total_value || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Active e-Way Bills */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-green-600" />
                    Active e-Way Bills
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>e-Way Bill No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Document No</TableHead>
                        <TableHead>From → To</TableHead>
                        <TableHead>Vehicle No</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ewayData.active_bills?.length > 0 ? ewayData.active_bills.map((bill, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-medium">{bill.eway_bill_no}</TableCell>
                          <TableCell>{bill.date}</TableCell>
                          <TableCell>{bill.document_no}</TableCell>
                          <TableCell>{bill.from_place} → {bill.to_place}</TableCell>
                          <TableCell className="font-mono">{bill.vehicle_no}</TableCell>
                          <TableCell className="text-right">{formatCurrency(bill.total_value)}</TableCell>
                          <TableCell>{bill.valid_until?.split('T')[0]}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            No active e-Way bills found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Pending e-Way Bills */}
              {ewayData.pending_bills?.length > 0 && (
                <Card className="border-orange-200">
                  <CardHeader className="bg-orange-50">
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                      <AlertCircle className="w-5 h-5" />
                      Pending e-Way Bills (Documents ≥ ₹50,000)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-orange-50">
                          <TableHead>Document Type</TableHead>
                          <TableHead>Document No</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Party Name</TableHead>
                          <TableHead>Party GSTIN</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ewayData.pending_bills.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.document_type}</TableCell>
                            <TableCell className="font-medium">{item.document_no}</TableCell>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.party_name}</TableCell>
                            <TableCell className="font-mono text-sm">{item.party_gstin || '-'}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.total_value)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" className="text-orange-600 hover:bg-orange-50">
                                Generate e-Way
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
