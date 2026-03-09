import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { useCurrency } from '../contexts/CurrencyContext';
import { toast } from 'sonner';
import { Calculator, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import {
  EmployeeSelector,
  SalaryInputForm,
  DeductionBreakdown,
  SalarySummary
} from './PayrollCalculator';

export default function PayrollCalculatorPage() {
  const { api } = useAuth();
  const { formatCurrency: globalFormatCurrency } = useCurrency();
  const { t } = useLanguage();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection state
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Salary inputs
  const [totalMonthlySalary, setTotalMonthlySalary] = useState(12000);
  const [dailyAllowanceRate, setDailyAllowanceRate] = useState(100);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(26);
  const [absentDays, setAbsentDays] = useState(0);
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(8);
  const [lateHours, setLateHours] = useState(0);
  
  // Auto-calculation state
  const [autoCalculating, setAutoCalculating] = useState(false);
  // FIX: Initialize as null and use optional chaining for safer access
  const [autoCalculatedData, setAutoCalculatedData] = useState(null);
  
  // Calculations
  const [calculations, setCalculations] = useState({
    workedDays: 26,
    dailyAllowanceDeduction: 2600,
    grossSalary: 9400,
    perDayRate: 313.33,
    absentDeduction: 0,
    salaryAfterAbsence: 9400,
    totalMonthlyHours: 208,
    hourlyRate: 0,
    lateHoursDeduction: 0,
    combinedFinalSalary: 9400,
    salaryToBePaid: 9400,
    finalSalaryHourly: 9400
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    calculateSalary();
  }, [totalMonthlySalary, dailyAllowanceRate, workingDaysPerMonth, absentDays, workingHoursPerDay, lateHours]);

  const fetchEmployees = async () => {
    try {
      const data = await api('/api/employees');
      setEmployees(data);
      if (data.length > 0) {
        setSelectedEmployee(data[0].id);
        if (data[0].salary) {
          setTotalMonthlySalary(data[0].salary);
        }
      }
    } catch (err) {
      // Fallback data for demo
      setEmployees([
        { id: '1', name: 'John Doe', salary: 15000, department: 'Sales' },
        { id: '2', name: 'Jane Smith', salary: 12000, department: 'Operations' },
        { id: '3', name: 'Raj Kumar', salary: 18000, department: 'Management' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const calculateSalary = useCallback(() => {
    const workedDays = Math.max(0, workingDaysPerMonth - absentDays);
    const dailyAllowanceDeduction = dailyAllowanceRate * workingDaysPerMonth;
    const grossSalary = totalMonthlySalary - dailyAllowanceDeduction;
    const perDayRate = grossSalary / 30;
    const absentDeduction = perDayRate * absentDays;
    const salaryAfterAbsence = grossSalary - absentDeduction;
    const totalMonthlyHours = workingDaysPerMonth * workingHoursPerDay;
    const hourlyRate = totalMonthlyHours > 0 ? grossSalary / totalMonthlyHours : 0;
    const lateHoursDeduction = lateHours * hourlyRate;
    const combinedFinalSalary = salaryAfterAbsence - lateHoursDeduction;

    setCalculations({
      workedDays,
      dailyAllowanceDeduction,
      grossSalary,
      perDayRate,
      absentDeduction,
      salaryAfterAbsence: Math.max(0, salaryAfterAbsence),
      totalMonthlyHours,
      hourlyRate,
      lateHoursDeduction,
      combinedFinalSalary: Math.max(0, combinedFinalSalary),
      salaryToBePaid: Math.max(0, combinedFinalSalary),
      finalSalaryHourly: Math.max(0, combinedFinalSalary)
    });
  }, [totalMonthlySalary, dailyAllowanceRate, workingDaysPerMonth, absentDays, workingHoursPerDay, lateHours]);

  const autoCalculateSalary = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    
    setAutoCalculating(true);
    try {
      const result = await api(`/api/salary-calculator/auto-calculate?employee_id=${selectedEmployee}&month=${selectedMonth}&year=${selectedYear}&working_hours_per_day=${workingHoursPerDay}`);
      
      if (result.salary_structure) {
        setTotalMonthlySalary(result.salary_structure.monthly_salary || 0);
        setDailyAllowanceRate(result.salary_structure.daily_allowance_rate || 0);
      }
      if (result.period) {
        setWorkingDaysPerMonth(result.period.working_days_per_month || 26);
        setWorkingHoursPerDay(result.period.working_hours_per_day || 8);
      }
      if (result.attendance) {
        setAbsentDays(result.attendance.absent_days || 0);
        setLateHours(result.attendance.total_late_hours || 0);
      }
      setAutoCalculatedData(result);
      
      const presentDays = result.attendance?.present_days || 0;
      const absentDays = result.attendance?.absent_days || 0;
      const lateHours = result.attendance?.total_late_hours || 0;
      toast.success(`Salary auto-calculated! Found ${presentDays} present days, ${absentDays} absent days, ${lateHours} late hours`);
    } catch (err) {
      toast.error('Failed to auto-calculate: ' + (err.message || 'Unknown error'));
    } finally {
      setAutoCalculating(false);
    }
  };

  const handleEmployeeChange = (employeeId) => {
    setSelectedEmployee(employeeId);
    setAutoCalculatedData(null);
    const emp = employees.find(e => e.id === employeeId);
    if (emp?.salary) {
      setTotalMonthlySalary(emp.salary);
    }
  };

  // Use globalFormatCurrency from context for currency formatting

  const handlePrint = () => {
    window.print();
    toast.success('Printing salary slip...');
  };

  const handleSave = async () => {
    const emp = employees.find(e => e.id === selectedEmployee);
    try {
      await api('/api/payroll', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: selectedEmployee,
          employee_name: emp?.name,
          month: selectedMonth,
          year: selectedYear,
          total_monthly_salary: totalMonthlySalary,
          daily_allowance_rate: dailyAllowanceRate,
          working_days: workingDaysPerMonth,
          absent_days: absentDays,
          working_hours_per_day: workingHoursPerDay,
          late_hours: lateHours,
          gross_salary: calculations.grossSalary,
          total_deductions: calculations.absentDeduction + calculations.lateHoursDeduction,
          net_salary: calculations.combinedFinalSalary,
          status: 'calculated'
        })
      });
      toast.success('Payroll saved successfully!');
    } catch (err) {
      toast.error('Failed to save payroll');
    }
  };

  const handleDownload = () => {
    toast.success('Downloading salary slip as PDF...');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="payroll-calculator-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('salaryCalculator') || 'Salary Calculator'}</h1>
            <p className="text-sm text-muted-foreground">
              Calculate employee salary with absence and hourly deductions
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchEmployees} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Employee & Period Selection */}
      <EmployeeSelector
        employees={employees}
        selectedEmployee={selectedEmployee}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onEmployeeChange={handleEmployeeChange}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        onAutoCalculate={autoCalculateSalary}
        autoCalculating={autoCalculating}
      />

      {/* Auto-calculated data notice */}
      {autoCalculatedData?.period?.month_name && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✓ Auto-calculated from attendance records for {autoCalculatedData.period.month_name} {autoCalculatedData.period.year}
          </p>
        </div>
      )}

      {/* Salary Input Form */}
      <SalaryInputForm
        totalMonthlySalary={totalMonthlySalary}
        dailyAllowanceRate={dailyAllowanceRate}
        workingDaysPerMonth={workingDaysPerMonth}
        absentDays={absentDays}
        workingHoursPerDay={workingHoursPerDay}
        lateHours={lateHours}
        onSalaryChange={setTotalMonthlySalary}
        onAllowanceChange={setDailyAllowanceRate}
        onWorkingDaysChange={setWorkingDaysPerMonth}
        onAbsentDaysChange={setAbsentDays}
        onWorkingHoursChange={setWorkingHoursPerDay}
        onLateHoursChange={setLateHours}
      />

      {/* Deduction Breakdown */}
      <DeductionBreakdown
        calculations={calculations}
        formatCurrency={globalFormatCurrency}
      />

      {/* Final Summary */}
      <SalarySummary
        calculations={calculations}
        formatCurrency={globalFormatCurrency}
        onPrint={handlePrint}
        onSave={handleSave}
        onDownload={handleDownload}
      />
    </div>
  );
}
