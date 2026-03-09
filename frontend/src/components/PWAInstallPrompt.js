import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from './ui/button';

export default function PWAInstallPrompt() {
  // Use a stable non-null sentinel to avoid transient null/event/null flips that can
  // briefly toggle derived UI and cause a visual flash. We store the prompt event when
  // available; otherwise it remains `false`.
  const [deferredPrompt, setDeferredPrompt] = useState(false);
  const [item, setItem] = useState(false);
  const [timeout, setTimeout] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      if (dismissedTime > oneDayAgo) {
        return; // Don't show if dismissed less than 24 hours ago
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after a delay to not interrupt the user immediately
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-2xl p-4 text-white">
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm sm:text-base">Install App</h3>
            <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
              Add to home screen for quick access & offline use
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 mt-3">
          <Button 
            onClick={handleDismiss}
            variant="ghost" 
            size="sm"
            className="flex-1 text-white hover:bg-white/20 hover:text-white"
          >
            Maybe Later
          </Button>
          <Button 
            onClick={handleInstall}
            size="sm"
            className="flex-1 bg-white text-blue-700 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-1" />
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}
