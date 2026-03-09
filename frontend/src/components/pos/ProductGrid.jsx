import React, { useState, useCallback, useMemo } from 'react';
import { Package, Star, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const ProductGrid = ({
  items,
  variants,
  inventory,
  selectedStore,
  stores,
  onAddToCart,
  onAddToFavorites,
  favoriteItemIds,
  getStock,
  formatCurrency,
  search
}) => {
  // Keep a single, consistent "collapsed" sentinel value.
  // Use a stable non-null sentinel to prevent any null/undefined first-render mismatch
  // that can cause a brief UI flash when expanding/collapsing.
  const COLLAPSED_ITEM_ID = -1;
  const [expandedItem, setExpandedItem] = useState(COLLAPSED_ITEM_ID);

  // Get variants for an item
  const getVariantsForItem = useCallback((itemId) => {
    return variants.filter(v => v.item_id === itemId && v.active !== false);
  }, [variants]);

  // Check if item is in favorites
  const isFavorite = useCallback((itemId) => {
    return favoriteItemIds.includes(itemId);
  }, [favoriteItemIds]);

  // Toggle item expansion
  const toggleExpand = useCallback((itemId) => {
    setExpandedItem(prev => (prev === itemId ? null : itemId));
  }, []);

  // Handle add to cart
  const handleAddToCart = useCallback((item, variant) => {
    onAddToCart(item, variant);
  }, [onAddToCart]);

  // Handle quick add (first variant)
  const handleQuickAdd = useCallback((item) => {
    const itemVariants = getVariantsForItem(item.id);
    if (itemVariants.length === 1) {
      handleAddToCart(item, itemVariants[0]);
    } else if (itemVariants.length > 1) {
      toggleExpand(item.id);
    } else {
      // No variants - create synthetic one
      const syntheticVariant = {
        id: item.id,
        item_id: item.id,
        selling_price: item.selling_price || item.price,
        mrp: item.mrp,
        current_stock: item.current_stock || 0
      };
      handleAddToCart(item, syntheticVariant);
    }
  }, [getVariantsForItem, handleAddToCart, toggleExpand]);

  // Filter and sort items
  const displayedItems = useMemo(() => {
    let result = items;
    
    if (search) {
      result = result.filter(i => 
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.sku?.toLowerCase().includes(search.toLowerCase()) ||
        i.barcode?.includes(search)
      );
    }
    
    // Sort: items with stock first
    return result.sort((a, b) => {
      const aVariants = variants.filter(v => v.item_id === a.id);
      const bVariants = variants.filter(v => v.item_id === b.id);
      const aStock = aVariants.reduce((sum, v) => sum + (v.current_stock || 0), 0);
      const bStock = bVariants.reduce((sum, v) => sum + (v.current_stock || 0), 0);
      
      if (aStock > 0 && bStock === 0) return -1;
      if (aStock === 0 && bStock > 0) return 1;
      return 0;
    });
  }, [items, search, variants]);

  if (displayedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">
          {search ? 'No items found' : 'No products available'}
        </p>
        {search && (
          <p className="text-sm">Try a different search term</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" data-testid="product-grid">
      {displayedItems.map((item) => {
        const itemVariants = getVariantsForItem(item.id);
        const hasMultipleVariants = itemVariants.length > 1;
        const firstVariant = itemVariants[0];
        const totalStock = itemVariants.reduce((sum, v) => sum + (getStock(v.id, item.id, v.current_stock) || 0), 0);
        const isOutOfStock = totalStock <= 0;
        const isExpanded = expandedItem === item.id;
        const favorite = isFavorite(item.id);
        
        return (
          <Card
            key={item.id}
            className={`overflow-hidden transition-all ${
              isOutOfStock ? 'opacity-60' : 'hover:shadow-md'
            }`}
            data-testid={`product-card-${item.id}`}
          >
            <CardContent className="p-3">
              {/* Item Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate" title={item.name}>
                    {item.name}
                  </h3>
                  {item.sku && (
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 ${favorite ? 'text-amber-500' : 'text-gray-400'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToFavorites(item.id);
                  }}
                  title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`w-4 h-4 ${favorite ? 'fill-amber-500' : ''}`} />
                </Button>
              </div>

              {/* Price & Stock */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-primary">
                  {formatCurrency(firstVariant?.selling_price || item.selling_price || 0)}
                </span>
                <Badge variant={isOutOfStock ? 'destructive' : totalStock < 5 ? 'warning' : 'secondary'} className="text-xs">
                  {isOutOfStock ? 'Out' : `${totalStock} in stock`}
                </Badge>
              </div>

              {/* Single Variant - Quick Add */}
              {!hasMultipleVariants && (
                <Button
                  className="w-full"
                  size="sm"
                  disabled={isOutOfStock}
                  onClick={() => handleQuickAdd(item)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              )}

              {/* Multiple Variants - Expandable */}
              {hasMultipleVariants && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="sm"
                    onClick={() => toggleExpand(item.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Hide Variants
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        {itemVariants.length} Variants
                      </>
                    )}
                  </Button>

                  {/* Expanded Variants */}
                  {isExpanded && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {itemVariants.map((variant) => {
                        const variantStock = getStock(variant.id, item.id, variant.current_stock);
                        const variantOutOfStock = variantStock <= 0;
                        
                        return (
                          <div
                            key={variant.id}
                            className={`flex items-center justify-between p-2 rounded border text-xs ${
                              variantOutOfStock ? 'opacity-50 bg-gray-50' : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">
                                {[variant.size, variant.color].filter(Boolean).join(' / ') || 'Default'}
                              </span>
                              <span className="text-muted-foreground ml-2">
                                ({variantStock})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {formatCurrency(variant.selling_price || item.selling_price)}
                              </span>
                              <Button
                                size="sm"
                                className="h-6 px-2"
                                disabled={variantOutOfStock}
                                onClick={() => handleAddToCart(item, variant)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default React.memo(ProductGrid);
