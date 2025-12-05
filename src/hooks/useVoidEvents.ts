// src/hooks/useVoidEvents.ts
import api from '@services/http';
import { useQuery } from '@tanstack/react-query';

export type VoidEventRow = {
  id: string;
  tableName: string;
  itemName: string;
  qty: number;
  createdAt: string;
  source: 'cashier' | 'waiter' | 'kitchen';
  reason: string | null;
  byName: string | null;
};

export function useVoidEvents(tableId?: string) {
  return useQuery({
    enabled: !!tableId,
    queryKey: ['void-events', tableId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const res = await api.get<VoidEventRow[]>(
        `/void-events/by-table/${tableId}`,
        { params: { date: today } },
      );
      return res.data;
    },
  });
}
