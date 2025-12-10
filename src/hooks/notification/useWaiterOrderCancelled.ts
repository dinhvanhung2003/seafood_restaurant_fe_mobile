// src/hooks/notification/useWaiterOrderCancelled.ts
import { getSocket } from '@lib/socket';
import http from '@services/http';
import { useEffect, useMemo, useState } from 'react';

export type WaiterCancelNotif = {
  id: string;
  orderId: string;
  tableName: string | null;
  title: string;
  message: string;
  createdAt: string; // ISO
  reason?: string;
  by?: string;
  read?: boolean;
};

export function useWaiterOrderCancelled() {
  const [items, setItems] = useState<WaiterCancelNotif[]>([]);
  const [loading, setLoading] = useState(true);

  // 1️⃣ Lần đầu: load lịch sử từ API
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await http.get<WaiterCancelNotif[]>('/waiter-notifications/me');

        if (!alive) return;

        // đảm bảo sort mới nhất lên trên (BE đã sort rồi, nhưng cho chắc)
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setItems(sorted);
      } catch (err) {
        console.log('[waiter-notif] load error', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // 2️⃣ Socket realtime
  useEffect(() => {
    const s = getSocket();

    const onCancelled = (p: WaiterCancelNotif) => {
      setItems(prev => {
        // tránh duplicate nếu cùng id (vừa load API, vừa nhận socket)
        if (prev.some(n => n.id === p.id)) return prev;

        return [
          { ...p, read: p.read ?? false },
          ...prev,
        ];
      });
    };

    s.on('waiter:order_cancelled', onCancelled);

    return () => {
      s.off('waiter:order_cancelled', onCancelled);
    };
  }, []);

  // 3️⃣ Đếm chưa đọc từ state
  const unreadCount = useMemo(
    () => items.filter(i => !i.read).length,
    [items],
  );

  const markRead = async (id: string) => {
    setItems(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n)),
    );

    try {
      await http.patch(`/waiter-notifications/${id}/read`);
    } catch (err) {
      console.log('[waiter-notif] markRead error', err);
    }
  };

  const markAllRead = async () => {
    const ids = items.filter(i => !i.read).map(i => i.id);
    if (!ids.length) return;

    setItems(prev => prev.map(n => ({ ...n, read: true })));

    try {
      await http.patch('/waiter-notifications/read-many', { ids });
    } catch (err) {
      console.log('[waiter-notif] markAllRead error', err);
    }
  };

  return { items, unreadCount, markRead, markAllRead, loading };
}
