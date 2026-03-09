import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

/**
 * Low stock alert card for dashboard
 * @param {Array} items - Array of low stock item objects
 * @param {number} limit - Max items to show (default 5)
 */
export const LowStockCard = ({ items = [], limit = 5 }) => {
  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" /> Low Stock Items
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 sm:py-8">All items well stocked</p>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {items.slice(0, limit).map((item, idx) => (
              <div key={item.id || idx} className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border last:border-0">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="font-medium text-xs sm:text-sm truncate">{item.name}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">SKU: {item.sku}</p>
                </div>
                <span className="font-mono-data text-[10px] sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex-shrink-0">
                  {item.current_stock} left
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LowStockCard;
