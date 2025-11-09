import http from "@services/http";
import { useQuery } from "@tanstack/react-query";

export function useKitchenHistory(orderId?: string) {
  return useQuery({
    queryKey: ["kitchen-history", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data } = await http.get(`/kitchen/orders/${orderId}/notify-history`);
      return data as Array<{
        id: string; createdAt: string; staff: string; tableName: string;
        note: string | null; priority: boolean;
        items: Array<{ menuItemId: string; name: string; qty: number }>;
      }>;
    },
    staleTime: 5_000,
  });
}
