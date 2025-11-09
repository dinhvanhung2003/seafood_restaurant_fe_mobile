import { getSocket } from "@lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Dùng cho waiter (mobile) để đồng bộ danh sách bàn khi có đơn mới / hủy / gộp / tách
 */
export function useTableSocketLive() {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    // ✅ join phòng waiter để nhận các event
    const join = () => s.emit("room:join", "waiter");
    s.connected ? join() : s.once("connect", join);

    // refetch lại danh sách order + bàn
    const refetch = (orderId?: string) => {
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      qc.invalidateQueries({ queryKey: ["areas"] }); // nếu bàn phụ thuộc khu vực
    };

    const onChanged = (p: { orderId: string }) => refetch(p.orderId);
    const onMerged = () => refetch();
    const onSplit = () => refetch();
    const onOrderVoided = (p: { orderId: string }) => refetch(p.orderId);
    const onNewBatch = (p: { orderId: string }) => refetch(p.orderId);

    s.on("orders:changed", onChanged);
    s.on("orders:merged", onMerged);
    s.on("orders:split", onSplit);
    s.on("kitchen:order_voided", onOrderVoided);
    s.on("kitchen:new_batch", onNewBatch);

    return () => {
      s.off("orders:changed", onChanged);
      s.off("orders:merged", onMerged);
      s.off("orders:split", onSplit);
      s.off("kitchen:order_voided", onOrderVoided);
      s.off("kitchen:new_batch", onNewBatch);
    };
  }, [qc]);
}
