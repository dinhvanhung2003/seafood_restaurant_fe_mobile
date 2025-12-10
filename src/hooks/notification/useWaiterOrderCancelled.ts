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

  useEffect(() => {
    const s = getSocket();

    const onCancelled = (p: WaiterCancelNotif) => {
      setItems(prev => [
        { ...p, read: false }, // luôn là chưa đọc khi mới nhận
        ...prev,
      ]);
    };

    s.on('waiter:order_cancelled', onCancelled);
    return () => {
      s.off('waiter:order_cancelled', onCancelled);
    };
  }, []);

  const unreadCount = useMemo(
    () => items.filter(i => !i.read).length,
    [items],
  );

  const markRead = async (id: string) => {
    setItems(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n)),
    );

    // (nếu bạn có API đánh dấu đã đọc thì gọi ở đây)
    try {
      await http.patch(`/waiter-notifications/${id}/read`);
    } catch {
      // lỗi thì thôi, giữ local state
    }
  };

  const markAllRead = async () => {
    const ids = items.filter(i => !i.read).map(i => i.id);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    try {
      if (ids.length) {
        await http.patch('/waiter-notifications/read-many', { ids });
      }
    } catch {
      // optional
    }
  };

  return { items, unreadCount, markRead, markAllRead };
}
