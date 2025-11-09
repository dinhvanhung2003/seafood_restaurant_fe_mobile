// apps/mobile/src/hooks/useOrderSocketLive.ts
import { getSocket } from "@lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useOrderSocketLive(orderId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    // Join 1 lần duy nhất
    let joined = false;
    const join = () => {
      if (!joined) { s.emit("room:join", "waiter"); joined = true; }
    };
    if (s.connected) join(); else s.once("connect", join);

    // Đăng ký listeners
    const onChanged = (p: { orderId: string }) => {
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      if (orderId && p.orderId === orderId) {
        qc.invalidateQueries({ queryKey: ["kitchen-progress", orderId] });
        qc.invalidateQueries({ queryKey: ["kitchen-history", orderId] });
      }
    };
    const onMerged = () => orderId && qc.invalidateQueries({ queryKey: ["active-orders"] });
    const onSplit  = () => orderId && qc.invalidateQueries({ queryKey: ["active-orders"] });

    s.on("orders:changed", onChanged);
    s.on("orders:merged",  onMerged);
    s.on("orders:split",   onSplit);

    return () => {
      s.off("orders:changed", onChanged);
      s.off("orders:merged",  onMerged);
      s.off("orders:split",   onSplit);
    };
  }, [orderId, qc]);
}
