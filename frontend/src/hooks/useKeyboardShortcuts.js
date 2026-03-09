import { useEffect, useCallback } from 'react';

// Default keyboard shortcuts configuration
export const DEFAULT_SHORTCUTS = {
  // Tally-style Accounting Shortcuts (F2-F10)
  tally: {
    label: 'Tally Accounting (F-Keys)',
    shortcuts: [
      { id: 'tally-day-book', keys: ['F2'], description: 'Day Book', action: 'tally-day-book' },
      { id: 'tally-trial-balance', keys: ['F3'], description: 'Trial Balance', action: 'tally-trial-balance' },
      { id: 'tally-contra', keys: ['F4'], description: 'Contra Voucher', action: 'tally-contra' },
      { id: 'tally-payment', keys: ['F5'], description: 'Payment Voucher', action: 'tally-payment' },
      { id: 'tally-receipt', keys: ['F6'], description: 'Receipt Voucher', action: 'tally-receipt' },
      { id: 'tally-journal', keys: ['F7'], description: 'Journal Voucher', action: 'tally-journal' },
      { id: 'tally-sales', keys: ['F8'], description: 'Sales Voucher', action: 'tally-sales' },
      { id: 'tally-purchase', keys: ['F9'], description: 'Purchase Voucher', action: 'tally-purchase' },
      { id: 'tally-balance-sheet', keys: ['F10'], description: 'Balance Sheet', action: 'tally-balance-sheet' },
      { id: 'tally-ledger', keys: ['Alt', 'C'], description: 'Create Ledger', action: 'tally-ledger' },
    ]
  },
  // Navigation shortcuts
  navigation: {
    label: 'Navigation',
    shortcuts: [
      { id: 'go-dashboard', keys: ['Ctrl', 'D'], description: 'Go to Dashboard', action: 'dashboard' },
      { id: 'go-pos', keys: ['Ctrl', 'P'], description: 'Go to Point of Sale', action: 'pos' },
      { id: 'go-items', keys: ['Ctrl', 'I'], description: 'Go to Items', action: 'items' },
      { id: 'go-inventory', keys: ['Ctrl', 'Y'], description: 'Go to Inventory', action: 'inventory' },
      { id: 'go-customers', keys: ['Ctrl', 'U'], description: 'Go to Customers', action: 'customers' },
      { id: 'go-sales', keys: ['Ctrl', 'L'], description: 'Go to Sales', action: 'sales' },
      { id: 'go-transfers', keys: ['Ctrl', 'T'], description: 'Go to Stock Transfers', action: 'stock-transfers' },
      { id: 'go-employees', keys: ['Ctrl', 'E'], description: 'Go to Employees', action: 'employees' },
      { id: 'go-suppliers', keys: ['Ctrl', 'G'], description: 'Go to Suppliers', action: 'suppliers' },
      { id: 'go-settings', keys: ['Ctrl', ','], description: 'Go to Settings', action: 'settings' },
    ]
  },
  // Quick actions
  actions: {
    label: 'Quick Actions',
    shortcuts: [
      { id: 'new-sale', keys: ['Ctrl', 'N'], description: 'New Sale (POS)', action: 'new-sale' },
      { id: 'quick-search', keys: ['Ctrl', 'K'], description: 'Quick Search', action: 'search' },
      { id: 'refresh', keys: ['Ctrl', 'R'], description: 'Refresh Data', action: 'refresh' },
    ]
  },
  // Global shortcuts
  global: {
    label: 'Global',
    shortcuts: [
      { id: 'show-shortcuts', keys: ['Ctrl', '/'], description: 'Show Keyboard Shortcuts', action: 'show-shortcuts' },
      { id: 'toggle-sidebar', keys: ['Ctrl', 'B'], description: 'Toggle Sidebar', action: 'toggle-sidebar' },
      { id: 'toggle-theme', keys: ['Ctrl', 'M'], description: 'Toggle Light/Dark Mode', action: 'toggle-theme' },
      { id: 'logout', keys: ['Ctrl', 'Q'], description: 'Logout', action: 'logout' },
    ]
  },
  // POS specific shortcuts
  pos: {
    label: 'Point of Sale',
    shortcuts: [
      { id: 'pos-checkout', keys: ['Ctrl', 'O'], description: 'Checkout / Complete Sale', action: 'pos-checkout' },
      { id: 'pos-clear', keys: ['Ctrl', 'X'], description: 'Clear Cart', action: 'pos-clear' },
      { id: 'pos-hold', keys: ['Ctrl', 'H'], description: 'Hold Sale', action: 'pos-hold' },
    ]
  }
};

// Get all shortcuts as a flat array
export const getAllShortcuts = () => {
  const all = [];
  Object.values(DEFAULT_SHORTCUTS).forEach(category => {
    category.shortcuts.forEach(shortcut => {
      all.push({ ...shortcut, category: category.label });
    });
  });
  return all;
};

// Format keys for display
export const formatKeys = (keys) => {
  return keys.map(key => {
    switch(key) {
      case 'Ctrl': return '⌃';
      case 'Alt': return '⌥';
      case 'Shift': return '⇧';
      case 'Escape': return 'Esc';
      case 'Left': return '←';
      case 'Right': return '→';
      case 'Up': return '↑';
      case 'Down': return '↓';
      default: return key;
    }
  }).join(' + ');
};

// Check if a key combination matches
const matchesShortcut = (event, keys) => {
  const pressedKeys = [];
  if (event.ctrlKey || event.metaKey) pressedKeys.push('Ctrl');
  if (event.altKey) pressedKeys.push('Alt');
  if (event.shiftKey) pressedKeys.push('Shift');
  
  // Get the actual key pressed
  let key = event.key;
  if (key === ' ') key = 'Space';
  if (key === 'ArrowLeft') key = 'Left';
  if (key === 'ArrowRight') key = 'Right';
  if (key === 'ArrowUp') key = 'Up';
  if (key === 'ArrowDown') key = 'Down';
  
  // Add the key if it's not a modifier
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    pressedKeys.push(key.length === 1 ? key.toUpperCase() : key);
  }
  
  // Check if arrays match
  if (pressedKeys.length !== keys.length) return false;
  return keys.every(k => pressedKeys.includes(k));
};

// Custom hook for keyboard shortcuts
export function useKeyboardShortcuts(handlers = {}, enabled = true) {
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in input fields
    const target = event.target;
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
    
    // Allow certain shortcuts even in input fields
    const allowInInput = ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
    
    if (isInputField && !allowInInput.includes(event.key) && !event.ctrlKey && !event.altKey) {
      return;
    }
    
    // Check all shortcuts
    const allShortcuts = getAllShortcuts();
    for (const shortcut of allShortcuts) {
      if (matchesShortcut(event, shortcut.keys)) {
        event.preventDefault();
        if (handlers[shortcut.action]) {
          handlers[shortcut.action](event, shortcut);
        } else if (handlers.onShortcut) {
          handlers.onShortcut(shortcut.action, event, shortcut);
        }
        return;
      }
    }
  }, [handlers, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useKeyboardShortcuts;
