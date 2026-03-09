import React, { useState, useEffect } from 'react';
import { Keyboard, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { DEFAULT_SHORTCUTS, formatKeys, getAllShortcuts } from '../hooks/useKeyboardShortcuts';

export default function ShortcutsModal({ open, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (open) {
      setSearchQuery('');
    }
  }, [open]);

  const filteredShortcuts = getAllShortcuts().filter(shortcut =>
    searchQuery === '' || 
    shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shortcut.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="shortcuts-modal">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-violet-600" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
        
        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Badge variant="outline" className="font-normal">{category}</Badge>
              </h3>
              <div className="space-y-1">
                {shortcuts.map(shortcut => (
                  <div 
                    key={shortcut.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                      {shortcut.keys.map((key, idx) => (
                        <React.Fragment key={idx}>
                          <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono">
                            {formatKeys([key])}
                          </kbd>
                          {idx < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {filteredShortcuts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Keyboard className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No shortcuts found for "{searchQuery}"</p>
            </div>
          )}
        </div>
        
        {/* Footer hint */}
        <div className="pt-4 border-t text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">Esc</kbd> to close • 
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono ml-1">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">/</kbd> to toggle
        </div>
      </DialogContent>
    </Dialog>
  );
}
