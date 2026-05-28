import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";

const TOKEN_KEY = "gsmafrica_token";

function getUserId(): string {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return "guest";
    const b64 = token.split(".")[1];
    if (!b64) return "guest";
    const payload = JSON.parse(atob(b64)) as { userId?: number };
    return payload.userId ? `u${payload.userId}` : "guest";
  } catch { return "guest"; }
}

function notifKey(uid: string) { return `gsm_notif_${uid}`; }
function seenKey(uid: string)  { return `gsm_seen_${uid}`; }

function getSeenIds(uid: string): Set<number> {
  try {
    const raw = localStorage.getItem(seenKey(uid));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function addSeenIds(uid: string, ids: number[]) {
  try {
    const existing = getSeenIds(uid);
    ids.forEach((id) => existing.add(id));
    const arr = Array.from(existing).slice(-200);
    localStorage.setItem(seenKey(uid), JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export type NotificationType = "success" | "info" | "warning" | "error";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  orderId?: number;
  link?: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  notify: (title: string, message: string, type?: NotificationType) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

const MAX_NOTIFICATIONS = 50;

const NotificationContext = createContext<NotificationContextValue | null>(null);

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    const notes = [
      { freq: 880, start: 0, dur: 0.12 },
      { freq: 1108.73, start: 0.1, dur: 0.12 },
      { freq: 1318.51, start: 0.2, dur: 0.22 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur);
    });

    setTimeout(() => ctx.close(), 800);
  } catch {
    // Audio not supported — silent fallback
  }
}

function loadStored(uid: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(notifKey(uid));
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

function saveStored(uid: string, notifications: AppNotification[]) {
  try {
    localStorage.setItem(notifKey(uid), JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // ignore
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [currentUid, setCurrentUid] = useState<string>(() => getUserId());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadStored(getUserId()));
  const isFirstRender = useRef(true);

  // Watch for login/logout by polling localStorage for token changes
  useEffect(() => {
    const check = () => {
      const newUid = getUserId();
      setCurrentUid(prev => {
        if (prev !== newUid) {
          // User changed — reload their notifications
          setNotifications(loadStored(newUid));
          return newUid;
        }
        return prev;
      });
    };
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveStored(currentUid, notifications);
  }, [notifications, currentUid]);

  const notify = useCallback((title: string, message: string, type: NotificationType = "info") => {
    const newNotif: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      type,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS));
    playNotificationSound();
    const toastFn = type === "success" ? toast.success
      : type === "error" ? toast.error
      : type === "warning" ? toast.warning
      : toast.info;
    toastFn(title, { description: message });
  }, []);

  // Poll server for DB-backed notifications (only when logged in)
  useEffect(() => {
    async function fetchServerNotifs() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      const uid = getUserId();
      if (uid === "guest") return;
      try {
        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json() as Array<{
          id: number; title: string; message: string; type: string;
          orderId: number | null; read: boolean; createdAt: string;
        }>;
        const seenIds = getSeenIds(uid);
        const newOnes = data.filter(n => !n.read && !seenIds.has(n.id));
        if (newOnes.length > 0) {
          addSeenIds(uid, newOnes.map(n => n.id));
          playNotificationSound();
          newOnes.forEach(n => {
            const notifType = (["success", "info", "warning", "error"].includes(n.type) ? n.type : "info") as NotificationType;
            const localNotif: AppNotification = {
              id: `srv-${n.id}`,
              title: n.title,
              message: n.message,
              type: notifType,
              timestamp: new Date(n.createdAt).getTime(),
              read: false,
              orderId: n.orderId ?? undefined,
              link: n.orderId ? `/account/orders` : undefined,
            };
            setNotifications(prev => {
              if (prev.some(p => p.id === localNotif.id)) return prev;
              return [localNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
            });
            const toastFn = notifType === "success" ? toast.success
              : notifType === "error" ? toast.error
              : notifType === "warning" ? toast.warning
              : toast.info;
            toastFn(n.title, { description: n.message, duration: 8000 });
          });
        }
      } catch {
        // silent — offline or unauthenticated
      }
    }

    fetchServerNotifs();
    const interval = setInterval(fetchServerNotifs, 30_000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, notify, markAllRead, markRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
