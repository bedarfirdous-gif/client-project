import React from 'react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { DollarSign, Calendar, Clock } from 'lucide-react';
import { useCurrency } from '../../contexts/CurrencyContext';

export default function SalaryInputForm({
  totalMonthlySalary,
  dailyAllowanceRate,
  workingDaysPerMonth,
  absentDays,
  workingHoursPerDay,
  lateHours,
  onSalaryChange,
  onAllowanceChange,
  onWorkingDaysChange,
  onAbsentDaysChange,
  onWorkingHoursChange,
  onLateHoursChange
}) {
  const { currencySymbol } = useCurrency();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Salary & Allowance */}
      <Card className="shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-green-600" />
            Salary Structure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Total Monthly Salary ({currencySymbol})</Label>
            <Input
              type="number"
              value={totalMonthlySalary}
              onChange={(e) => onSalaryChange(parseFloat(e.target.value) || 0)}
              className="mt-1"
              data-testid="monthly-salary-input"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Daily Allowance Rate ({currencySymbol}/day)</Label>
            <Input
              type="number"
              value={dailyAllowanceRate}
              onChange={(e) => onAllowanceChange(parseFloat(e.target.value) || 0)}
              className="mt-1"
              data-testid="daily-allowance-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Attendance & Hours */}
      <Card className="shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-blue-600" />
            Attendance & Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Working Days/Month</Label>
              <Input
                type="number"
                value={workingDaysPerMonth}
                onChange={(e) => onWorkingDaysChange(parseInt(e.target.value) || 0)}
                className="mt-1"
                data-testid="working-days-input"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Absent Days</Label>
              <Input
                type="number"
                value={absentDays}
                onChange={(e) => onAbsentDaysChange(parseInt(e.target.value) || 0)}
                className="mt-1"
                data-testid="absent-days-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Hours/Day
              </Label>
              <Input
                type="number"
                value={workingHoursPerDay}
                onChange={(e) => onWorkingHoursChange(parseInt(e.target.value) || 0)}
                className="mt-1"
                data-testid="working-hours-input"
              />
            </div>
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-red-500" /> Late Hours
              </Label>
              <Input
                type="number"
                step="0.5"
                value={lateHours}
                onChange={(e) => onLateHoursChange(parseFloat(e.target.value) || 0)}
                className="mt-1"
                data-testid="late-hours-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
