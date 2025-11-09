// src/hooks/mobile/useKitchenFlow.ts
import { useKitchenProgress } from '@hooks/useKitchenProgress'; // đã có ở web, tái dùng
import { useOrders } from '@hooks/useOrder'; // mobile FE hook của bạn
import { getSocket } from '@lib/socket';
import api from '@services/http';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

export type CancelTarget = { orderItemId: string; name: string; qty: number };

export function useKitchenFlow(selectedTableId?: string) {
  const qc = useQueryClient();
  const s = getSocket();
  const { orders, orderIds, addOne, changeQty, activeOrdersQuery } = useOrders();

  const currentOrderId = selectedTableId ? orderIds[selectedTableId] : undefined;
  const { data: progress = [] } = useKitchenProgress(currentOrderId);

  // menuItemId -> tổng đã báo bếp
  const notifiedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of progress) m.set(r.menuItemId, r.notified);
    return m;
  }, [progress]);

  const activeItems = useMemo(() => {
    if (!selectedTableId || !orders[selectedTableId]) return [];
    const b = orders[selectedTableId];
    const cur = b.orders.find((o) => o.id === b.activeId);
    return cur?.items ?? [];
  }, [orders, selectedTableId]);

  const deltaItems = useMemo(() => {
    if (!currentOrderId) return [];
    return activeItems
      .map(i => {
        const sent = notifiedMap.get(i.id) ?? 0;
        return { menuItemId: i.id, delta: Math.max(0, i.qty - sent) };
      })
      .filter(d => d.delta > 0);
  }, [activeItems, notifiedMap, currentOrderId]);

  const sentQty = (menuItemId: string) => notifiedMap.get(menuItemId) ?? 0;

  // ====== Cancel modal state ======
  const [cancelOneOpen, setCancelOneOpen] = useState(false);
  const [cancelOne, setCancelOne] = useState<CancelTarget | null>(null);

  // ====== Actions ======

  async function onAdd(menuItemId: string) {
    if (!selectedTableId) return;
    const hadOrder = !!orderIds[selectedTableId];
    await addOne(selectedTableId, menuItemId);
    if (!hadOrder) activeOrdersQuery.refetch?.();
  }

  // chỉ giảm khi chưa báo bếp; nếu “đụng” phần đã báo ⇒ mở modal huỷ
  async function onChangeQty(menuItemId: string, delta: number) {
    if (!selectedTableId) return;
    const it = activeItems.find(x => x.id === menuItemId);
    const cur = it?.qty ?? 0;
    const next = Math.max(0, cur + delta);

    if (!it) {
      if (delta > 0) await onAdd(menuItemId);
      return;
    }

    const alreadySent = sentQty(menuItemId);

    if (delta > 0) {
      await onAdd(menuItemId); // thêm dòng mới để batch sau rõ ràng
      return;
    }

    // delta < 0
    if (next >= alreadySent) {
      // còn đủ phần chưa gửi để giảm
      const reducible = cur - alreadySent;
      const apply = Math.max(delta, -reducible);
      if (apply !== 0) await changeQty(selectedTableId, menuItemId, apply, activeItems);
      return;
    }

    // cần huỷ phần đã báo
    setCancelOne({
      orderItemId: it.rowId!,
      name: '',
      qty: alreadySent, // cho phép huỷ tối đa phần đã gửi
    });
    setCancelOneOpen(true);
  }

  async function confirmCancelOne({ qty, reason }: { qty: number; reason: string }) {
    if (!cancelOne) return;
    try {
      if (qty >= cancelOne.qty) {
        await api.patch(`/orderitems/cancel`, { itemIds: [cancelOne.orderItemId], reason });
      } else {
        await api.patch(`/orderitems/cancel-partial`, { itemId: cancelOne.orderItemId, qty, reason });
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['active-orders'] }),
        currentOrderId ? qc.invalidateQueries({ queryKey: ['kitchen-progress', currentOrderId] }) : Promise.resolve(),
      ]);
    //   toast.success('Đã huỷ món');
    } catch (e: any) {
    //   toast.error('Huỷ món thất bại', { description: e?.response?.data?.message || e.message });
    } finally {
      setCancelOneOpen(false);
      setCancelOne(null);
    }
  }

  const [notifying, setNotifying] = useState(false);
  const canNotify = !!currentOrderId && (deltaItems.length > 0);

  async function onNotify(tableName?: string) {
    if (!currentOrderId) return
    //  toast.error('Chưa có order!');
    if (!canNotify || notifying) return;

    try {
      setNotifying(true);
      await api.post(`/kitchen/orders/${currentOrderId}/notify-items`, {
        items: deltaItems, // [{ menuItemId, delta }]
        priority: true,
        tableName,
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['kitchen-progress', currentOrderId] }),
        qc.invalidateQueries({ queryKey: ['active-orders'] }),
      ]);

      // báo socket (nếu BE dùng)
      s.emit?.('cashier:notified', { orderId: currentOrderId });

    //   toast.success('Đã gửi bếp!');
    } catch (e: any) {
    //   toast.error('Không thể gửi bếp', { description: e?.response?.data?.message || e.message });
    } finally {
      setNotifying(false);
    }
  }

  return {
    // data
    currentOrderId,
    activeItems,
    deltaItems,
    canNotify,
    notifying,

    // cancel modal
    cancelOneOpen,
    cancelOne,
    setCancelOneOpen,
    confirmCancelOne,

    // handlers
    onAdd,
    onChangeQty,
    onNotify,
  };
}
