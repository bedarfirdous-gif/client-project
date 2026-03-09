import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { TrendingDown, Clock } from 'lucide-react';

export default function DeductionBreakdown({ calculations, formatCurrency }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Absence-Based Deductions */}
      <Card className="shadow-md border-l-4 border-l-orange-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-orange-600">
            <TrendingDown className="w-5 h-5" />
            Absence Deductions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Daily Allowance Deduction</span>
            <span className="font-semibold text-orange-600">
              -{formatCurrency(calculations.dailyAllowanceDeduction)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Per Day Rate (Gross/30)</span>
            <span className="font-medium">{formatCurrency(calculations.perDayRate)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Absent Days Deduction</span>
            <span className="font-semibold text-red-600">
              -{formatCurrency(calculations.absentDeduction)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 bg-orange-50 dark:bg-orange-900/20 px-3 rounded-lg">
            <span className="font-medium">Salary After Absence</span>
            <span className="text-xl font-bold text-orange-700 dark:text-orange-400">
              {formatCurrency(calculations.salaryAfterAbsence)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Hourly-Based Deductions */}
      <Card className="shadow-md border-l-4 border-l-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-purple-600">
            <Clock className="w-5 h-5" />
            Hourly Deductions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Total Monthly Hours</span>
            <span className="font-medium">{calculations.totalMonthlyHours} hrs</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Hourly Rate</span>
            <span className="font-medium">{formatCurrency(calculations.hourlyRate)}/hr</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Late Hours Deduction</span>
            <span className="font-semibold text-red-600">
              -{formatCurrency(calculations.lateHoursDeduction)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 bg-purple-50 dark:bg-purple-900/20 px-3 rounded-lg">
            <span className="font-medium">After Hourly Deduction</span>
            <span className="text-xl font-bold text-purple-700 dark:text-purple-400">
              {formatCurrency(calculations.salaryAfterAbsence - calculations.lateHoursDeduction)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
