import React, { useState, useEffect, useCallback } from 'react';
import { Keyboard, ChevronUp, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';

// Tally-style floating shortcut bar at bottom of screen
export default function TallyShortcutBar({ onNavigate }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Hide on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const shortcuts = [
    { key: 'F2', label: 'Day Book', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200', page: 'accounting-books', action: '📖 Day Book' },
    { key: 'F3', label: 'Trial Bal', color: 'bg-green-100 text-green-700 hover:bg-green-200', page: 'accounting-books', action: '📊 Trial Balance' },
    { key: 'F4', label: 'Contra', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200', page: 'voucher-entry', voucherType: 'contra', action: '🔄 Contra Voucher' },
    { key: 'F5', label: 'Payment', color: 'bg-red-100 text-red-700 hover:bg-red-200', page: 'voucher-entry', voucherType: 'payment', action: '💸 Payment Voucher' },
    { key: 'F6', label: 'Receipt', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', page: 'voucher-entry', voucherType: 'receipt', action: '💰 Receipt Voucher' },
    { key: 'F7', label: 'Journal', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200', page: 'voucher-entry', voucherType: 'journal', action: '📝 Journal Voucher' },
    { key: 'F8', label: 'Sales', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200', page: 'voucher-entry', voucherType: 'sales', action: '🛒 Sales Voucher' },
    { key: 'F9', label: 'Purchase', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200', page: 'voucher-entry', voucherType: 'purchase', action: '📦 Purchase Voucher' },
    { key: 'F10', label: 'Balance Sheet', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200', page: 'accounting-reports', action: '📋 Balance Sheet' },
  ];

  // Handle shortcut click - uses direct function call
  const handleShortcutClick = useCallback((shortcut, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('Shortcut clicked:', shortcut.key, shortcut.page); // Debug log
    toast.info(shortcut.action, { duration: 1500 });
    
    if (onNavigate && typeof onNavigate === 'function') {
      console.log('Calling onNavigate with:', shortcut.page, shortcut.voucherType);
      onNavigate(shortcut.page, shortcut.voucherType);
    } else {
      console.log('onNavigate not available, using fallback');
      // Fallback - dispatch custom event
      window.dispatchEvent(new CustomEvent('tally-shortcut', { 
        detail: { page: shortcut.page, voucherType: shortcut.voucherType }
      }));
    }
  }, [onNavigate]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if in input or modal
      const target = e.target;
      const isInDialog = target.closest('[role="dialog"]');
      
      // F2-F10 should work (but not inside voucher dialog which has its own handlers)
      if (isInDialog) return;
      
      const fKeyMatch = shortcuts.find(s => s.key === e.key);
      
      if (fKeyMatch) {
        e.preventDefault();
        e.stopPropagation();
        handleShortcutClick(fKeyMatch);
        return;
      }
      
      // Alt+C: Create Ledger
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toast.info('📚 Create Ledger', { duration: 1500 });
        if (onNavigate) {
          onNavigate('ledger-management');
        }
      }
      
      // Ctrl+/: Show all shortcuts
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('show-shortcuts-modal'));
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [shortcuts, handleShortcutClick, onNavigate]);

  if (isMobile || !isVisible) return null;

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300">
      {/* Collapsed indicator */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 text-white rounded-t-lg shadow-lg hover:bg-gray-700 text-xs"
          title="Click to expand Tally shortcuts"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>F2-F10 Shortcuts</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Expanded bar */}
      {isExpanded && (
        <div className="bg-gray-900 text-white rounded-t-lg shadow-2xl px-3 py-2">
          <div className="flex items-center gap-1">
            {/* Close button */}
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-gray-700 rounded mr-1"
              title="Hide shortcut bar"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Shortcuts - clickable buttons */}
            {shortcuts.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={(e) => handleShortcutClick(s, e)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${s.color}`}
                title={`${s.key}: ${s.label} - Click or press ${s.key}`}
                data-testid={`shortcut-${s.key.toLowerCase()}`}
              >
                <kbd className="font-mono font-bold">{s.key}</kbd>
                <span className="hidden xl:inline">{s.label}</span>
              </button>
            ))}

            {/* Collapse button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-gray-700 rounded ml-1"
              title="Collapse"
            >
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Additional shortcuts row */}
          <div className="flex items-center justify-center gap-4 mt-1 pt-1 border-t border-gray-700 text-[10px] text-gray-400">
            <button 
              onClick={() => onNavigate && onNavigate('ledger-management')}
              className="hover:text-white transition-colors"
            >
              <kbd className="px-1 bg-gray-700 rounded">Alt+C</kbd> Create Ledger
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('show-shortcuts-modal'))}
              className="hover:text-white transition-colors"
            >
              <kbd className="px-1 bg-gray-700 rounded">Ctrl+/</kbd> All Shortcuts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
