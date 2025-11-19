// src/hooks/mobile/useKitchenFlow.ts
import { useKitchenProgress } from '@hooks/useKitchenProgress';
import { useOrders } from '@hooks/useOrder';
import { getSocket } from '@lib/socket';
import api from '@services/http';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

export type CancelTarget = { orderItemId: string; name: string; qty: number };

export function useKitchenFlow(selectedTableId?: string) {
  const qc = useQueryClient();
  const s = getSocket();
  const { orders, orderIds, addOne, changeQty, activeOrdersQuery } = useOrders();

  // ===== ORDER HIỆN TẠI =====
  const currentOrderId = selectedTableId ? orderIds[selectedTableId] : undefined;

  const activeItems = useMemo(() => {
    if (!selectedTableId || !orders[selectedTableId]) return [];
    const b = orders[selectedTableId];
    const cur = b.orders.find((o) => o.id === b.activeId);
    return cur?.items ?? [];
  }, [orders, selectedTableId]);

  // ===== PROGRESS TỪ BẾP =====
  const { data: progress = [] } = useKitchenProgress(currentOrderId);

  // tổng đã báo bếp
  const notifiedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of progress as any[]) {
      const prev = m.get(r.menuItemId) ?? 0;
      m.set(r.menuItemId, prev + (Number(r.notified) || 0));
    }
    return m;
  }, [progress]);

  // số phần còn có thể huỷ (PENDING/CONFIRMED)
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

  // ===== DELTA ĐỂ BÁO BẾP =====
  const deltaItems = useMemo(() => {
    if (!currentOrderId) return [];
    return activeItems
      .map((i: any) => {
        const sent = sentQty(i.id);
        return { menuItemId: i.id, delta: Math.max(0, i.qty - sent) };
      })
      .filter((d) => d.delta > 0);
  }, [activeItems, currentOrderId, notifiedMap]);

  // ===== STATE HUỶ 1 PHẦN =====
  const [cancelOneOpen, setCancelOneOpen] = useState(false);
  const [cancelOne, setCancelOne] = useState<CancelTarget | null>(null);

  // thêm món mới
  async function onAdd(menuItemId: string) {
    if (!selectedTableId) return;
    const hadOrder = !!orderIds[selectedTableId];
    await addOne(selectedTableId, menuItemId);
    if (!hadOrder) activeOrdersQuery.refetch?.();
  }

  /**
   * Giảm / tăng số lượng:
   * - Chỉ trừ phần CHƯA báo bếp
   * - Nếu đụng vào phần đã báo bếp:
   *    + Nếu còn cancellable > 0 -> mở modal huỷ (tối đa = cancellable)
   *    + Nếu cancellable = 0 -> không cho huỷ
   */
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

    // delta < 0
    if (next >= totalSent) {
      // chỉ đụng phần chưa gửi bếp
      const reducible = nonSent;
      const apply = Math.max(delta, -reducible);
      if (apply !== 0) {
        await changeQty(selectedTableId, menuItemId, apply, activeItems as any);
      }
      return;
    }

    // next < totalSent -> đụng phần đã gửi bếp
    if (cancelable <= 0) {
      // tất cả phần đã gửi đang nấu / đã ra / đã phục vụ
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

  // LUÔN dùng cancel-partial để không huỷ mất phần đang nấu
async function confirmCancelOne({ qty, reason }: { qty: number; reason: string }) {
  if (!cancelOne) return;
  try {
    // 🟢 LUÔN dùng cancel-partial
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


  // ===== GỬI BẾP =====
  const [notifying, setNotifying] = useState(false);
  const canNotify = !!currentOrderId && deltaItems.length > 0;

  async function onNotify(tableName?: string) {
    if (!currentOrderId) return;
    if (!canNotify || notifying) return;

    try {
      setNotifying(true);
      await api.post(`/kitchen/orders/${currentOrderId}/notify-items`, {
        items: deltaItems,
        priority: true,
        tableName,
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['kitchen-progress', currentOrderId] }),
        qc.invalidateQueries({ queryKey: ['active-orders'] }),
      ]);

      s.emit?.('cashier:notified', { orderId: currentOrderId });
    } catch (e) {
      console.log('notify error', e);
    } finally {
      setNotifying(false);
    }
  }

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
    onChangeQty,  // nhận thêm menuName
    onNotify,
  };
}
