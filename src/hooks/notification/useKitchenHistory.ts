// src/hooks/notification/useKitchenHistory.ts
import http from '@services/http';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type HistoryItem = {
  id: string;
  createdAt: string;
  staff: string;
  tableName: string;
  note: string | null;
  priority: boolean;
  items: { menuItemId: string; name: string; qty: number }[];
};

export function useKitchenHistory(orderId?: string) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['kitchen-history', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const res = await http.get(`/kitchen/orders/${orderId}/notify-history`);
      return res.data as HistoryItem[];
    },
    staleTime: 15_000,
  });

  // giống web: prepend khi cần optimistic
  const prepend = (h: HistoryItem) => {
    qc.setQueryData<HistoryItem[]>(['kitchen-history', orderId], (prev) => [h, ...(prev ?? [])]);
  };

  return { ...q, prepend };
}
