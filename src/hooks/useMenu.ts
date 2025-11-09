"use client";
import http from "@services/http";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

type UseMenuArgs = {
  page: number;
  limit: number;
  search: string;
  categoryId: string;
};

// Nếu BE trả về { data, meta } thì giữ nguyên kiểu trả về như cũ
async function fetchMenu(params: {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
}) {
  const safeLimit = Math.max(1, Math.min(Number(params.limit ?? 12), 100));

  const { data } = await http.get("/menuitems/list-menuitems", {
    params: {
      ...params,
      limit: safeLimit,
      sortBy: "name",
      order: "ASC",
    },
  });

  return data; // có thể là { data, meta } hoặc mảng, tuỳ BE
}

export function useMenu({ page, limit, search, categoryId }: UseMenuArgs) {
  const cat = categoryId === "all" ? undefined : categoryId;
  const q = search || undefined;

  return useQuery({
    queryKey: ["menu", { page, limit, search: q, categoryId: cat }],
    queryFn: () => fetchMenu({ page, limit, search: q, categoryId: cat }),
    enabled: true, // interceptor sẽ tự lo Authorization
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
