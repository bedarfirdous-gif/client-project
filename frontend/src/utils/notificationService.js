// Push Notification Service for Team Chat
class NotificationService {
  constructor() {
    this.permission = 'default';
    this.lastMessageId = null;
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }

    return false;
  }

  canNotify() {
    return this.permission === 'granted' || Notification.permission === 'granted';
  }

  showNotification(title, options = {}) {
    if (!this.canNotify()) {
      console.log('Notifications not permitted');
      return null;
    }

    const defaultOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'team-chat',
      renotify: true,
      requireInteraction: false,
      silent: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
      
      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  notifyNewMessage(message, senderName) {
    // Don't notify if the message is from current user or already notified
    if (message.id === this.lastMessageId) {
      return;
    }
    
    this.lastMessageId = message.id;
    
    const title = `New message from ${senderName}`;
    const body = message.text?.substring(0, 100) || 'New message received';
    
    this.showNotification(title, {
      body,
      tag: `chat-${message.id}`,
      data: { messageId: message.id }
    });
  }

  setLastMessageId(id) {
    this.lastMessageId = id;
  }
}

// Singleton instance
const notificationService = new NotificationService();
export default notificationService;
