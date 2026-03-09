import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

/**
 * Recent sales list card for dashboard
 * @param {Array} sales - Array of sale objects
 * @param {Function} formatCurrency - Currency formatter function
 * @param {number} limit - Max items to show (default 5)
 */
export const RecentSalesCard = ({ sales = [], formatCurrency, limit = 5 }) => {
  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> Recent Sales
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 sm:py-8">No sales yet</p>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {sales.slice(0, limit).map((sale, idx) => (
              <div key={sale.id || idx} className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border last:border-0">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="font-medium text-xs sm:text-sm truncate">{sale.invoice_number}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {sale.customer_name || 'Walk-in'} • {new Date(sale.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-mono-data font-medium text-xs sm:text-sm text-emerald-600 flex-shrink-0">
                  {formatCurrency(sale.total_amount || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentSalesCard;
