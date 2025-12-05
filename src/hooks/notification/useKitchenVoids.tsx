// src/hooks/socket/useKitchenVoids.ts
import { getSocket } from '@lib/socket';
import { useEffect, useState } from 'react';

type KitchenVoidPayload = {
  orderId: string;
  menuItemId: string;
  qty: number;
  reason?: string;
  by?: 'kitchen' | 'cashier' | 'waiter' | string;
  ticketId: string;
};

export function useKitchenVoids(orderId?: string) {
  const [kitchenVoids, setKitchenVoids] = useState<KitchenVoidPayload[]>([]);

  useEffect(() => {
    const s = getSocket();

    const onVoidSynced = (p: KitchenVoidPayload) => {
      if (!p) return;

      // 1️⃣ khác orderId -> bỏ
      if (orderId && p.orderId !== orderId) return;

      // 2️⃣ chỉ nhận event DO BẾP huỷ
      if (p.by && p.by !== 'kitchen') return;

      // 3️⃣ CHỐNG TRÙNG: nếu cùng ticketId + menuItemId + qty + reason thì bỏ qua
      setKitchenVoids(prev => {
        const existed = prev.some(
          v =>
            v.ticketId === p.ticketId &&
            v.menuItemId === p.menuItemId &&
            v.qty === p.qty &&
            (v.reason || '') === (p.reason || '')
        );
        if (existed) return prev;
        return [...prev, p];
      });
    };

    s.on('kitchen:void_synced', onVoidSynced);

    return () => {
      s.off('kitchen:void_synced', onVoidSynced);
      // đổi order / unmount thì clear banner cũ
      setKitchenVoids([]);
    };
  }, [orderId]);

  const clearKitchenVoid = (menuItemId: string) => {
    setKitchenVoids(prev => prev.filter(x => x.menuItemId !== menuItemId));
  };

  const clearAllKitchenVoids = () => setKitchenVoids([]);

  return { kitchenVoids, clearKitchenVoid, clearAllKitchenVoids };
}
