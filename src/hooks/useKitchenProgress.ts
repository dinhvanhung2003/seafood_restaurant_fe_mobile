import http from "@services/http";
import { useQuery } from "@tanstack/react-query";
export function useKitchenProgress(orderId?: string) {
  return useQuery({
    queryKey: ["kitchen-progress", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data } = await http.get(`/kitchen/orders/${orderId}/progress`);
      return data as Array<{ menuItemId: string; name: string; notified: number; preparing: number; ready: number; served: number; cooked: number }>;
    },
    staleTime: 5_000,
  });
}
