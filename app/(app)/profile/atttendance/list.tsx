import { useMyWeekSchedules } from "@hooks/useAttendance";
import { useAuth } from "@providers/AuthProvider";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import tw from "twrnc";

/* ========= Helpers ========= */

// YYYY-MM-DD theo GIỜ LOCAL (không dùng toISOString để tránh lệch ngày)
function toLocalDateISO(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Lấy thứ 2 của tuần chứa d
function startOfWeekMonday(d = new Date()) {
  const cd = new Date(d);
  const day = (cd.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  cd.setHours(0, 0, 0, 0);
  cd.setDate(cd.getDate() - day);
  return cd;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addWeeks(d: Date, w: number) {
  return addDays(d, w * 7);
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Map ca → màu chấm (tuỳ hệ thống ca của bạn)
function dotColor(shiftName: string) {
  if (/sáng/i.test(shiftName)) return "bg-violet-500";
  if (/chiều/i.test(shiftName)) return "bg-sky-500";
  if (/tối|đêm/i.test(shiftName)) return "bg-slate-400";
  return "bg-emerald-500";
}

/* ========= Screen ========= */

export default function MyAttendanceListScreen() {
  const { profile } = useAuth(); // profile.id = userId
  const [anchor, setAnchor] = useState<Date>(startOfWeekMonday(new Date()));

  // 7 ngày trong tuần hiện tại (anchor là thứ 2)
  const weekDays = useMemo(
    () => [...Array(7)].map((_, i) => addDays(anchor, i)),
    [anchor]
  );

  // range gửi lên API (YYYY-MM-DD local)
  const startISO = useMemo(() => toLocalDateISO(weekDays[0]), [weekDays]);
  const endISO = useMemo(() => toLocalDateISO(weekDays[6]), [weekDays]);

  const { data = [], isLoading } = useMyWeekSchedules(
    startISO,
    endISO,
    profile?.id
  );

  // Lấy danh sách ca duy nhất (theo name), sort theo giờ bắt đầu
  const shiftRows = useMemo(() => {
    const uniqueNames = Array.from(new Set(data.map((r) => r.name)));
    const nameToFirst = (name: string) => data.find((r) => r.name === name)!;

    return uniqueNames
      .map((n) => ({
        name: n,
        sample: nameToFirst(n),
      }))
      .sort((a, b) => a.sample.start.localeCompare(b.sample.start));
  }, [data]);

  // Tạo set lookup: key = date|name (date dạng YYYY-MM-DD từ BE)
  const hasCell = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => set.add(`${r.date}|${r.name}`));
    return set;
  }, [data]);

  return (
    <View style={tw`flex-1 bg-white`}>
      {/* Header */}
      <View style={tw`px-4 pt-10 pb-3`}>
        <Text style={tw`text-xl font-extrabold`}>Bảng chấm công</Text>

        <View style={tw`mt-3 flex-row gap-2`}>
          <TouchableOpacity
            onPress={() => setAnchor(addWeeks(anchor, -1))}
            style={tw`px-3 h-9 rounded-full bg-slate-100 items-center justify-center`}
          >
            <Text style={tw`text-slate-700`}>Tuần trước</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAnchor(startOfWeekMonday(new Date()))}
            style={tw`px-3 h-9 rounded-full bg-blue-50 border border-blue-200 items-center justify-center`}
          >
            <Text style={tw`text-blue-700`}>Tuần này</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAnchor(addWeeks(anchor, +1))}
            style={tw`px-3 h-9 rounded-full bg-slate-100 items-center justify-center`}
          >
            <Text style={tw`text-slate-700`}>Tuần sau</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Subheader ngày trong tuần */}
      <View style={tw`px-4`}>
        <View style={tw`flex-row border-b border-slate-100 pb-2`}>
          {/* cột tiêu đề ca */}
          <View style={tw`w-[120px]`} />
          {/* 7 cột ngày */}
          {weekDays.map((d, i) => {
            const dayKey = toLocalDateISO(d);
            return (
              <View key={`${dayKey}-${i}`} style={tw`flex-1 items-center`}>
                <Text style={tw`text-slate-500`}>{WEEKDAY_LABELS[i]}</Text>
                <Text style={tw`font-semibold`}>{d.getDate()}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Nội dung */}
      <ScrollView style={tw`px-4`} contentContainerStyle={tw`pb-8`}>
        {isLoading ? (
          <View style={tw`py-10 items-center`}>
            <ActivityIndicator />
          </View>
        ) : shiftRows.length === 0 ? (
          <View style={tw`py-10 items-center`}>
            <Text style={tw`text-slate-500`}>Tuần này bạn không có ca.</Text>
          </View>
        ) : (
          shiftRows.map((row, rowIndex) => {
            const safeName = row.name || "NO_NAME";
            const rowKey = `${safeName}-${rowIndex}`; // key luôn là string

            return (
              <View
                key={rowKey}
                style={tw`flex-row items-center border-b border-slate-100 py-3`}
              >
                {/* Tên ca + khung giờ */}
                <View style={tw`w-[120px]`}>
                  <Text style={tw`font-semibold`}>
                    {row.name || "Không tên"}
                  </Text>
                  <Text style={tw`text-slate-500`}>
                    {row.sample.start}–{row.sample.end}
                  </Text>
                </View>

                {/* 7 cột / 7 ngày */}
                {weekDays.map((d, colIndex) => {
                  const dayKey = toLocalDateISO(d);
                  const exists = hasCell.has(`${dayKey}|${row.name}`);
                  const cellKey = `${rowKey}|${dayKey}|${colIndex}`; // key duy nhất

                  return (
                    <View
                      key={cellKey}
                      style={tw`flex-1 items-center justify-center h-10`}
                    >
                      {exists ? (
                        <View
                          style={tw`w-3 h-3 rounded-full ${dotColor(
                            row.name || ""
                          )}`}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
