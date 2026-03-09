import React from 'react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Users, Calendar, Sparkles, Loader2 } from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function EmployeeSelector({
  employees,
  selectedEmployee,
  selectedMonth,
  selectedYear,
  onEmployeeChange,
  onMonthChange,
  onYearChange,
  onAutoCalculate,
  autoCalculating
}) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Users className="w-5 h-5" />
          Employee & Period Selection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-sm font-medium">Employee</Label>
            <Select value={selectedEmployee} onValueChange={onEmployeeChange}>
              <SelectTrigger data-testid="employee-selector">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} - {emp.department || 'N/A'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-sm font-medium">Month</Label>
            <Select value={String(selectedMonth)} onValueChange={(v) => onMonthChange(parseInt(v))}>
              <SelectTrigger data-testid="month-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(month => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-sm font-medium">Year</Label>
            <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(parseInt(v))}>
              <SelectTrigger data-testid="year-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            <Button
              onClick={onAutoCalculate}
              disabled={autoCalculating || !selectedEmployee}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
              data-testid="auto-calculate-btn"
            >
              {autoCalculating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Auto-Calculate from Attendance
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
