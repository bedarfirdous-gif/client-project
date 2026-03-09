import React from 'react';
import { Check, X, Package, Edit, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function ScannerPreviewTable({
  previewData,
  setPreviewData,
  categories,
  brands,
  selectedStore,
  setSelectedStore,
  stores,
  onImport,
  onCancel,
  loading
}) {
  const updateItem = (index, field, value) => {
    setPreviewData(prev => 
      prev.map((item, i) => i === index ? { ...item, [field]: value } : item)
    );
  };

  const toggleItemInclude = (index) => {
    setPreviewData(prev =>
      prev.map((item, i) => i === index ? { ...item, include: !item.include } : item)
    );
  };

  const selectedCount = previewData.filter(item => item.include !== false).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Preview & Edit</CardTitle>
            <CardDescription>
              Review extracted data before importing ({selectedCount} of {previewData.length} items selected)
            </CardDescription>
          </div>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(store => (
                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent">
              <tr>
                <th className="p-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={previewData.every(item => item.include !== false)}
                    onChange={(e) => {
                      setPreviewData(prev => 
                        prev.map(item => ({ ...item, include: e.target.checked }))
                      );
                    }}
                    className="rounded"
                  />
                </th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">SKU</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-right">MRP</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2 text-right">Stock</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {previewData.map((item, index) => (
                <tr 
                  key={index} 
                  className={`border-b ${item.include === false ? 'opacity-50 bg-muted/50' : ''}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={item.include !== false}
                      onChange={() => toggleItemInclude(index)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={item.name || ''}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      className="h-8 text-xs"
                      disabled={item.include === false}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={item.sku || ''}
                      onChange={(e) => updateItem(index, 'sku', e.target.value)}
                      className="h-8 text-xs font-mono"
                      disabled={item.include === false}
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={item.category_id || ''}
                      onValueChange={(val) => updateItem(index, 'category_id', val)}
                      disabled={item.include === false}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      value={item.mrp || ''}
                      onChange={(e) => updateItem(index, 'mrp', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs text-right w-20"
                      disabled={item.include === false}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      value={item.selling_price || ''}
                      onChange={(e) => updateItem(index, 'selling_price', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs text-right w-20"
                      disabled={item.include === false}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      value={item.stock || ''}
                      onChange={(e) => updateItem(index, 'stock', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs text-right w-16"
                      disabled={item.include === false}
                    />
                  </td>
                  <td className="p-2 text-center">
                    {item.error ? (
                      <span className="text-red-500" title={item.error}>
                        <AlertCircle className="w-4 h-4" />
                      </span>
                    ) : item.exists ? (
                      <span className="text-amber-500" title="Item exists, will update">
                        <Edit className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-green-500" title="New item">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
          <Button 
            className="flex-1"
            onClick={onImport}
            disabled={loading || selectedCount === 0 || !selectedStore}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Importing...
              </>
            ) : (
              <>
                <Package className="w-4 h-4 mr-2" />
                Import {selectedCount} Items
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
