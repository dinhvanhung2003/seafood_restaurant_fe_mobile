import { getSocket } from "@lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export function usePosSocketLive(orderId?: string) {
  const qc = useQueryClient();
  const joinedRef = useRef(false);

  useEffect(() => {
    const s = getSocket();

    const join = () => {
      if (!joinedRef.current) {
        s.emit("room:join", "waiter");
        joinedRef.current = true;
      }
    };
    s.connected ? join() : s.once("connect", join);

    const refetchOrder = (touchId?: string) => {
      // danh sách
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      // chi tiết/tiến độ đơn hiện tại
      if (orderId && (!touchId || touchId === orderId)) {
        qc.invalidateQueries({ queryKey: ["kitchen-progress", orderId] });
        qc.invalidateQueries({ queryKey: ["kitchen-history", orderId] });
      }
    };

    // ---- Orders
    const onChanged = (p: { orderId: string }) => refetchOrder(p.orderId);
    const onMerged  = () => refetchOrder(orderId);
    const onSplit   = () => refetchOrder(orderId);

    s.on("orders:changed", onChanged);
    s.on("orders:merged",  onMerged);
    s.on("orders:split",   onSplit);

    // ---- Kitchen
    const onKitchenChanged = (payload: { items: Array<{ orderId: string }>}) => {
      if (!orderId) return;
      if (payload?.items?.some?.(x => x.orderId === orderId)) refetchOrder(orderId);
    };
    const onNewBatch = (payload: { orderId: string }) => {
      if (payload?.orderId === orderId) refetchOrder(orderId);
    };

    s.on("kitchen:ticket_status_changed", onKitchenChanged);
    s.on("kitchen:new_batch", onNewBatch);

    return () => {
      s.off("orders:changed", onChanged);
      s.off("orders:merged",  onMerged);
      s.off("orders:split",   onSplit);
      s.off("kitchen:ticket_status_changed", onKitchenChanged);
      s.off("kitchen:new_batch", onNewBatch);
    };
  }, [orderId, qc]);
}
