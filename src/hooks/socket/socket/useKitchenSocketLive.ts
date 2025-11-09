import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSocket } from "../../../lib/socket";

type ChangedPayload = {
  items: Array<{
    orderId: string;
    ticketId: string;
    menuItemId: string;
    qty: number;
    fromStatus: string;
    toStatus: string;
  }>;
};

type NewBatchPayload = {
  orderId: string;
  tableName: string;
  batchId: string;
  createdAt: string;
  items: Array<{ orderItemId: string; name: string; qty: number }>;
  staff: string;
  priority?: boolean;
};

export function useKitchenSocketLive(orderId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    const join = () => s.emit("room:join", "waiter"); // 👈 join room waiter
    s.connected ? join() : s.once("connect", join);

    const refetch = () => {
      if (!orderId) return;
      qc.invalidateQueries({ queryKey: ["kitchen-progress", orderId] });
      qc.invalidateQueries({ queryKey: ["kitchen-history", orderId] });
    };

    const onChanged = (payload: ChangedPayload) => {
      if (!orderId) return;
      // chỉ refetch nếu có item thuộc order này
      if (payload?.items?.some?.(x => x.orderId === orderId)) {
        refetch();
      }
    };

    const onNewBatch = (payload: NewBatchPayload) => {
      if (payload?.orderId === orderId) refetch();
    };

    s.on("kitchen:ticket_status_changed", onChanged);
    s.on("kitchen:new_batch", onNewBatch);

    return () => {
      s.off("kitchen:ticket_status_changed", onChanged);
      s.off("kitchen:new_batch", onNewBatch);
    };
  }, [orderId, qc]);
}
