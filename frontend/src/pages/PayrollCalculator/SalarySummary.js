import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { CheckCircle, Printer, Download, Save } from 'lucide-react';
import { CurrencyIcon } from '../../components/CurrencyIcon';

export default function SalarySummary({
  calculations,
  formatCurrency,
  onPrint,
  onSave,
  onDownload
}) {
  return (
    <Card className="shadow-xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-green-700 dark:text-green-400">
          <CheckCircle className="w-6 h-6" />
          Final Salary Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Gross Salary */}
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow">
            <div className="text-sm text-muted-foreground mb-1">Gross Salary</div>
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">
              {formatCurrency(calculations.grossSalary)}
            </div>
          </div>

          {/* Total Deductions */}
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow">
            <div className="text-sm text-muted-foreground mb-1">Total Deductions</div>
            <div className="text-2xl font-bold text-red-600">
              -{formatCurrency(calculations.absentDeduction + calculations.lateHoursDeduction)}
            </div>
          </div>

          {/* Final Salary */}
          <div className="text-center p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow">
            <div className="text-sm text-white/80 mb-1">Final Salary to Pay</div>
            <div className="text-3xl font-bold text-white flex items-center justify-center gap-2">
              <CurrencyIcon className="w-7 h-7" />
              {formatCurrency(calculations.combinedFinalSalary)}
            </div>
          </div>
        </div>

        {/* Calculation Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">Calculation Breakdown</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Worked Days:</span>
              <span className="ml-2 font-medium">{calculations.workedDays} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Absent Days:</span>
              <span className="ml-2 font-medium text-orange-600">
                {calculations.workedDays > 0 ? calculations.totalMonthlyHours / calculations.workedDays * (calculations.workedDays - calculations.workedDays) / (calculations.totalMonthlyHours / calculations.workedDays) : 0} days
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Late Hours:</span>
              <span className="ml-2 font-medium text-purple-600">
                {(calculations.lateHoursDeduction / calculations.hourlyRate || 0).toFixed(1)} hrs
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Hourly Rate:</span>
              <span className="ml-2 font-medium">{formatCurrency(calculations.hourlyRate)}/hr</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-end">
          <Button variant="outline" onClick={onPrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print Slip
          </Button>
          <Button variant="outline" onClick={onDownload} className="gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          <Button onClick={onSave} className="gap-2 bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4" /> Save Payroll
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
