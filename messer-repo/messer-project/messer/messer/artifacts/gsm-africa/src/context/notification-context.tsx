import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  link?: string;
  orderId?: number;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  notify: (title: string, message: string, type?: NotificationType, options?: { link?: string; orderId?: number }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback(
    (title: string, message: string, type: NotificationType = "info", options?: { link?: string; orderId?: number }) => {
      setNotifications(prev => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          message,
          type,
          timestamp: Date.now(),
          read: false,
          ...options,
        },
        ...prev,
      ]);
    },
    []
  );

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, notify, markRead, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}
