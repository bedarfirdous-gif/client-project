import React, { useState, useEffect } from 'react';
import { useAuth, useTheme } from '../App';
import { Palette, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Theme configurations
const THEMES = [
  {
    id: 'default',
    name: 'Default',
    description: 'Clean light theme',
    preview: ['#ffffff', '#f8fafc', '#3b82f6', '#1e40af'],
    colors: {
      '--background': '0 0% 100%',
      '--foreground': '222.2 84% 4.9%',
      '--card': '0 0% 100%',
      '--card-foreground': '222.2 84% 4.9%',
      '--primary': '221.2 83.2% 53.3%',
      '--primary-foreground': '210 40% 98%',
      '--secondary': '210 40% 96.1%',
      '--accent': '210 40% 96.1%',
      '--muted': '210 40% 96.1%',
      '--muted-foreground': '215.4 16.3% 46.9%',
      '--border': '214.3 31.8% 91.4%',
      '--sidebar-bg': '0 0% 100%',
      '--header-bg': '0 0% 100%',
    }
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    description: 'Professional blue theme',
    preview: ['#1e3a5f', '#2563eb', '#60a5fa', '#dbeafe'],
    colors: {
      '--background': '210 50% 98%',
      '--foreground': '222 47% 11%',
      '--card': '0 0% 100%',
      '--card-foreground': '222 47% 11%',
      '--primary': '217 91% 60%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '214 95% 93%',
      '--accent': '214 95% 93%',
      '--muted': '214 32% 91%',
      '--muted-foreground': '215 16% 47%',
      '--border': '214 32% 91%',
      '--sidebar-bg': '217 33% 17%',
      '--header-bg': '0 0% 100%',
    }
  },
  {
    id: 'purple-gradient',
    name: 'Purple Elegance',
    description: 'Vibrant purple gradient',
    preview: ['#7c3aed', '#a855f7', '#c084fc', '#f3e8ff'],
    colors: {
      '--background': '270 50% 98%',
      '--foreground': '270 50% 11%',
      '--card': '0 0% 100%',
      '--card-foreground': '270 50% 11%',
      '--primary': '270 91% 65%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '270 95% 93%',
      '--accent': '270 95% 93%',
      '--muted': '270 32% 91%',
      '--muted-foreground': '270 16% 47%',
      '--border': '270 32% 91%',
      '--sidebar-bg': '270 50% 20%',
      '--header-bg': '0 0% 100%',
    }
  },
  {
    id: 'teal-fresh',
    name: 'Teal Fresh',
    description: 'Modern teal accent',
    preview: ['#0d9488', '#14b8a6', '#5eead4', '#ccfbf1'],
    colors: {
      '--background': '166 50% 98%',
      '--foreground': '166 50% 11%',
      '--card': '0 0% 100%',
      '--card-foreground': '166 50% 11%',
      '--primary': '168 76% 42%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '166 95% 93%',
      '--accent': '166 95% 93%',
      '--muted': '166 32% 91%',
      '--muted-foreground': '166 16% 47%',
      '--border': '166 32% 91%',
      '--sidebar-bg': '168 76% 20%',
      '--header-bg': '0 0% 100%',
    }
  },
  {
    id: 'rose-pink',
    name: 'Rose Pink',
    description: 'Soft pink aesthetic',
    preview: ['#be185d', '#ec4899', '#f472b6', '#fce7f3'],
    colors: {
      '--background': '330 50% 98%',
      '--foreground': '330 50% 11%',
      '--card': '0 0% 100%',
      '--card-foreground': '330 50% 11%',
      '--primary': '330 81% 60%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '330 95% 93%',
      '--accent': '330 95% 93%',
      '--muted': '330 32% 91%',
      '--muted-foreground': '330 16% 47%',
      '--border': '330 32% 91%',
      '--sidebar-bg': '330 81% 25%',
      '--header-bg': '0 0% 100%',
    }
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Easy on the eyes',
    preview: ['#0f172a', '#1e293b', '#334155', '#94a3b8'],
    colors: {
      '--background': '222.2 84% 4.9%',
      '--foreground': '210 40% 98%',
      '--card': '222.2 84% 6%',
      '--card-foreground': '210 40% 98%',
      '--primary': '217.2 91.2% 59.8%',
      '--primary-foreground': '222.2 47.4% 11.2%',
      '--secondary': '217.2 32.6% 17.5%',
      '--accent': '217.2 32.6% 17.5%',
      '--muted': '217.2 32.6% 17.5%',
      '--muted-foreground': '215 20.2% 65.1%',
      '--border': '217.2 32.6% 17.5%',
      '--sidebar-bg': '222.2 84% 3%',
      '--header-bg': '222.2 84% 6%',
    }
  },
  {
    id: 'emerald-green',
    name: 'Emerald Green',
    description: 'Nature inspired',
    preview: ['#047857', '#10b981', '#34d399', '#d1fae5'],
    colors: {
      '--background': '152 50% 98%',
      '--foreground': '152 50% 11%',
      '--card': '0 0% 100%',
      '--card-foreground': '152 50% 11%',
      '--primary': '160 84% 39%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '152 95% 93%',
      '--accent': '152 95% 93%',
      '--muted': '152 32% 91%',
      '--muted-foreground': '152 16% 47%',
      '--border': '152 32% 91%',
      '--sidebar-bg': '160 84% 18%',
      '--header-bg': '0 0% 100%',
    }
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    description: 'Warm and inviting',
    preview: ['#c2410c', '#f97316', '#fb923c', '#ffedd5'],
    colors: {
      '--background': '30 50% 98%',
      '--foreground': '30 50% 11%',
      '--card': '0 0% 100%',
      '--card-foreground': '30 50% 11%',
      '--primary': '25 95% 53%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '30 95% 93%',
      '--accent': '30 95% 93%',
      '--muted': '30 32% 91%',
      '--muted-foreground': '30 16% 47%',
      '--border': '30 32% 91%',
      '--sidebar-bg': '25 95% 25%',
      '--header-bg': '0 0% 100%',
    }
  },
  {
    id: 'india-tricolor',
    name: 'Bharat Tricolor',
    description: 'Tiranga - Saffron, White & Green',
    preview: ['#FF671F', '#FFFFFF', '#046A38', '#06038D'],
    colors: {
      '--background': '0 0% 99%',
      '--foreground': '150 80% 15%',
      '--card': '0 0% 100%',
      '--card-foreground': '150 80% 15%',
      '--primary': '150 89% 22%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '24 100% 93%',
      '--accent': '24 100% 56%',
      '--muted': '150 20% 95%',
      '--muted-foreground': '150 20% 40%',
      '--border': '150 20% 90%',
      '--sidebar-bg': '150 89% 18%',
      '--header-bg': '24 100% 56%',
    }
  },
  {
    id: 'retail-purple',
    name: 'Retail Purple',
    description: 'Modern retail experience',
    preview: ['#1a1a2e', '#8B5CF6', '#22D3EE', '#A78BFA'],
    colors: {
      '--background': '240 20% 10%',
      '--foreground': '0 0% 95%',
      '--card': '240 20% 13%',
      '--card-foreground': '0 0% 95%',
      '--primary': '262 83% 58%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '240 20% 18%',
      '--accent': '187 94% 48%',
      '--muted': '240 20% 20%',
      '--muted-foreground': '240 10% 60%',
      '--border': '240 20% 20%',
      '--sidebar-bg': '240 20% 8%',
      '--header-bg': '240 20% 13%',
    }
  },
];

export default function ThemeSelector() {
  // Use stable auth flags to avoid flicker caused by auth state transitions
  const { user, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState(false);
  const [property, setProperty] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('default');

  // Load saved theme on mount - MUST be before early returns
  useEffect(() => {
    const savedTheme = localStorage.getItem('colorTheme') || 'default';
    setCurrentTheme(savedTheme);
    applyThemeColors(savedTheme);
  }, []);

  const applyThemeColors = (themeId) => {
    const themeConfig = THEMES.find(t => t.id === themeId);
    if (!themeConfig) return;

    const root = document.documentElement;
    
    // Apply theme colors
    Object.entries(themeConfig.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Handle dark mode class
    if (themeId === 'dark-mode') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // Don't render anything until auth is ready to prevent UI blinking.
  if (authLoading) {
    return null; // or render a skeleton/placeholder
  }

  // Once auth is stable, don't redirect - just don't show for unauthenticated users
  if (!user) {
    return null;
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'superadmin';

  const applyTheme = (themeId) => {
    const themeConfig = THEMES.find(t => t.id === themeId);
    if (!themeConfig) return;

    const root = document.documentElement;
    
    // Apply theme colors
    Object.entries(themeConfig.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Handle dark mode class
    if (themeId === 'dark-mode') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const selectTheme = (themeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem('colorTheme', themeId);
    applyTheme(themeId);
  };

  if (!isAdmin) return null;

  return (
    <>
      {/* Theme Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 hover:bg-accent rounded-lg transition-colors"
        data-testid="theme-selector-btn"
        title="Color Themes"
      >
        <Palette className="w-5 h-5" />
        <span 
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background"
          style={{ 
            background: THEMES.find(t => t.id === currentTheme)?.preview[1] || '#3b82f6'
          }}
        />
      </button>

      {/* Theme Selection Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Color Themes
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
            {THEMES.map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => selectTheme(themeOption.id)}
                className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                  currentTheme === themeOption.id 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {/* Color Preview */}
                <div className="flex gap-1 mb-2">
                  {themeOption.preview.map((color, idx) => (
                    <div 
                      key={idx}
                      className="flex-1 h-8 rounded-md first:rounded-l-lg last:rounded-r-lg"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                
                {/* Theme Name */}
                <div className="text-left">
                  <p className="font-medium text-sm">{themeOption.name}</p>
                  <p className="text-xs text-muted-foreground">{themeOption.description}</p>
                </div>

                {/* Selected Check */}
                {currentTheme === themeOption.id && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="border-t pt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Current: <strong>{THEMES.find(t => t.id === currentTheme)?.name}</strong></span>
            <span>Theme preference is saved automatically</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
