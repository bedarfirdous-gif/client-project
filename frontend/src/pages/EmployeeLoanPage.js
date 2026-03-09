import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { useReAuth } from '../components/ReAuthProvider';
import { toast } from 'sonner';
import { 
  Banknote, Users, Clock, Check, X, AlertCircle, 
  Plus, RefreshCw, Calendar, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';

export default function EmployeeLoanPage() {
  const { api } = useAuth();
  const { currencySymbol } = useCurrency();
  const { requireSensitiveAuth } = useReAuth();
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewLoanDialog, setShowNewLoanDialog] = useState(false);
  const [showRepaymentDialog, setShowRepaymentDialog] = useState(false);

  // Fix: avoid null-initialized state that can cause a visual flash when UI switches
  // from "nothing" (null) to "something" (object) during the first async update.
  // Use stable defaults + explicit flags to represent absence/loading.
  const [selectedLoan, setSelectedLoan] = useState({});
  const [hasSelectedLoan, setHasSelectedLoan] = useState(false);

  const [eligibility, setEligibility] = useState({});
  const [isEligibilityLoaded, setIsEligibilityLoaded] = useState(false);

  const [expandedLoans, setExpandedLoans] = useState({});
  
  const [newLoan, setNewLoan] = useState({
    employee_id: '',
    amount: '',
    reason: '',
    repayment_method: 'auto_deduct',
    repayment_months: 3
  });
  
  const [repayment, setRepayment] = useState({
    amount: '',
    notes: ''
  });

  const statusConfig = {
    pending: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending Approval' },
    approved: { color: 'bg-blue-100 text-blue-700', icon: Check, label: 'Approved' },
    active: { color: 'bg-green-100 text-green-700', icon: Banknote, label: 'Active' },
    completed: { color: 'bg-gray-100 text-gray-700', icon: Check, label: 'Completed' },
    rejected: { color: 'bg-red-100 text-red-700', icon: X, label: 'Rejected' }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loansData, empData] = await Promise.all([
        api('/api/loans'),
        api('/api/employees')
      ]);
      setLoans(loansData);
      setEmployees(empData.filter(e => e.is_active !== false));
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const checkEligibility = async (employeeId) => {
    if (!employeeId) {
      setEligibility(null);
      return;
    }
    try {
      const data = await api(`/api/employees/${employeeId}/loan-eligibility`);
      setEligibility(data);
    } catch (err) {
      setEligibility(null);
    }
  };

  const handleEmployeeSelect = (employeeId) => {
    setNewLoan({ ...newLoan, employee_id: employeeId });
    checkEligibility(employeeId);
  };

  const handleSubmitLoan = async () => {
    if (!newLoan.employee_id || !newLoan.amount) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      await api(`/api/employees/${newLoan.employee_id}/loans`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(newLoan.amount),
          reason: newLoan.reason,
          repayment_method: newLoan.repayment_method,
          repayment_months: parseInt(newLoan.repayment_months)
        })
      });
      toast.success('Loan request submitted successfully');
      setShowNewLoanDialog(false);
      setNewLoan({ employee_id: '', amount: '', reason: '', repayment_method: 'auto_deduct', repayment_months: 3 });
      setEligibility(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit loan request');
    }
  };

  const handleApproveLoan = (loanId) => {
    const loan = loans.find(l => l.id === loanId);
    requireSensitiveAuth(
      'approve_loan',
      `Approve loan of ${currencySymbol}${loan?.amount?.toLocaleString()} for ${loan?.employee_name}?`,
      async () => {
        try {
          await api(`/api/loans/${loanId}/approve`, { method: 'PUT' });
          toast.success('Loan approved successfully');
          fetchData();
        } catch (err) {
          toast.error(err.message || 'Failed to approve loan');
        }
      }
    );
  };

  const handleRejectLoan = (loanId) => {
    const loan = loans.find(l => l.id === loanId);
    requireSensitiveAuth(
      'approve_loan',
      `Reject loan request of ${currencySymbol}${loan?.amount?.toLocaleString()} from ${loan?.employee_name}?`,
      async () => {
        try {
          await api(`/api/loans/${loanId}/reject`, { method: 'PUT' });
          toast.success('Loan rejected');
          fetchData();
        } catch (err) {
          toast.error(err.message || 'Failed to reject loan');
        }
      }
    );
  };

  const handleSubmitRepayment = async () => {
    if (!selectedLoan || !repayment.amount) {
      toast.error('Please enter repayment amount');
      return;
    }
    
    try {
      await api(`/api/loans/${selectedLoan.id}/repayment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(repayment.amount),
          notes: repayment.notes
        })
      });
      toast.success('Repayment recorded successfully');
      setShowRepaymentDialog(false);
      setSelectedLoan(null);
      setRepayment({ amount: '', notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to record repayment');
    }
  };

  const toggleLoanExpand = (loanId) => {
    setExpandedLoans(prev => ({ ...prev, [loanId]: !prev[loanId] }));
  };

  const formatCurrency = (amount) => `${currencySymbol}${(amount || 0).toLocaleString('en-IN')}`;
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-IN') : '-';

  // Summary stats
  const totalActive = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + (l.remaining_amount || 0), 0);
  const pendingLoans = loans.filter(l => l.status === 'pending').length;
  const activeLoans = loans.filter(l => l.status === 'active').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="employee-loan-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" />
            Employee Loan Management
          </h1>
          <p className="text-muted-foreground">Manage employee loans with 0% interest (Max {currencySymbol}10,000)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowNewLoanDialog(true)} data-testid="new-loan-btn">
            <Plus className="w-4 h-4 mr-2" /> New Loan Request
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold text-amber-600">{pendingLoans}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Loans</p>
                <p className="text-2xl font-bold text-green-600">{activeLoans}</p>
              </div>
              <Banknote className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Amount</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalActive)}</p>
              </div>
              <FileText className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loans List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Loans ({loans.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Banknote className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No loan requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {loans.map(loan => {
                const config = statusConfig[loan.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                const isExpanded = expandedLoans[loan.id];
                
                return (
                  <Collapsible key={loan.id} open={isExpanded} onOpenChange={() => toggleLoanExpand(loan.id)}>
                    <div className="border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                            {loan.employee_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold">{loan.employee_name}</p>
                            <p className="text-sm text-muted-foreground">{loan.employee_code}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg">{formatCurrency(loan.amount)}</p>
                            {loan.status === 'active' && (
                              <p className="text-xs text-muted-foreground">
                                Remaining: {formatCurrency(loan.remaining_amount)}
                              </p>
                            )}
                          </div>
                          
                          <Badge className={config.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      
                      <CollapsibleContent>
                        <div className="mt-4 pt-4 border-t space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Repayment Method</p>
                              <p className="font-medium">
                                {loan.repayment_method === 'auto_deduct' ? 'Auto Salary Deduction' : 'Manual'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">EMI Amount</p>
                              <p className="font-medium">{formatCurrency(loan.emi_amount)}/month</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Duration</p>
                              <p className="font-medium">{loan.repayment_months} months</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Requested On</p>
                              <p className="font-medium">{formatDate(loan.created_at)}</p>
                            </div>
                          </div>
                          
                          {loan.reason && (
                            <div>
                              <p className="text-sm text-muted-foreground">Reason</p>
                              <p className="text-sm">{loan.reason}</p>
                            </div>
                          )}
                          
                          {/* Repayment History */}
                          {loan.repayments?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Repayment History</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Notes</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {loan.repayments.map((rep, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{formatDate(rep.date)}</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(rep.amount)}</TableCell>
                                      <TableCell>{rep.method}</TableCell>
                                      <TableCell>{rep.notes || '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {loan.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleApproveLoan(loan.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="w-4 h-4 mr-1" /> Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleRejectLoan(loan.id)}
                                >
                                  <X className="w-4 h-4 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {loan.status === 'active' && loan.repayment_method === 'manual' && (
                              <Button 
                                size="sm" 
                                onClick={() => { setSelectedLoan(loan); setShowRepaymentDialog(true); }}
                              >
                                <Banknote className="w-4 h-4 mr-1" /> Record Repayment
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Loan Dialog */}
      <Dialog open={showNewLoanDialog} onOpenChange={setShowNewLoanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              New Loan Request
            </DialogTitle>
            <DialogDescription>
              Interest-free loans up to {currencySymbol}10,000 for eligible employees (2+ years service)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Employee *</Label>
              <Select value={newLoan.employee_id} onValueChange={handleEmployeeSelect}>
                <SelectTrigger data-testid="loan-employee-select">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Eligibility Status */}
            {eligibility && (
              <div className={`p-3 rounded-lg ${eligibility.eligible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-start gap-2">
                  {eligibility.eligible ? (
                    <Check className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${eligibility.eligible ? 'text-green-800' : 'text-red-800'}`}>
                      {eligibility.eligible ? 'Eligible for Loan' : 'Not Eligible'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Service: {eligibility.years_of_service} years
                    </p>
                    {eligibility.eligible && (
                      <p className="text-sm text-green-700">
                        Max available: {formatCurrency(eligibility.available_loan_amount)}
                      </p>
                    )}
                    {eligibility.reason && (
                      <p className="text-sm text-red-600">{eligibility.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Loan Amount ({currencySymbol}) *</Label>
              <Input
                type="number"
                placeholder={`Enter amount (max ${currencySymbol}10,000)`}
                value={newLoan.amount}
                onChange={(e) => setNewLoan({ ...newLoan, amount: e.target.value })}
                max={eligibility?.available_loan_amount || 10000}
                data-testid="loan-amount-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Repayment Method</Label>
              <Select 
                value={newLoan.repayment_method} 
                onValueChange={(v) => setNewLoan({ ...newLoan, repayment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_deduct">Auto Deduct from Salary</SelectItem>
                  <SelectItem value="manual">Manual Repayment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Repayment Duration (Months)</Label>
              <Select 
                value={String(newLoan.repayment_months)} 
                onValueChange={(v) => setNewLoan({ ...newLoan, repayment_months: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Month</SelectItem>
                  <SelectItem value="2">2 Months</SelectItem>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Reason for loan request"
                value={newLoan.reason}
                onChange={(e) => setNewLoan({ ...newLoan, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLoanDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmitLoan}
              disabled={!eligibility?.eligible || !newLoan.amount}
              data-testid="submit-loan-btn"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repayment Dialog */}
      <Dialog open={showRepaymentDialog} onOpenChange={setShowRepaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Repayment</DialogTitle>
            <DialogDescription>
              Remaining balance: {formatCurrency(selectedLoan?.remaining_amount)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Repayment Amount ({currencySymbol}) *</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={repayment.amount}
                onChange={(e) => setRepayment({ ...repayment, amount: e.target.value })}
                max={selectedLoan?.remaining_amount}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes"
                value={repayment.notes}
                onChange={(e) => setRepayment({ ...repayment, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRepaymentDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitRepayment}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
