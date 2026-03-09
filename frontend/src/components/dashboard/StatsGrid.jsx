import React from 'react';
import { Card, CardContent } from '../ui/card';

/**
 * Reusable stats grid component for displaying metric cards
 * @param {Array} stats - Array of stat objects with {label, value, icon, bgColor, color, mono}
 */
export const StatsGrid = ({ stats = [] }) => {
  return (
    <div>
      <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Overview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
              <CardContent className="p-3 sm:pt-6 sm:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                    <p className={`text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate ${stat.mono ? 'font-mono-data' : ''}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor} ${stat.color} flex-shrink-0 ml-2`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StatsGrid;
