import React, { useState } from 'react';
import { Search, Keyboard, Navigation, Zap, Globe, ShoppingCart, Command } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { DEFAULT_SHORTCUTS, formatKeys, getAllShortcuts } from '../hooks/useKeyboardShortcuts';

const categoryIcons = {
  'Navigation': Navigation,
  'Quick Actions': Zap,
  'Global': Globe,
  'Point of Sale': ShoppingCart,
};

export default function KeyboardShortcutsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = Object.entries(DEFAULT_SHORTCUTS).map(([key, value]) => ({
    id: key,
    ...value
  }));

  const filteredShortcuts = getAllShortcuts().filter(shortcut => {
    const matchesSearch = searchQuery === '' || 
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.action.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6" data-testid="keyboard-shortcuts-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Keyboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Keyboard Shortcuts</h1>
            <p className="text-muted-foreground">Navigate faster with keyboard shortcuts</p>
          </div>
        </div>
        
        {/* Quick tip */}
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
          <Command className="w-4 h-4 text-violet-600" />
          <span className="text-sm text-violet-700 dark:text-violet-300">
            Press <kbd className="px-1.5 py-0.5 bg-violet-200 dark:bg-violet-800 rounded text-xs font-mono mx-1">Ctrl + /</kbd> anywhere to see shortcuts
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="shortcuts-search"
          />
        </div>
        
        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            className="cursor-pointer hover:bg-primary/80 transition-colors"
            onClick={() => setSelectedCategory('all')}
          >
            All
          </Badge>
          {categories.map(cat => (
            <Badge
              key={cat.id}
              variant={selectedCategory === cat.label ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/80 transition-colors"
              onClick={() => setSelectedCategory(cat.label)}
            >
              {cat.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-blue-600">{getAllShortcuts().length}</div>
            <p className="text-sm text-blue-600/80">Total Shortcuts</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-emerald-600">{categories.length}</div>
            <p className="text-sm text-emerald-600/80">Categories</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-amber-600">
              {DEFAULT_SHORTCUTS.navigation.shortcuts.length}
            </div>
            <p className="text-sm text-amber-600/80">Navigation</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-purple-600">
              {DEFAULT_SHORTCUTS.pos.shortcuts.length}
            </div>
            <p className="text-sm text-purple-600/80">POS Shortcuts</p>
          </CardContent>
        </Card>
      </div>

      {/* Shortcuts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(groupedShortcuts).map(([category, shortcuts]) => {
          const IconComponent = categoryIcons[category] || Keyboard;
          return (
            <Card key={category} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <IconComponent className="w-5 h-5 text-primary" />
                  {category}
                </CardTitle>
                <CardDescription>{shortcuts.length} shortcut{shortcuts.length !== 1 ? 's' : ''}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y dark:divide-gray-800">
                  {shortcuts.map((shortcut, idx) => (
                    <div 
                      key={shortcut.id}
                      className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{shortcut.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{shortcut.action}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono shadow-sm min-w-[28px] text-center">
                              {formatKeys([key])}
                            </kbd>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground text-xs">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredShortcuts.length === 0 && (
        <Card className="p-12 text-center">
          <Keyboard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No shortcuts found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
        </Card>
      )}

      {/* Tips Section */}
      <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-2xl">💡</span> Pro Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-violet-500 mt-0.5">•</span>
              <span>Use <kbd className="px-1.5 py-0.5 bg-violet-200 dark:bg-violet-800 rounded text-xs font-mono">Alt + P</kbd> to quickly jump to POS from anywhere</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500 mt-0.5">•</span>
              <span>Press <kbd className="px-1.5 py-0.5 bg-violet-200 dark:bg-violet-800 rounded text-xs font-mono">Ctrl + K</kbd> to open quick search</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500 mt-0.5">•</span>
              <span>In POS, use <kbd className="px-1.5 py-0.5 bg-violet-200 dark:bg-violet-800 rounded text-xs font-mono">F12</kbd> to complete checkout instantly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500 mt-0.5">•</span>
              <span>Shortcuts work everywhere except when typing in text fields</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
