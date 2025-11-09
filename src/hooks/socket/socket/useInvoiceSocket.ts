// dùng chung web/mobile
import { getSocket } from "@lib/socket"; // đã có sẵn của bạn
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type Options = {
  onPaid?: (p: { invoiceId: string; amount?: number; method?: string }) => void;
  onPartial?: (p: { invoiceId: string; amount: number; remaining: number }) => void;
  // các queryKeys bạn muốn tự invalidates thêm
  extraInvalidate?: Array<{ key: unknown[] }>;
};

/** Lắng nghe sự kiện thanh toán của 1 invoice cụ thể */
export function useInvoiceSocket(invoiceId?: string, opts: Options = {}) {
  const qc = useQueryClient();
  const joined = useRef(false);

  useEffect(() => {
    if (!invoiceId) return;

    const s = getSocket(); // trỏ tới namespace /realtime
    const join = () => {
      if (!joined.current) {
        s.emit("join_invoice", { invoiceId });
        joined.current = true;
      }
    };
    s.connected ? join() : s.once("connect", join);

    const onPaid = (p: any) => {
      // refetch dữ liệu liên quan
      qc.invalidateQueries({ queryKey: ["invoice.detail", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices.list"] });
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      qc.invalidateQueries({ queryKey: ["pos-tables"] });
      opts.extraInvalidate?.forEach(({ key }) => qc.invalidateQueries({ queryKey: key }));

      opts.onPaid?.(p);
    };

    const onPartial = (p: any) => {
      qc.invalidateQueries({ queryKey: ["invoice.detail", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices.list"] });
      opts.onPartial?.(p);
    };

    s.on("invoice.paid", onPaid);
    s.on("invoice.partial", onPartial);

    return () => {
      try { s.emit("leave_invoice", { invoiceId }); } catch {}
      s.off("invoice.paid", onPaid);
      s.off("invoice.partial", onPartial);
      joined.current = false;
    };
  }, [invoiceId]);
}
