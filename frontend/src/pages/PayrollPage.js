import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { useReAuth } from '../components/ReAuthProvider';
import { toast } from 'sonner';
import { Wallet, Calculator, FileText, Check, Clock, XCircle, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

export default function PayrollPage({ onNavigate }) {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const { requireSensitiveAuth } = useReAuth();
  const [payroll, setPayroll] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payrollData, empData] = await Promise.all([
        api(`/api/payroll?month=${selectedMonth}&year=${selectedYear}`),
        api('/api/employees'),
      ]);
      setPayroll(payrollData);
      setEmployees(empData);
    } catch (err) {
      toast.error('Failed to load payroll');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]);

  const updateStatus = (payrollId, status) => {
    const pr = payroll.find(p => p.id === payrollId);
    const statusLabel = status === 'paid' ? 'Mark as Paid' : 'Process';
    requireSensitiveAuth(
      'payroll',
      `${statusLabel} payroll for ${pr?.employee_name || 'employee'}? Net amount: ${currencySymbol}${(pr?.net_salary || 0).toLocaleString()}`,
      async () => {
        try {
          await api(`/api/payroll/${payrollId}/status?status=${status}`, { method: 'PUT' });
          toast.success(`Payroll marked as ${status}`);
          fetchData();
        } catch (err) {
          toast.error(err.message);
        }
      }
    );
  };

  const getEmployeePayroll = (empId) => payroll.find(p => p.employee_id === empId);

  const statusConfig = {
    calculated: { icon: Calculator, class: 'bg-amber-100 text-amber-700', label: 'Calculated' },
    draft: { icon: FileText, class: 'bg-gray-100 text-gray-700', label: 'Draft' },
    processed: { icon: Clock, class: 'bg-blue-100 text-blue-700', label: 'Processed' },
    paid: { icon: Check, class: 'bg-emerald-100 text-emerald-700', label: 'Paid' },
  };

  // Summary - use 'deductions' field from calculator
  const totalGross = payroll.reduce((sum, p) => sum + (p.gross_salary || 0), 0);
  const totalNet = payroll.reduce((sum, p) => sum + (p.net_salary || 0), 0);
  const totalDeductions = payroll.reduce((sum, p) => sum + (p.deductions || p.total_deductions || 0), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6" data-testid="payroll-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Payroll Management
          </h1>
          <p className="text-muted-foreground">View and manage employee payroll from Salary Calculator</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => onNavigate && onNavigate('salary-calculator')}>
            <Plus className="w-4 h-4 mr-2" /> New Calculation
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="space-y-2">
          <Label>Month</Label>
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Gross</p>
                <p className="text-2xl font-bold text-blue-600">{currencySymbol}{formatCurrency(totalGross)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-400 to-red-600 shadow-lg">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deductions</p>
                <p className="text-2xl font-bold text-red-600">{currencySymbol}{formatCurrency(totalDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Net Payable</p>
                <p className="text-2xl font-bold text-emerald-600">{currencySymbol}{formatCurrency(totalNet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : payroll.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calculator className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Payroll Records</h3>
            <p className="text-muted-foreground mb-4">
              No payroll has been calculated for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </p>
            <Button onClick={() => onNavigate && onNavigate('salary-calculator')}>
              <Calculator className="w-4 h-4 mr-2" /> Go to Salary Calculator
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">Working Days</TableHead>
                <TableHead className="text-center">Absent Days</TableHead>
                <TableHead className="text-right">Gross Salary</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Salary</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payroll.map((pr) => {
                const config = statusConfig[pr.status] || statusConfig.calculated;
                const workedDays = (pr.working_days || 26) - (pr.absent_days || 0);
                return (
                  <TableRow key={pr.id}>
                    <TableCell>
                      <div className="font-medium">{pr.employee_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">
                        Total Salary: {currencySymbol}{formatCurrency(pr.total_salary)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium text-green-600">{workedDays}</span>
                      <span className="text-muted-foreground">/{pr.working_days || 26}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {pr.absent_days > 0 ? (
                        <Badge variant="destructive" className="font-mono">
                          {pr.absent_days} days
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Full
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-blue-600">
                      {currencySymbol}{formatCurrency(pr.gross_salary)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-red-600">
                      {(pr.deductions || 0) > 0 ? `-${currencySymbol}${formatCurrency(pr.deductions)}` : `${currencySymbol}0.00`}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600">
                      {currencySymbol}{formatCurrency(pr.net_salary)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={config.class}>{config.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pr.status === 'calculated' || pr.status === 'draft' ? (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(pr.id, 'processed')}>
                          Process
                        </Button>
                      ) : pr.status === 'processed' ? (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(pr.id, 'paid')}>
                          Mark Paid
                        </Button>
                      ) : (
                        <span className="text-sm text-emerald-600 font-medium flex items-center gap-1 justify-end">
                          <Check className="w-4 h-4" /> Paid
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Info Note */}
      {payroll.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          <p>Payroll records are created from the <strong>Salary Calculator</strong>. Click "New Calculation" to add more.</p>
        </div>
      )}
    </div>
  );
}
