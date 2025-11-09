// src/hooks/socket/useCancelSocketLive.ts
import { getSocket } from "@lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Lắng nghe các sự kiện huỷ món từ bếp, áp dụng cho cả waiter & cashier
 * Tự động invalidate các query: active-orders, kitchen-progress, kitchen-history
 */
export function useCancelSocketLive(orderId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    // Đảm bảo join room waiter/cashier tùy context
    const join = () => {
      s.emit("room:join", "waiter");
      s.emit("room:join", "cashier");
    };
    s.connected ? join() : s.once("connect", join);

    const refetch = (oid?: string) => {
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      if (oid && oid === orderId) {
        qc.invalidateQueries({ queryKey: ["kitchen-progress", oid] });
        qc.invalidateQueries({ queryKey: ["kitchen-history", oid] });
      }
    };

    // --- Các sự kiện từ bếp ---
    const onVoided = (p: { orderId: string }) => refetch(p.orderId);
    const onPatched = (p: { orderId: string }) => refetch(p.orderId);
    const onOrderVoided = (p: { orderId: string }) => refetch(p.orderId);
    const onStatusChanged = (p: { orderId: string }) => refetch(p.orderId);

    // Đăng ký event socket
    s.on("kitchen:tickets_voided", onVoided);
    s.on("kitchen:tickets_patched", onPatched);
    s.on("kitchen:order_voided", onOrderVoided);
    s.on("kitchen:ticket_status_changed", onStatusChanged);

    // Dọn dẹp khi unmount
    return () => {
      s.off("kitchen:tickets_voided", onVoided);
      s.off("kitchen:tickets_patched", onPatched);
      s.off("kitchen:order_voided", onOrderVoided);
      s.off("kitchen:ticket_status_changed", onStatusChanged);
    };
  }, [orderId, qc]);
}
