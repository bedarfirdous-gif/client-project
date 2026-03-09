import React, { memo } from 'react';

/**
 * Reusable skeleton loading components for faster perceived performance
 */

// Basic skeleton with shimmer animation
export const Skeleton = memo(({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    {...props}
  />
));

// Card skeleton
export const CardSkeleton = memo(({ lines = 3 }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    {[...Array(lines)].map((_, i) => (
      <Skeleton key={i} className="h-3 w-full" />
    ))}
  </div>
));

// Table row skeleton
export const TableRowSkeleton = memo(({ cols = 5 }) => (
  <tr className="animate-pulse">
    {[...Array(cols)].map((_, i) => (
      <td key={i} className="p-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
));

// Table skeleton
export const TableSkeleton = memo(({ rows = 5, cols = 5 }) => (
  <div className="overflow-hidden rounded-lg border">
    <table className="w-full">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800">
          {[...Array(cols)].map((_, i) => (
            <th key={i} className="p-3">
              <Skeleton className="h-4 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, i) => (
          <TableRowSkeleton key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
));

// Grid skeleton (for card grids)
export const GridSkeleton = memo(({ count = 6, cols = 3 }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-4`}>
    {[...Array(count)].map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
));

// Stats card skeleton
export const StatsSkeleton = memo(({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border p-4">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-8 w-16" />
      </div>
    ))}
  </div>
));

// POS Page skeleton
export const POSSkeleton = memo(() => (
  <div className="h-full flex flex-col">
    {/* Header */}
    <div className="bg-white dark:bg-gray-800 border-b p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-32 h-8 rounded" />
        <Skeleton className="w-24 h-8 rounded" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="w-24 h-12 rounded-lg" />
        <Skeleton className="w-24 h-12 rounded-lg" />
      </div>
    </div>
    
    {/* Main content */}
    <div className="flex-1 flex">
      {/* Product grid */}
      <div className="flex-1 p-4">
        <Skeleton className="w-full h-10 mb-4 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border p-3">
              <Skeleton className="w-full h-24 mb-2 rounded" />
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Cart sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-l p-4">
        <Skeleton className="h-6 w-24 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Skeleton className="w-12 h-12 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
        <Skeleton className="h-12 w-full mt-4 rounded" />
      </div>
    </div>
  </div>
));

// Employees page skeleton  
export const EmployeesSkeleton = memo(() => (
  <div className="space-y-4 p-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32 rounded" />
    </div>
    
    {/* Tabs */}
    <div className="flex gap-2">
      <Skeleton className="h-10 w-24 rounded" />
      <Skeleton className="h-10 w-32 rounded" />
    </div>
    
    {/* Stats */}
    <StatsSkeleton count={4} />
    
    {/* Search */}
    <Skeleton className="h-10 w-full rounded" />
    
    {/* Grid */}
    <GridSkeleton count={6} />
  </div>
));

// Generic page skeleton
export const PageSkeleton = memo(() => (
  <div className="space-y-4 p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32 rounded" />
    </div>
    <StatsSkeleton count={4} />
    <TableSkeleton rows={8} cols={6} />
  </div>
));

Skeleton.displayName = 'Skeleton';
CardSkeleton.displayName = 'CardSkeleton';
TableRowSkeleton.displayName = 'TableRowSkeleton';
TableSkeleton.displayName = 'TableSkeleton';
GridSkeleton.displayName = 'GridSkeleton';
StatsSkeleton.displayName = 'StatsSkeleton';
POSSkeleton.displayName = 'POSSkeleton';
EmployeesSkeleton.displayName = 'EmployeesSkeleton';
PageSkeleton.displayName = 'PageSkeleton';

export default Skeleton;
