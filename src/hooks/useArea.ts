// src/hooks/useAreas.ts
import http from '@services/http';
import { useQuery } from '@tanstack/react-query';

export type Area = {
  id: string;
  name: string;         // Tầng / Khu
  tables: { id: string; name: string; seats: number }[];
};

async function fetchAreas(): Promise<Area[]> {
  const { data } = await http.get('/area/get-list-area');
  return Array.isArray(data) ? data : data?.data ?? [];
}

export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreas,
    staleTime: 60_000,
  });
}
