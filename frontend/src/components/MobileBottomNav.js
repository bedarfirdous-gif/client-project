import React from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, Menu,
  Receipt, UserCircle, Settings, BarChart3
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'sales', label: 'Sales', icon: Receipt },
  { id: 'menu', label: 'More', icon: Menu, isMenu: true },
];

export default function MobileBottomNav({ currentPage, setCurrentPage, onMenuClick }) {
  return (
    <nav className="mobile-bottom-nav" data-testid="mobile-bottom-nav">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.isMenu) {
                onMenuClick?.();
              } else {
                setCurrentPage(item.id);
              }
            }}
            className={isActive ? 'active' : ''}
            data-testid={`mobile-nav-${item.id}`}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
