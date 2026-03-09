import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { 
  FileText, DollarSign, TrendingUp, TrendingDown, BarChart3, BookOpen,
  Download, Printer, Calendar, Building2, RefreshCw, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Wallet, Package, Users, Receipt, PieChart,
  Clock, AlertTriangle, RotateCcw, CreditCard
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

// Utility function for currency formatting
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

// Income Statement Report Component
const IncomeStatementReport = ({ data }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  const { revenue, cost_of_goods_sold, gross_profit, operating_expenses, net_profit, profit_margin } = data;
  
  return (
    <div className="space-y-6" data-testid="income-statement-report">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Net Revenue</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(revenue?.net_revenue)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400">Gross Profit</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(gross_profit)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={`${net_profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>Net Profit</p>
                <p className={`text-2xl font-bold ${net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{formatCurrency(net_profit)}</p>
              </div>
              {net_profit >= 0 ? <ArrowUpRight className="w-8 h-8 text-emerald-500" /> : <ArrowDownRight className="w-8 h-8 text-red-500" />}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400">Profit Margin</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{profit_margin}%</p>
              </div>
              <PieChart className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Income Statement Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Revenue Section */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Revenue
              </h3>
              <div className="space-y-2 pl-7">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sales Revenue</span>
                  <span>{formatCurrency(revenue?.sales_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Revenue</span>
                  <span>{formatCurrency(revenue?.invoice_revenue)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Gross Revenue</span>
                  <span>{formatCurrency(revenue?.gross_revenue)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Less: Discounts</span>
                  <span>({formatCurrency(revenue?.discounts)})</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Less: Sales Returns</span>
                  <span>({formatCurrency(revenue?.sales_returns)})</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2 text-green-600">
                  <span>Net Revenue</span>
                  <span>{formatCurrency(revenue?.net_revenue)}</span>
                </div>
              </div>
            </div>

            {/* Cost of Goods Sold */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                Cost of Goods Sold
              </h3>
              <div className="space-y-2 pl-7">
                <div className="flex justify-between">
                  <span className="text-gray-600">Purchases</span>
                  <span>{formatCurrency(cost_of_goods_sold?.purchases)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2 text-orange-600">
                  <span>Total COGS</span>
                  <span>{formatCurrency(cost_of_goods_sold?.total_cogs)}</span>
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="flex justify-between font-bold text-lg text-blue-700 dark:text-blue-300">
                <span>Gross Profit</span>
                <span>{formatCurrency(gross_profit)}</span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-500" />
                Operating Expenses
              </h3>
              <div className="space-y-2 pl-7">
                <div className="flex justify-between">
                  <span className="text-gray-600">Salaries &amp; Wages</span>
                  <span>{formatCurrency(operating_expenses?.salaries_wages)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2 text-red-600">
                  <span>Total Operating Expenses</span>
                  <span>{formatCurrency(operating_expenses?.total_operating_expenses)}</span>
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className={`p-4 rounded-lg ${net_profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className={`flex justify-between font-bold text-xl ${net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                <span>Net Profit / (Loss)</span>
                <span>{formatCurrency(net_profit)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Balance Sheet Report Component
const BalanceSheetReport = ({ data }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  const { assets, liabilities, equity } = data;
  
  return (
    <div className="space-y-6" data-testid="balance-sheet-report">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Assets</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(assets?.total_assets)}</p>
              </div>
              <Wallet className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Total Liabilities</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(liabilities?.total_liabilities)}</p>
              </div>
              <Receipt className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Owner&apos;s Equity</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(equity?.total_equity)}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
            <CardTitle className="text-lg text-blue-700 dark:text-blue-300">Assets</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Current Assets</h4>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between text-sm">
                    <span>Cash</span>
                    <span>{formatCurrency(assets?.current_assets?.cash)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Accounts Receivable</span>
                    <span>{formatCurrency(assets?.current_assets?.accounts_receivable)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Inventory</span>
                    <span>{formatCurrency(assets?.current_assets?.inventory)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>Total Current Assets</span>
                    <span>{formatCurrency(assets?.current_assets?.total_current_assets)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <div className="flex justify-between font-bold text-blue-700 dark:text-blue-300">
                  <span>Total Assets</span>
                  <span>{formatCurrency(assets?.total_assets)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liabilities & Equity */}
        <Card>
          <CardHeader className="bg-red-50 dark:bg-red-900/20">
            <CardTitle className="text-lg text-red-700 dark:text-red-300">Liabilities &amp; Equity</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Current Liabilities</h4>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between text-sm">
                    <span>Accounts Payable</span>
                    <span>{formatCurrency(liabilities?.current_liabilities?.accounts_payable)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sales Tax Payable</span>
                    <span>{formatCurrency(liabilities?.current_liabilities?.sales_tax_payable)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>Total Liabilities</span>
                    <span>{formatCurrency(liabilities?.total_liabilities)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Equity</h4>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between text-sm">
                    <span>Owner&apos;s Capital</span>
                    <span>{formatCurrency(equity?.owners_capital)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>Total Equity</span>
                    <span>{formatCurrency(equity?.total_equity)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <div className="flex justify-between font-bold">
                  <span>Total Liabilities &amp; Equity</span>
                  <span>{formatCurrency(data?.total_liabilities_and_equity)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Cash Flow Statement Component
const CashFlowReport = ({ data }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  const { operating_activities, net_change_in_cash } = data;
  
  return (
    <div className="space-y-6" data-testid="cash-flow-report">
      {/* Summary */}
      <Card className={`${net_change_in_cash >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${net_change_in_cash >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Change in Cash</p>
              <p className={`text-3xl font-bold ${net_change_in_cash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(net_change_in_cash)}
              </p>
            </div>
            {net_change_in_cash >= 0 ? 
              <ArrowUpRight className="w-12 h-12 text-green-500" /> : 
              <ArrowDownRight className="w-12 h-12 text-red-500" />
            }
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash Flow from Operating Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Inflows */}
            <div>
              <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" />
                Cash Inflows
              </h4>
              <div className="space-y-2 pl-6">
                <div className="flex justify-between text-sm">
                  <span>Cash from Sales</span>
                  <span className="text-green-600">{formatCurrency(operating_activities?.inflows?.cash_from_sales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cash from Invoice Collections</span>
                  <span className="text-green-600">{formatCurrency(operating_activities?.inflows?.cash_from_invoices)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Total Inflows</span>
                  <span className="text-green-700">{formatCurrency(operating_activities?.inflows?.total_inflows)}</span>
                </div>
              </div>
            </div>

            {/* Outflows */}
            <div>
              <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4" />
                Cash Outflows
              </h4>
              <div className="space-y-2 pl-6">
                <div className="flex justify-between text-sm">
                  <span>Cash for Purchases</span>
                  <span className="text-red-600">({formatCurrency(operating_activities?.outflows?.cash_for_purchases)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cash for Payroll</span>
                  <span className="text-red-600">({formatCurrency(operating_activities?.outflows?.cash_for_payroll)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cash for Refunds</span>
                  <span className="text-red-600">({formatCurrency(operating_activities?.outflows?.cash_for_refunds)})</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Total Outflows</span>
                  <span className="text-red-700">({formatCurrency(operating_activities?.outflows?.total_outflows)})</span>
                </div>
              </div>
            </div>

            {/* Net Operating */}
            <div className={`p-4 rounded-lg ${operating_activities?.net_operating_cash >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <div className={`flex justify-between font-bold ${operating_activities?.net_operating_cash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                <span>Net Cash from Operating Activities</span>
                <span>{formatCurrency(operating_activities?.net_operating_cash)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Trial Balance Report Component
const TrialBalanceReport = ({ data }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  return (
    <div className="space-y-6" data-testid="trial-balance-report">
      <Card className={data.totals?.is_balanced ? 'border-green-200' : 'border-red-200'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data.totals?.is_balanced ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 text-xl">✓</span>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-600 text-xl">✗</span>
                </div>
              )}
              <div>
                <p className="font-medium">{data.totals?.is_balanced ? 'Trial Balance is Balanced' : 'Trial Balance Out of Balance'}</p>
                <p className="text-sm text-gray-500">As of {new Date(data.as_of_date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                  <th className="text-left p-3 font-medium">Account Code</th>
                  <th className="text-left p-3 font-medium">Account Name</th>
                  <th className="text-right p-3 font-medium">Debit</th>
                  <th className="text-right p-3 font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts?.map((account, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-3 font-mono text-sm">{account.account_code}</td>
                    <td className="p-3">{account.account_name}</td>
                    <td className="p-3 text-right font-mono">{account.debit > 0 ? formatCurrency(account.debit) : '-'}</td>
                    <td className="p-3 text-right font-mono">{account.credit > 0 ? formatCurrency(account.credit) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="p-3" colSpan={2}>Totals</td>
                  <td className="p-3 text-right font-mono">{formatCurrency(data.totals?.total_debits)}</td>
                  <td className="p-3 text-right font-mono">{formatCurrency(data.totals?.total_credits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// General Ledger Report Component
const GeneralLedgerReport = ({ data, selectedAccount, setSelectedAccount }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  const accountOptions = [
    { code: 'all', name: 'All Accounts' },
    { code: '1000', name: 'Cash' },
    { code: '1100', name: 'Accounts Receivable' },
    { code: '1200', name: 'Inventory' },
    { code: '2000', name: 'Accounts Payable' },
    { code: '2200', name: 'Sales Tax Payable' },
    { code: '4000', name: 'Sales Revenue' },
    { code: '5000', name: 'Cost of Goods Sold' },
    { code: '5100', name: 'Salaries & Wages' },
  ];
  
  return (
    <div className="space-y-6" data-testid="general-ledger-report">
      {/* Account Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label>Filter by Account:</Label>
            <Select value={selectedAccount || 'all'} onValueChange={(val) => setSelectedAccount(val === 'all' ? '' : val)}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map(acc => (
                  <SelectItem key={acc.code} value={acc.code}>
                    {acc.code !== 'all' ? `${acc.code} - ${acc.name}` : acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Entries</p>
            <p className="text-2xl font-bold">{data.summary?.total_entries || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Debits</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.summary?.total_debits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Credits</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(data.summary?.total_credits)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Reference</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Account</th>
                  <th className="text-right p-3 font-medium">Debit</th>
                  <th className="text-right p-3 font-medium">Credit</th>
                  <th className="text-right p-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.entries?.slice(0, 100).map((entry, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-3 whitespace-nowrap">{entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                    <td className="p-3 font-mono text-xs">{entry.reference || '-'}</td>
                    <td className="p-3 truncate max-w-[200px]">{entry.description}</td>
                    <td className="p-3">
                      <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {entry.account_code}
                      </span>
                      <span className="ml-2 text-gray-600">{entry.account_name}</span>
                    </td>
                    <td className="p-3 text-right font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                    <td className="p-3 text-right font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(entry.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.entries?.length > 100 && (
              <p className="text-center py-4 text-gray-500">Showing first 100 of {data.entries.length} entries</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// AR Aging Report Component
const ARAgingReport = ({ data }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  const { aging_buckets, customer_aging, summary } = data;
  
  const bucketLabels = {
    current: 'Current (0-30 days)',
    '31_60': '31-60 days',
    '61_90': '61-90 days',
    over_90: 'Over 90 days'
  };
  
  const bucketColors = {
    current: 'bg-green-100 text-green-700 border-green-200',
    '31_60': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    '61_90': 'bg-orange-100 text-orange-700 border-orange-200',
    over_90: 'bg-red-100 text-red-700 border-red-200'
  };
  
  return (
    <div className="space-y-6" data-testid="ar-aging-report">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Receivables</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(summary?.total_receivables)}</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Invoices</p>
            <p className="text-2xl font-bold">{summary?.total_invoices || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-green-600">Current</p>
            <p className="text-2xl font-bold text-green-700">{summary?.current_percentage || 0}%</p>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-red-600">Overdue</p>
            <p className="text-2xl font-bold text-red-700">{summary?.overdue_percentage || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Buckets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Aging Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(aging_buckets || {}).map(([key, bucket]) => (
              <div key={key} className={`p-4 rounded-lg border ${bucketColors[key]}`}>
                <p className="text-sm font-medium">{bucketLabels[key]}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(bucket.total)}</p>
                <p className="text-xs mt-1">{bucket.count} invoice(s)</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customer Aging Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Aging Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-right p-3 font-medium">Current</th>
                  <th className="text-right p-3 font-medium">31-60</th>
                  <th className="text-right p-3 font-medium">61-90</th>
                  <th className="text-right p-3 font-medium">90+</th>
                  <th className="text-right p-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {customer_aging?.slice(0, 20).map((customer, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{customer.customer_name}</td>
                    <td className="p-3 text-right text-green-600">{customer.current > 0 ? formatCurrency(customer.current) : '-'}</td>
                    <td className="p-3 text-right text-yellow-600">{customer['31_60'] > 0 ? formatCurrency(customer['31_60']) : '-'}</td>
                    <td className="p-3 text-right text-orange-600">{customer['61_90'] > 0 ? formatCurrency(customer['61_90']) : '-'}</td>
                    <td className="p-3 text-right text-red-600">{customer.over_90 > 0 ? formatCurrency(customer.over_90) : '-'}</td>
                    <td className="p-3 text-right font-bold">{formatCurrency(customer.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!customer_aging || customer_aging.length === 0) && (
              <p className="text-center py-8 text-gray-500">No outstanding receivables</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// AP Aging Report Component
const APAgingReport = ({ data }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  const { aging_buckets, supplier_aging, summary } = data;
  
  const bucketLabels = {
    current: 'Current (0-30 days)',
    '31_60': '31-60 days',
    '61_90': '61-90 days',
    over_90: 'Over 90 days'
  };
  
  const bucketColors = {
    current: 'bg-green-100 text-green-700 border-green-200',
    '31_60': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    '61_90': 'bg-orange-100 text-orange-700 border-orange-200',
    over_90: 'bg-red-100 text-red-700 border-red-200'
  };
  
  return (
    <div className="space-y-6" data-testid="ap-aging-report">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Total Payables</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(summary?.total_payables)}</p>
              </div>
              <Receipt className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Invoices</p>
            <p className="text-2xl font-bold">{summary?.total_invoices || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-green-600">Current</p>
            <p className="text-2xl font-bold text-green-700">{summary?.current_percentage || 0}%</p>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <p className="text-sm text-orange-600">Overdue</p>
            <p className="text-2xl font-bold text-orange-700">{summary?.overdue_percentage || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Buckets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Aging Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(aging_buckets || {}).map(([key, bucket]) => (
              <div key={key} className={`p-4 rounded-lg border ${bucketColors[key]}`}>
                <p className="text-sm font-medium">{bucketLabels[key]}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(bucket.total)}</p>
                <p className="text-xs mt-1">{bucket.count} invoice(s)</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Supplier Aging Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supplier Aging Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Supplier</th>
                  <th className="text-right p-3 font-medium">Current</th>
                  <th className="text-right p-3 font-medium">31-60</th>
                  <th className="text-right p-3 font-medium">61-90</th>
                  <th className="text-right p-3 font-medium">90+</th>
                  <th className="text-right p-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {supplier_aging?.slice(0, 20).map((supplier, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{supplier.supplier_name}</td>
                    <td className="p-3 text-right text-green-600">{supplier.current > 0 ? formatCurrency(supplier.current) : '-'}</td>
                    <td className="p-3 text-right text-yellow-600">{supplier['31_60'] > 0 ? formatCurrency(supplier['31_60']) : '-'}</td>
                    <td className="p-3 text-right text-orange-600">{supplier['61_90'] > 0 ? formatCurrency(supplier['61_90']) : '-'}</td>
                    <td className="p-3 text-right text-red-600">{supplier.over_90 > 0 ? formatCurrency(supplier.over_90) : '-'}</td>
                    <td className="p-3 text-right font-bold">{formatCurrency(supplier.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!supplier_aging || supplier_aging.length === 0) && (
              <p className="text-center py-8 text-gray-500">No outstanding payables</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Expense Report Component
const ExpenseReport = ({ data }) => {
  if (!data) return <div className="text-center py-8">Loading...</div>;
  
  const { categories, monthly_breakdown, summary } = data;
  
  const categoryIcons = {
    purchases: Package,
    payroll: Users,
    refunds: RotateCcw,
    taxes: Receipt,
    other: FileText
  };
  
  const categoryColors = {
    purchases: 'bg-blue-100 text-blue-700 border-blue-200',
    payroll: 'bg-purple-100 text-purple-700 border-purple-200',
    refunds: 'bg-red-100 text-red-700 border-red-200',
    taxes: 'bg-orange-100 text-orange-700 border-orange-200',
    other: 'bg-gray-100 text-gray-700 border-gray-200'
  };
  
  return (
    <div className="space-y-6" data-testid="expense-report">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Total Expenses</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(summary?.total_expenses)}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-2xl font-bold">{summary?.total_transactions || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Monthly Average</p>
            <p className="text-2xl font-bold">{formatCurrency(summary?.average_monthly)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expense Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {categories && Object.entries(categories).map(([key, cat]) => {
              const Icon = categoryIcons[key] || FileText;
              return (
                <div key={key} className={`p-4 rounded-lg border ${categoryColors[key]}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(cat.total)}</p>
                  <div className="flex justify-between mt-2 text-xs">
                    <span>{cat.transaction_count} txns</span>
                    <span>{cat.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      {monthly_breakdown && monthly_breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium">Month</th>
                    <th className="text-right p-3 font-medium">Purchases</th>
                    <th className="text-right p-3 font-medium">Payroll</th>
                    <th className="text-right p-3 font-medium">Refunds</th>
                    <th className="text-right p-3 font-medium">Taxes</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly_breakdown.map((month, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{month.month}</td>
                      <td className="p-3 text-right text-blue-600">{month.purchases > 0 ? formatCurrency(month.purchases) : '-'}</td>
                      <td className="p-3 text-right text-purple-600">{month.payroll > 0 ? formatCurrency(month.payroll) : '-'}</td>
                      <td className="p-3 text-right text-red-600">{month.refunds > 0 ? formatCurrency(month.refunds) : '-'}</td>
                      <td className="p-3 text-right text-orange-600">{month.taxes > 0 ? formatCurrency(month.taxes) : '-'}</td>
                      <td className="p-3 text-right font-bold">{formatCurrency(month.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Main Component
export default function AccountingReportsPage() {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('income-statement');
  const [date, setDate] = useState(false);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Report data
  // Fix: avoid initializing with `null` to prevent a "flash" from a null/empty UI to a populated UI.
  // Use stable empty defaults and a loaded flag to control when the final UI should render.
  const [incomeStatement, setIncomeStatement] = useState({});
  const [balanceSheet, setBalanceSheet] = useState({});
  const [cashFlow, setCashFlow] = useState({});
  const [trialBalance, setTrialBalance] = useState({});
  const [generalLedger, setGeneralLedger] = useState([]);
  const [arAging, setArAging] = useState([]);
  const [apAging, setApAging] = useState([]);
  const [expenseReport, setExpenseReport] = useState([]);
  const [isReportsLoaded, setIsReportsLoaded] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');

  const fetchStores = useCallback(async () => {
    try {
      const data = await api('/api/stores');
      setStores(data);
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    }
  }, [api]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = selectedStore ? `&store_id=${selectedStore}` : '';
      
      switch (activeTab) {
        case 'income-statement':
          const incomeData = await api(`/api/accounting/income-statement?start_date=${startDate}&end_date=${endDate}${storeParam}`);
          setIncomeStatement(incomeData);
          break;
        case 'balance-sheet':
          const balanceData = await api(`/api/accounting/balance-sheet?as_of_date=${asOfDate}${storeParam}`);
          setBalanceSheet(balanceData);
          break;
        case 'cash-flow':
          const cashData = await api(`/api/accounting/cash-flow?start_date=${startDate}&end_date=${endDate}${storeParam}`);
          setCashFlow(cashData);
          break;
        case 'trial-balance':
          const trialData = await api(`/api/accounting/trial-balance?as_of_date=${asOfDate}${storeParam}`);
          setTrialBalance(trialData);
          break;
        case 'general-ledger':
          const accountParam = selectedAccount ? `&account_code=${selectedAccount}` : '';
          const ledgerData = await api(`/api/accounting/general-ledger?start_date=${startDate}&end_date=${endDate}${storeParam}${accountParam}`);
          setGeneralLedger(ledgerData);
          break;
        case 'ar-aging':
          const arData = await api(`/api/accounting/ar-aging?as_of_date=${asOfDate}${storeParam}`);
          setArAging(arData);
          break;
        case 'ap-aging':
          const apData = await api(`/api/accounting/ap-aging?as_of_date=${asOfDate}${storeParam}`);
          setApAging(apData);
          break;
        case 'expense-report':
          const expenseData = await api(`/api/accounting/expense-report?start_date=${startDate}&end_date=${endDate}${storeParam}`);
          setExpenseReport(expenseData);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [api, activeTab, startDate, endDate, asOfDate, selectedStore, selectedAccount]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    let data;
    let filename;
    
    switch (activeTab) {
      case 'income-statement':
        data = incomeStatement;
        filename = `income-statement-${startDate}-${endDate}.json`;
        break;
      case 'balance-sheet':
        data = balanceSheet;
        filename = `balance-sheet-${asOfDate}.json`;
        break;
      case 'cash-flow':
        data = cashFlow;
        filename = `cash-flow-${startDate}-${endDate}.json`;
        break;
      case 'trial-balance':
        data = trialBalance;
        filename = `trial-balance-${asOfDate}.json`;
        break;
      case 'general-ledger':
        data = generalLedger;
        filename = `general-ledger-${startDate}-${endDate}.json`;
        break;
      case 'ar-aging':
        data = arAging;
        filename = `ar-aging-${asOfDate}.json`;
        break;
      case 'ap-aging':
        data = apAging;
        filename = `ap-aging-${asOfDate}.json`;
        break;
      case 'expense-report':
        data = expenseReport;
        filename = `expense-report-${startDate}-${endDate}.json`;
        break;
      default:
        return;
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-testid="accounting-reports-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Accounting Reports
          </h1>
          <p className="text-gray-500 text-sm mt-1">Financial statements and reports</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Store Filter */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-gray-500 mb-1 block">Store</Label>
              <Select value={selectedStore || 'all'} onValueChange={(val) => setSelectedStore(val === 'all' ? '' : val)}>
                <SelectTrigger>
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filters - Show different based on report type */}
            {(activeTab === 'balance-sheet' || activeTab === 'trial-balance' || activeTab === 'ar-aging' || activeTab === 'ap-aging') ? (
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-gray-500 mb-1 block">As of Date</Label>
                <Input 
                  type="date" 
                  value={asOfDate} 
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs text-gray-500 mb-1 block">Start Date</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs text-gray-500 mb-1 block">End Date</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Quick Date Presets */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                  setAsOfDate(today.toISOString().split('T')[0]);
                }}
              >
                This Month
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), 0, 1);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                  setAsOfDate(today.toISOString().split('T')[0]);
                }}
              >
                This Year
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full mb-6 h-auto">
          <TabsTrigger value="income-statement" className="flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3 hidden md:block" />
            P&amp;L
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-1 text-xs">
            <BarChart3 className="w-3 h-3 hidden md:block" />
            Balance
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="flex items-center gap-1 text-xs">
            <DollarSign className="w-3 h-3 hidden md:block" />
            Cash
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="flex items-center gap-1 text-xs">
            <FileText className="w-3 h-3 hidden md:block" />
            Trial
          </TabsTrigger>
          <TabsTrigger value="general-ledger" className="flex items-center gap-1 text-xs">
            <BookOpen className="w-3 h-3 hidden md:block" />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="ar-aging" className="flex items-center gap-1 text-xs">
            <CreditCard className="w-3 h-3 hidden md:block" />
            AR
          </TabsTrigger>
          <TabsTrigger value="ap-aging" className="flex items-center gap-1 text-xs">
            <Receipt className="w-3 h-3 hidden md:block" />
            AP
          </TabsTrigger>
          <TabsTrigger value="expense-report" className="flex items-center gap-1 text-xs">
            <TrendingDown className="w-3 h-3 hidden md:block" />
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement">
          <IncomeStatementReport data={incomeStatement} />
        </TabsContent>
        
        <TabsContent value="balance-sheet">
          <BalanceSheetReport data={balanceSheet} />
        </TabsContent>
        
        <TabsContent value="cash-flow">
          <CashFlowReport data={cashFlow} />
        </TabsContent>
        
        <TabsContent value="trial-balance">
          <TrialBalanceReport data={trialBalance} />
        </TabsContent>
        
        <TabsContent value="general-ledger">
          <GeneralLedgerReport 
            data={generalLedger} 
            selectedAccount={selectedAccount}
            setSelectedAccount={setSelectedAccount}
          />
        </TabsContent>
        
        <TabsContent value="ar-aging">
          <ARAgingReport data={arAging} />
        </TabsContent>
        
        <TabsContent value="ap-aging">
          <APAgingReport data={apAging} />
        </TabsContent>
        
        <TabsContent value="expense-report">
          <ExpenseReport data={expenseReport} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
