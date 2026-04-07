import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const unreadCount = useUnreadCount();
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const navigate = useNavigate();

  const handleClick = (n: any) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.audit_id) {
      setOpen(false);
      // Navigate to the audit — for amendments, go to audit capture
      if (n.type === 'amendments_requested') {
        navigate(`/audit?auditId=${n.audit_id}`);
      } else if (n.type === 'review_requested') {
        navigate('/reviews');
      } else {
        navigate(`/audit?auditId=${n.audit_id}`);
      }
    }
  };

  const typeLabel: Record<string, string> = {
    review_requested: '📋 Review Request',
    amendments_requested: '✏️ Amendments',
    audit_approved: '✅ Approved',
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-md hover:bg-muted transition-colors">
        <Bell size={18} className="text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 max-h-96 overflow-y-auto bg-card border rounded-lg shadow-lg">
            <div className="flex items-center justify-between px-4 py-2.5 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={() => markAllRead.mutate()} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            {!notifications?.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              <div className="divide-y">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground">{typeLabel[n.type] || n.type}</p>
                        <p className="text-sm mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
