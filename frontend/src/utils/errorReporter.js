/**
 * Frontend Error Reporter
 * Captures JavaScript errors and reports them to the Error Monitoring System
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

class ErrorReporter {
  constructor() {
    this.initialized = false;
    this.errorQueue = [];
    this.isReporting = false;
  }

  init() {
    if (this.initialized) return;
    
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack_trace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        url: window.location.href,
        component: event.filename
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      this.reportError({
        message: error?.message || String(error),
        stack_trace: error?.stack || 'Unhandled Promise Rejection',
        url: window.location.href,
        component: 'Promise'
      });
    });

    // Intercept console.error
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Only report actual errors, not React dev warnings
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (!message.includes('Warning:') && !message.includes('DevTools')) {
        this.reportError({
          message: message.substring(0, 500),
          url: window.location.href,
          component: 'console.error'
        });
      }
      
      originalConsoleError.apply(console, args);
    };

    this.initialized = true;
  }

  async reportError(errorData) {
    // Add to queue
    this.errorQueue.push({
      ...errorData,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    // Process queue with debouncing
    if (!this.isReporting) {
      this.isReporting = true;
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  async processQueue() {
    while (this.errorQueue.length > 0) {
      const error = this.errorQueue.shift();
      
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        await fetch(`${API_URL}/api/errors/report`, {
          method: 'POST',
          headers,
          body: JSON.stringify(error)
        });
      } catch (e) {
        // Silently fail - don't create infinite error loops
        console.warn('Failed to report error:', e);
      }
    }
    
    this.isReporting = false;
  }

  // Manual error reporting method
  static report(message, additionalContext = {}) {
    if (window.errorReporter) {
      window.errorReporter.reportError({
        message,
        url: window.location.href,
        additional_context: additionalContext
      });
    }
  }
}

// Create singleton instance
const errorReporter = new ErrorReporter();

// Auto-initialize
if (typeof window !== 'undefined') {
  window.errorReporter = errorReporter;
  errorReporter.init();
}

export default errorReporter;
export { ErrorReporter };
