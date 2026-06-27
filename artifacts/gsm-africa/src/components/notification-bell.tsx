import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Trash2, Info, CheckCircle, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { useNotifications, type NotificationType } from "@/context/notification-context";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function typeIcon(type: NotificationType) {
  const cls = "shrink-0 mt-0.5";
  switch (type) {
    case "success": return <CheckCircle size={15} className={`${cls} text-emerald-500`} />;
    case "warning": return <AlertTriangle size={15} className={`${cls} text-amber-500`} />;
    case "error":   return <XCircle size={15} className={`${cls} text-red-500`} />;
    default:        return <Info size={15} className={`${cls} text-blue-500`} />;
  }
}

function typeBg(type: NotificationType): string {
  switch (type) {
    case "success": return "border-l-emerald-400";
    case "warning": return "border-l-amber-400";
    case "error":   return "border-l-red-400";
    default:        return "border-l-blue-400";
  }
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleNotifClick(id: string, link?: string, orderId?: number) {
    markRead(id);
    const dest = link ?? (orderId ? `/account/orders` : null);
    if (dest) {
      setOpen(false);
      navigate(dest);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) markAllRead(); }}
        className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black min-w-[16px] h-4 flex items-center justify-center rounded-full border border-[#1a2332] px-0.5 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <p className="font-bold text-sm text-gray-900">Notifications</p>
              {unreadCount > 0 && (
                <p className="text-[11px] text-gray-400">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    title="Mark all as read"
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                  >
                    <CheckCheck size={14} />
                  </button>
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell size={28} className="text-gray-200 mb-2" />
                <p className="text-sm font-semibold text-gray-400">No notifications yet</p>
                <p className="text-xs text-gray-300 mt-1">Activity and order updates will appear here.</p>
              </div>
            ) : (
              notifications.map(n => {
                const isClickable = !!(n.link ?? n.orderId);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n.id, n.link, n.orderId)}
                    className={`w-full text-left px-4 py-3 flex gap-2.5 transition-colors border-l-[3px] ${typeBg(n.type)} ${n.read ? "bg-white hover:bg-gray-50" : "bg-blue-50/40 hover:bg-blue-50/70"}`}
                  >
                    {typeIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm leading-tight mb-0.5 ${n.read ? "font-medium text-gray-700" : "font-bold text-gray-900"}`}>
                          {n.title}
                        </p>
                        {isClickable && (
                          <ExternalLink size={11} className="shrink-0 text-blue-400 mt-0.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-snug line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-gray-400">{timeAgo(n.timestamp)}</p>
                        {isClickable && (
                          <span className="text-[10px] text-blue-500 font-semibold">
                            {n.orderId ? `→ View Order #${n.orderId}` : "→ View"}
                          </span>
                        )}
                      </div>
                    </div>
                    {!n.read && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
