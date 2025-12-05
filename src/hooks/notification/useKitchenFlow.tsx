// src/hooks/notification/useKitchenFlow.tsx
import { useKitchenProgress } from '@hooks/useKitchenProgress';
import { useOrders } from '@hooks/useOrder';
import api from '@services/http';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

export type CancelTarget = { orderItemId: string; name: string; qty: number };

type NotifyOpts = {
  tableName: string;
  note?: string;
  priority?: boolean;
  source?: 'cashier' | 'waiter' | 'other';
};

export function useKitchenFlow(selectedTableId?: string) {
  const qc = useQueryClient();
  const { orders, orderIds, addOne, changeQty, activeOrdersQuery } = useOrders();

  const currentOrderId = selectedTableId ? orderIds[selectedTableId] : undefined;

  const activeItems = useMemo(() => {
    if (!selectedTableId || !orders[selectedTableId]) return [];
    const b = orders[selectedTableId];
    const cur = b.orders.find(o => o.id === b.activeId);
    return cur?.items ?? [];
  }, [orders, selectedTableId]);

  const { data: progress = [] } = useKitchenProgress(currentOrderId);

  const notifiedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of progress as any[]) {
      const prev = m.get(r.menuItemId) ?? 0;
      m.set(r.menuItemId, prev + (Number(r.notified) || 0));
    }
    return m;
  }, [progress]);

  const cancellableMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of progress as any[]) {
      const notified = Number(r.notified) || 0;
      const preparing = Number(r.preparing) || 0;
      const ready = Number(r.ready) || 0;
      const served = Number(r.served) || 0;
      const cancelable = Math.max(0, notified - preparing - ready - served);
      const prev = m.get(r.menuItemId) ?? 0;
      m.set(r.menuItemId, prev + cancelable);
    }
    return m;
  }, [progress]);

  const sentQty = (menuItemId: string) => notifiedMap.get(menuItemId) ?? 0;
  const cancellableQty = (menuItemId: string) => cancellableMap.get(menuItemId) ?? 0;

  const deltaItems = useMemo(() => {
    if (!currentOrderId) return [];
    return activeItems
      .map((i: any) => {
        const sent = sentQty(i.id);
        return { menuItemId: i.id, delta: Math.max(0, i.qty - sent) };
      })
      .filter(d => d.delta > 0);
  }, [activeItems, currentOrderId, notifiedMap]);

  const [cancelOneOpen, setCancelOneOpen] = useState(false);
  const [cancelOne, setCancelOne] = useState<CancelTarget | null>(null);

  async function onAdd(menuItemId: string) {
    if (!selectedTableId) return;
    const hadOrder = !!orderIds[selectedTableId];
    await addOne(selectedTableId, menuItemId);
    if (!hadOrder) activeOrdersQuery.refetch?.();
  }

  async function onChangeQty(menuItemId: string, delta: number, menuName?: string) {
    if (!selectedTableId) return;

    const it: any = activeItems.find((x: any) => x.id === menuItemId);
    const cur = it?.qty ?? 0;
    const next = Math.max(0, cur + delta);

    if (!it) {
      if (delta > 0) await onAdd(menuItemId);
      return;
    }

    const totalSent = sentQty(menuItemId);
    const cancelable = cancellableQty(menuItemId);
    const nonSent = Math.max(0, cur - totalSent);

    if (delta > 0) {
      await onAdd(menuItemId);
      return;
    }

    if (next >= totalSent) {
      const reducible = nonSent;
      const apply = Math.max(delta, -reducible);
      if (apply !== 0) {
        await changeQty(selectedTableId, menuItemId, apply, activeItems as any);
      }
      return;
    }

    if (cancelable <= 0) {
      console.log('Không thể huỷ thêm vì món đang chế biến hoặc đã ra.');
      return;
    }

    setCancelOne({
      orderItemId: it.rowId!,
      name: menuName ?? '',
      qty: cancelable,
    });
    setCancelOneOpen(true);
  }

  async function confirmCancelOne({ qty, reason }: { qty: number; reason: string }) {
    if (!cancelOne) return;
    try {
      await api.patch(`/orderitems/cancel-partial`, {
        itemId: cancelOne.orderItemId,
        qty,
        reason,
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['active-orders'] }),
        currentOrderId
          ? qc.invalidateQueries({ queryKey: ['kitchen-progress', currentOrderId] })
          : Promise.resolve(),
      ]);
    } catch (e) {
      console.log('cancel error', e);
    } finally {
      setCancelOneOpen(false);
      setCancelOne(null);
    }
  }

  const [notifying, setNotifying] = useState(false);
  const canNotify = !!currentOrderId && deltaItems.length > 0;

  const onNotify = async (opts: NotifyOpts) => {
    if (!currentOrderId) return;
    if (!canNotify || notifying) return;

    setNotifying(true);
    try {
      await api.post(`/kitchen/orders/${currentOrderId}/notify-items`, {
        items: deltaItems,
        tableName: opts.tableName,
        priority: !!opts.priority,
        note: opts.note ?? null,
        source: opts.source ?? 'waiter', // default cho mobile
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['kitchen-progress', currentOrderId] }),
        qc.invalidateQueries({ queryKey: ['kitchen-history', currentOrderId] }),
      ]);
    } finally {
      setNotifying(false);
    }
  };

  return {
    currentOrderId,
    activeItems,
    deltaItems,
    canNotify,
    notifying,

    cancelOneOpen,
    cancelOne,
    setCancelOneOpen,
    confirmCancelOne,

    onAdd,
    onChangeQty,
    onNotify,
  };
}
