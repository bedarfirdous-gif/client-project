// POS Product Grid Component
import React from 'react';
import { Package, Plus, Store } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useCurrency } from '../../contexts/CurrencyContext';

export default function POSProductGrid({
  items,
  getVariantsForItem,
  getStock,
  getStoreAvailability,
  addToCart,
  loading,
  usingCachedData
}) {
  const { currencySymbol } = useCurrency();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="w-16 h-16 opacity-30 mb-4" />
        <p className="text-lg font-medium">No products found</p>
        <p className="text-sm">Try a different search or add new products</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
      {items.map((item) => {
        const itemVariants = getVariantsForItem(item.id);
        
        return itemVariants.map((variant) => {
          const stock = getStock(variant.id);
          const storeAvail = getStoreAvailability(variant.id);
          const isOutOfStock = stock <= 0;
          const isLowStock = stock > 0 && stock <= 5;
          
          return (
            <Card 
              key={variant.id}
              className={`relative overflow-hidden transition-all hover:shadow-md ${
                isOutOfStock ? 'opacity-60' : 'cursor-pointer hover:-translate-y-0.5'
              }`}
              onClick={() => !isOutOfStock && addToCart(item, variant)}
              data-testid={`product-${variant.id}`}
            >
              {/* Product Image/Placeholder */}
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 relative">
                {item.images?.[0] ? (
                  <img loading="lazy" 
                    src={item.images[0]} 
                    alt={item.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-300 dark:text-gray-600">
                      {item.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Stock Badge */}
                <div className="absolute top-1.5 right-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          className={`text-[10px] px-1.5 py-0.5 ${
                            isOutOfStock 
                              ? 'bg-red-500 text-white' 
                              : isLowStock 
                                ? 'bg-amber-500 text-white' 
                                : 'bg-green-500 text-white'
                          }`}
                        >
                          {usingCachedData ? '?' : stock}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px]">
                        {storeAvail.length > 0 ? (
                          <div className="space-y-1">
                            <p className="font-medium text-xs">Stock by Store:</p>
                            {storeAvail.map((s, idx) => (
                              <div key={idx} className="flex justify-between text-xs gap-2">
                                <span className="flex items-center gap-1">
                                  <Store className="w-3 h-3" />{s.storeName}
                                </span>
                                <span className="font-mono">{s.stock}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs">No stock info</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* Add Button Overlay */}
                {!isOutOfStock && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="sm" className="bg-white text-black hover:bg-gray-100">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                )}
                
                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs font-medium px-2 py-1 bg-red-500 rounded">
                      Out of Stock
                    </span>
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div className="p-2">
                <p className="font-medium text-xs sm:text-sm truncate">{item.name}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  {variant.size && <span>{variant.size}</span>}
                  {variant.size && variant.color && <span>/</span>}
                  {variant.color && <span>{variant.color}</span>}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-sm sm:text-base text-primary">
                    {currencySymbol}{item.selling_price?.toLocaleString()}
                  </span>
                  {item.mrp > item.selling_price && (
                    <span className="text-[10px] text-muted-foreground line-through">
                      {currencySymbol}{item.mrp?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        });
      })}
    </div>
  );
}
