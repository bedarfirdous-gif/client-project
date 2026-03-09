import React, { useState, useCallback, useEffect } from 'react';
import { Star, Plus, Settings, X, Search, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { toast } from 'sonner';

const FavoritesSection = ({
  favoriteItems,
  items,
  variants,
  selectedStore,
  onAddToCart,
  onRefreshFavorites,
  api,
  formatCurrency,
  autoOpenManage = false, // New prop to auto-open manage dialog
  onManageClose // Callback when manage dialog closes
}) => {
  const [showManageFavorites, setShowManageFavorites] = useState(false);
  const [managingFavorites, setManagingFavorites] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-open manage dialog when triggered from parent
  useEffect(() => {
    if (autoOpenManage && !showManageFavorites) {
      handleOpenManage();
      if (onManageClose) onManageClose(); // Reset the trigger
    }
  }, [autoOpenManage]);

  // Open manage favorites dialog
  const handleOpenManage = useCallback(() => {
    setManagingFavorites(favoriteItems.map(f => f.id));
    setSearchQuery('');
    setShowManageFavorites(true);
  }, [favoriteItems]);

  // Toggle item in favorites
  const toggleFavorite = useCallback((itemId) => {
    setManagingFavorites(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      if (prev.length >= 20) {
        toast.error('Maximum 20 favorites allowed');
        return prev;
      }
      return [...prev, itemId];
    });
  }, []);

  // Save favorites to server
  const saveFavorites = useCallback(async () => {
    setSaving(true);
    try {
      await api('/api/pos/favorites', {
        method: 'POST',
        body: JSON.stringify({
          item_ids: managingFavorites,
          store_id: selectedStore || ''
        })
      });
      toast.success('Favorites saved');
      setShowManageFavorites(false);
      onRefreshFavorites();
    } catch (err) {
      toast.error('Failed to save favorites');
    } finally {
      setSaving(false);
    }
  }, [api, managingFavorites, selectedStore, onRefreshFavorites]);

  // Clear favorites
  const clearFavorites = useCallback(async () => {
    setSaving(true);
    try {
      await api(`/api/pos/favorites?store_id=${selectedStore || ''}`, {
        method: 'DELETE'
      });
      toast.success('Favorites cleared - now showing top sellers');
      setShowManageFavorites(false);
      onRefreshFavorites();
    } catch (err) {
      toast.error('Failed to clear favorites');
    } finally {
      setSaving(false);
    }
  }, [api, selectedStore, onRefreshFavorites]);

  // Add single item to favorites
  const addToFavorites = useCallback(async (itemId) => {
    try {
      await api('/api/pos/favorites/add', {
        method: 'POST',
        body: JSON.stringify({
          item_id: itemId,
          store_id: selectedStore || ''
        })
      });
      toast.success('Added to favorites');
      onRefreshFavorites();
    } catch (err) {
      toast.error(err.message || 'Failed to add to favorites');
    }
  }, [api, selectedStore, onRefreshFavorites]);

  // Remove single item from favorites
  const removeFromFavorites = useCallback(async (itemId) => {
    try {
      await api('/api/pos/favorites/remove', {
        method: 'POST',
        body: JSON.stringify({
          item_id: itemId,
          store_id: selectedStore || ''
        })
      });
      toast.success('Removed from favorites');
      onRefreshFavorites();
    } catch (err) {
      toast.error('Failed to remove from favorites');
    }
  }, [api, selectedStore, onRefreshFavorites]);

  // Handle favorite item click - add to cart
  const handleFavoriteClick = useCallback((favItem) => {
    const itemVariant = favItem.variant_id 
      ? variants.find(v => v.id === favItem.variant_id) 
      : variants.find(v => v.item_id === favItem.id);
    
    const variantToUse = itemVariant || {
      id: favItem.variant_id || favItem.id,
      item_id: favItem.id,
      selling_price: favItem.selling_price || favItem.price,
      mrp: favItem.mrp,
      size: '',
      color: '',
      current_stock: favItem.current_stock
    };
    
    onAddToCart(favItem, variantToUse);
  }, [variants, onAddToCart]);

  // Filter items for manage dialog
  const filteredManageItems = searchQuery 
    ? items.filter(i => 
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  return (
    <>
      {/* Favorites Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="font-medium text-sm">Quick Add (1-9)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenManage}
          className="h-7 px-2 text-xs"
          data-testid="manage-favorites-btn"
        >
          <Settings className="w-3 h-3 mr-1" />
          Manage
        </Button>
      </div>

      {/* Favorites Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4" data-testid="favorites-grid">
        {favoriteItems.slice(0, 9).map((favItem, idx) => (
          <div
            key={favItem.id}
            role="button"
            tabIndex={0}
            onClick={() => handleFavoriteClick(favItem)}
            onKeyDown={(e) => e.key === 'Enter' && handleFavoriteClick(favItem)}
            className="relative p-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:shadow-md transition-all text-left group cursor-pointer"
            data-testid={`favorite-item-${idx}`}
          >
            <span className="absolute top-1 left-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {idx + 1}
            </span>
            <div className="pt-4">
              <p className="text-xs font-medium truncate">{favItem.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(favItem.selling_price || favItem.price || 0)}
              </p>
            </div>
            {/* Quick remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFromFavorites(favItem.id);
              }}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Remove from favorites"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        
        {/* Empty slots */}
        {favoriteItems.length < 9 && Array(9 - favoriteItems.length).fill(0).map((_, idx) => (
          <button
            key={`empty-${idx}`}
            onClick={handleOpenManage}
            className="p-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-amber-300 dark:hover:border-amber-700 transition-colors flex items-center justify-center min-h-[60px]"
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      {/* Manage Favorites Dialog */}
      <Dialog open={showManageFavorites} onOpenChange={setShowManageFavorites}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Manage Store Favorites
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Info */}
            <p className="text-sm text-muted-foreground">
              Select up to 20 items as store favorites. These will be shared with all staff in this store.
            </p>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Selected count */}
            <div className="flex items-center justify-between text-sm">
              <span>{managingFavorites.length}/20 selected</span>
              {managingFavorites.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setManagingFavorites([])}
                  className="text-red-500 hover:text-red-600"
                >
                  Clear all
                </Button>
              )}
            </div>
            
            {/* Items Grid */}
            <div className="flex-1 overflow-y-auto border rounded-lg p-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {filteredManageItems.map((item) => {
                  const isSelected = managingFavorites.includes(item.id);
                  const variant = variants.find(v => v.item_id === item.id);
                  const price = variant?.selling_price || item.selling_price || 0;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleFavorite(item.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected 
                          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500' 
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(price)}</p>
                          {item.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {filteredManageItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No items found
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="ghost"
                onClick={clearFavorites}
                disabled={saving}
                className="text-red-500 hover:text-red-600"
              >
                Reset to Top Sellers
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowManageFavorites(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveFavorites}
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {saving ? 'Saving...' : 'Save Favorites'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default React.memo(FavoritesSection);
