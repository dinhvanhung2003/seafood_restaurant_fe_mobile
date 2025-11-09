// src/hooks/useOrders.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// ✅ axios instance của bạn (đổi đường dẫn cho đúng)
import api from '@services/http';
// hoặc: import { api } from '@lib/axios';

// ✅ flash-message helper (xem file mẫu ở dưới)
import { notify } from '@utils/notify';

/* ======================== Types tối thiểu dùng cho UI ======================= */

export type ItemStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'PAID'
  | 'CANCELLED';

export type UIOrderItem = {
  id: string;          // menuItemId
  qty: number;         // số lượng hiển thị trên UI
  rowId?: string;      // orderItemId (nếu đã có trên server)
};

export type UIOrderTab = {
  id: string;          // internal id tab (UI)
  label: string;       // "1", "2", ...
  items: UIOrderItem[];
};

export type OrdersByTable = Record<
  string, // tableId
  { activeId: string; orders: UIOrderTab[] }
>;

/* ======================== Utils ======================= */

const _uid = () => Math.random().toString(36).slice(2, 9);

const makeBatchId = () => {
  try {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

/* ======================== API helpers ======================= */

async function fetchOrders() {
  // BE nên trả về danh sách order đang active (khác PAID/CANCELLED)
  const res = await api.get('/orders', {
    params: { page: 1, limit: 200, excludeStatus: 'PAID,CANCELLED,MERGED' },
  });
  const json = res.data;
  // tuỳ BE, bạn có thể chỉnh lại access data
  return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
}

/* ======================== Hook chính ======================= */

export function useOrders() {
  const qc = useQueryClient();

  // State cho UI
  const [orders, setOrders] = useState<OrdersByTable>({});
  const [orderIds, setOrderIds] = useState<Record<string, string>>({}); // tableId -> orderId

  // Query lấy các đơn đang hoạt động
  const activeOrdersQuery = useQuery({
    queryKey: ['active-orders'],
    queryFn: fetchOrders,
    enabled: true,       // nếu muốn: chỉ bật khi đã có token
    staleTime: 10_000,
  });

  // Đồng bộ dữ liệu server -> state UI
    const [amountByTable, setAmountByTable] = useState<Record<string, number>>({}); // NEW

  useEffect(() => {
  const rows = activeOrdersQuery.data ?? [];

  const nextOrders: OrdersByTable = {};
  const nextOrderIds: Record<string, string> = {};
  const nextAmountByTable: Record<string, number> = {}; // <— NEW

  const toNum = (v: any) => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  for (const o of rows) {
    const tid = o.table?.id ?? o.tableId;
    if (!tid) continue;

    nextOrderIds[tid] = o.id;

    // map items cho UI
    const items: UIOrderItem[] = (o.items ?? []).map((it: any) => ({
      id: it.menuItem?.id ?? it.menuItemId,
      qty: it.quantity,
      rowId: it.id,
    }));

    const tabId = Math.random().toString(36).slice(2, 9);
    nextOrders[tid] = { activeId: tabId, orders: [{ id: tabId, label: '1', items }] };

    // ✅ tính tổng tiền
    const total = (o.items ?? []).reduce((sum: number, it: any) => {
      const qty = toNum(it.quantity);
      const price = toNum(it.price ?? it.menuItem?.price ?? 0);
      return sum + qty * price;
    }, 0);

    nextAmountByTable[tid] = total; // <— lưu tổng tiền
  }

  setOrders(nextOrders);
  setOrderIds(nextOrderIds);
  setAmountByTable(nextAmountByTable); // <— NEW
}, [activeOrdersQuery.data]);


  /* ----------------------- Mutations (server) ----------------------- */

  // Tạo order mới
  const createOrderMu = useMutation({
    mutationFn: async (payload: {
      tableId: string;
      items: { menuItemId: string; quantity: number }[];
      orderType?: 'DINE_IN' | 'TAKE_AWAY';
    }) => {
      const res = await api.post('/orders', {
        
        orderType: payload.orderType ?? 'DINE_IN',
        ...payload,
      });
      console.log('[FE] order created:', res.data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  });

  // Thêm item (có thể kèm batchId)
  const addItemsMu = useMutation({
    mutationFn: async (arg: {
      orderId: string;
      items: { menuItemId: string; quantity: number }[];
      batchId?: string;
    }) => {
      const body = arg.batchId ? { items: arg.items, batchId: arg.batchId } : { items: arg.items };
      const res = await api.post(`/orders/${arg.orderId}/items`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  });

  // Xoá 1 dòng item (orderItemId)
  const removeItemMu = useMutation({
    mutationFn: async (arg: { orderId: string; orderItemId: string }) => {
      const res = await api.patch(`/orders/${arg.orderId}/items/${arg.orderItemId}/remove`, {});
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  });

  // Set quantity cho 1 orderItem (nếu bị lock sẽ trả 400/404)
  const setItemQtyMu = useMutation({
    mutationFn: async (arg: {
      orderId: string;
      orderItemId: string;
      quantity: number;
      menuItemId: string;
    }) => {
      try {
        const res = await api.patch(`/orders/${arg.orderId}/items/${arg.orderItemId}/qty`, {
          quantity: arg.quantity,
        });
        return { ok: true, data: res.data as any };
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) return { ok: false, reason: 'NOT_FOUND' as const };
        if (status === 400) return { ok: false, reason: 'LOCKED' as const };
        throw e;
      }
    },
    onSuccess: (data) => {
      if (data?.ok) qc.invalidateQueries({ queryKey: ['active-orders'] });
    },
  });

  // Cập nhật trạng thái order (soft confirm, v.v.)
  const updateStatusMu = useMutation({
    mutationFn: async (arg: {
      orderId: string;
      status:
        | 'PENDING'
        | 'CONFIRMED'
        | 'PREPARING'
        | 'READY'
        | 'SERVED'
        | 'PAID'
        | 'CANCELLED';
    }) => {
      const res = await api.patch(`/orders/${arg.orderId}/status`, { status: arg.status });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  });

  // Tạo invoice từ order
  const createInvoiceMu = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await api.post(`/invoices/from-order/${orderId}`);
      return res.data;
    },
  });

  // Thanh toán cash cho invoice
  const cashPayMu = useMutation({
    mutationFn: async ({ invoiceId, amount }: { invoiceId: string; amount: number }) => {
      const res = await api.post(`/invoices/${invoiceId}/payments`, {
        amount,
        method: 'CASH',
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  });

  // Huỷ order
  const cancelMu = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.patch(`/orders/${orderId}/cancel`, { reason: 'Cashier cancel' });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-orders'] }),
  });

  /* ----------------------- Actions (dùng trong UI) ----------------------- */

  // Thêm 1 món (tự tạo order nếu bàn chưa có)
  async function addOne(tableId: string, menuItemId: string) {
    let oid = orderIds[tableId];

    // chưa có order -> tạo mới với 1 item
    if (!oid) {
      const created = await createOrderMu.mutateAsync({
        tableId,
        items: [{ menuItemId, quantity: 1 }],
        orderType: 'DINE_IN',
      });
      oid = created?.id;
      setOrderIds((p) => ({ ...p, [tableId]: oid! }));
      return;
    }

    // có order -> tìm dòng hiện tại (nếu có)
    const curItems = orders[tableId]?.orders?.[0]?.items ?? [];
    const ex = curItems.find((x) => x.id === menuItemId);

    // chưa có rowId => thêm dòng mới
    if (!ex?.rowId) {
      await addItemsMu.mutateAsync({ orderId: oid, items: [{ menuItemId, quantity: 1 }] });
      return;
    }

    // đã có rowId -> thử tăng qty
    const r = await setItemQtyMu.mutateAsync({
      orderId: oid,
      orderItemId: ex.rowId,
      quantity: ex.qty + 1,
      menuItemId,
    });

    // nếu row bị lock/404, thêm thành dòng mới
    if (!r?.ok) {
      if (r?.reason === 'LOCKED' || r?.reason === 'NOT_FOUND') {
        await addItemsMu.mutateAsync({ orderId: oid, items: [{ menuItemId, quantity: 1 }] });
      }
    }
  }

  // Thêm nhiều món 1 lần (gom theo batchId)
  async function addMany(
    tableId: string,
    items: { menuItemId: string; quantity: number }[],
    opts?: { batchId?: string },
  ) {
    const batchId = opts?.batchId || makeBatchId();
    let oid = orderIds[tableId];

    if (!oid) {
      const created = await createOrderMu.mutateAsync({
        tableId,
        items,
        orderType: 'DINE_IN',
      });
      oid = created?.id;
      setOrderIds((p) => ({ ...p, [tableId]: oid! }));
    } else {
      await addItemsMu.mutateAsync({ orderId: oid, items, batchId });
    }

    return { orderId: oid, batchId };
  }

  const addWithBatch = addMany;

  // Tăng / giảm số lượng cho 1 menuItem trên UI
  async function changeQty(
    tableId: string,
    menuItemId: string,
    delta: number,
    currentItems: UIOrderItem[],
  ) {
    const oid = orderIds[tableId];
    if (!oid) {
      if (delta > 0) return addOne(tableId, menuItemId);
      return;
    }

    const it = currentItems.find((x) => x.id === menuItemId);
    const cur = it?.qty ?? 0;
    const next = Math.max(0, cur + delta);

    // chưa có item mà delta dương -> thêm mới
    if (!it && delta > 0) {
      await addItemsMu.mutateAsync({ orderId: oid, items: [{ menuItemId, quantity: 1 }] });
      return;
    }
    if (!it) return;

    try {
      await setItemQtyMu.mutateAsync({
        orderId: oid,
        orderItemId: it.rowId!,
        quantity: next,
        menuItemId,
      });
    } catch (e: any) {
      // nếu BE trả 400 khi row bị lock và delta > 0 -> tạo dòng mới
      if (e?.response?.status === 400 && delta > 0) {
        await addItemsMu.mutateAsync({ orderId: oid, items: [{ menuItemId, quantity: delta }] });
        return;
      }
      throw e;
    }
  }

  // Xoá sạch các item (UI truyền danh sách đang hiển thị)
  async function clear(tableId: string, items: UIOrderItem[]) {
    const oid = orderIds[tableId];
    if (!oid) return;
    for (const it of items) {
      if (it.rowId) await removeItemMu.mutateAsync({ orderId: oid, orderItemId: it.rowId });
    }
  }

  // “Báo bếp” (soft re-confirm)
  async function confirm(tableId: string) {
    const oid = orderIds[tableId];
    if (!oid) return notify.error('Chưa có đơn để gửi bếp');
    await updateStatusMu.mutateAsync({ orderId: oid, status: 'CONFIRMED' });
    notify.success('Đã gửi bếp');
  }

  // Thanh toán tiền mặt
  async function payByCash(tableId: string, amount: number) {
    const oid = orderIds[tableId];
    if (!oid) return notify.error('Không tìm thấy order để thanh toán');
    const inv = await createInvoiceMu.mutateAsync({ orderId: oid });
    const invoiceId = inv?.id ?? inv?.data?.id ?? inv?.invoice?.id;
    await cashPayMu.mutateAsync({ invoiceId, amount });
    notify.success('Thanh toán thành công');
    qc.invalidateQueries({ queryKey: ['active-orders'] });
  }

  // Huỷ đơn
  async function cancel(tableId: string) {
    const oid = orderIds[tableId];
    if (!oid) return notify.error('Không tìm thấy order để huỷ');
    await cancelMu.mutateAsync(oid);
    notify.success('Đã huỷ đơn');
  }

  return {
    // data
    activeOrdersQuery,
    orders,
    orderIds,
 amountByTable, // NEW
    // actions
    addOne,
    addMany,
    addWithBatch,
    changeQty,
    clear,
    confirm,
    pay: payByCash,
    cancel,
    
  };
}
