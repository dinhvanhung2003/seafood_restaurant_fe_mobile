import http from "@services/http";

export type ShiftToday = {
  scheduleId: string;
  shiftId: string;
  name: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm
  end: string;    // HH:mm
  note?: string;
};

export async function fetchTodayShifts(dateISO?: string): Promise<ShiftToday[]> {
  const date = dateISO ?? new Date().toISOString().slice(0, 10);
  const res = await http.get<ShiftToday[]>("/schedules/today/me", { params: { date } });
  return res.data ?? [];
} 
export type WeekScheduleRow = {
  scheduleId: string;
  userId: string;
  shiftId: string;
  name: string;     // "Ca sáng" / "Ca chiều" / "Ca tối" ... (tuỳ bạn đặt)
  date: string;     // YYYY-MM-DD
  start: string;    // HH:mm
  end: string;      // HH:mm
  note?: string;
};

/** Lấy lịch theo tuần cho 1 user */
export async function fetchMyWeekSchedules(
  startISO: string, // YYYY-MM-DD (Thứ 2)
  endISO: string,   // YYYY-MM-DD (Chủ nhật)
  userId: string
): Promise<WeekScheduleRow[]> {
  const res = await http.get<WeekScheduleRow[]>("/schedules/week", {
    params: { start: startISO, end: endISO, userIds: userId },
  });
  return res.data ?? [];
}
export type CheckType = "IN" | "OUT";

export type AttendanceCheckPayload = {
  lat: number;
  lng: number;
  accuracy: number;
  clientTs: number;
  netType: string;
  checkType: "IN" | "OUT";
  scheduleId: string;
  imageBase64: string; // <<< thêm
};

export type AttendanceCheckResp = {
  ok: boolean;
  verify: "PASS" | "FAIL_GPS" | "FAIL_WIFI" | "FAIL_RULE" | "FAIL_FACE";
  serverTime: string;
};

export async function postAttendanceCheck(payload: AttendanceCheckPayload) {
  const res = await http.post<AttendanceCheckResp>(
    "/mobile/attendance/check-with-face", // <<< đổi route
    payload
  );
  return res.data;
}


import { useMutation } from "@tanstack/react-query";

import { useQuery } from "@tanstack/react-query";

export function useTodayShifts(dateISO?: string) {
  return useQuery({
    queryKey: ["todayShifts", dateISO ?? new Date().toISOString().slice(0,10)],
    queryFn: () => fetchTodayShifts(dateISO),
    staleTime: 60_000, // 1 phút
  });
}

export function useAttendanceCheck() {
  return useMutation({
    mutationFn: (payload: AttendanceCheckPayload) => postAttendanceCheck(payload),
  });
}
export function useMyWeekSchedules(startISO: string, endISO: string, userId?: string) {
  return useQuery<WeekScheduleRow[]>({
    queryKey: ["myWeekSchedules", startISO, endISO, userId ?? "noUser"],
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return fetchMyWeekSchedules(startISO, endISO, userId);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}