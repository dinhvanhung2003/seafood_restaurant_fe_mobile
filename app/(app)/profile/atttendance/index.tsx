import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Text, TouchableOpacity, View } from "react-native";
import tw from "twrnc";

import type { CheckType } from "@hooks/useAttendance";
import { useAttendanceCheck, useTodayShifts } from "@hooks/useAttendance";
import { useAuth } from "@providers/AuthProvider";

const toYMD = (d = new Date()) => d.toISOString().slice(0, 10);
const nowHHmm = (d = new Date()) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function MobileAttendanceScreen() {
  const { profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const fade = useRef(new Animated.Value(0)).current;

  const { data: shifts = [], isLoading, refetch } = useTodayShifts(toYMD());
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (shifts.length && !selectedScheduleId) setSelectedScheduleId(shifts[0].scheduleId);
  }, [shifts, selectedScheduleId]);

  // đồng hồ
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hhmm = useMemo(() => nowHHmm(now), [now]);

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start(() =>
      setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
          setToast(null)
        );
      }, 2200)
    );
  }

  const { mutateAsync: checkAttendance, isPending } = useAttendanceCheck();
  const [success, setSuccess] = useState<{ type: CheckType; time: string } | null>(null);

  async function handleCheck(type: CheckType) {
    if (!selectedScheduleId) {
      showToast("Hôm nay bạn không có ca được phân.");
      return;
    }

    // 1) Bật location service?
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) { showToast("Hãy bật Dịch vụ vị trí."); return; }

    // 2) Quyền vị trí
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      showToast(canAskAgain ? "Hãy cho phép quyền vị trí." : "Ứng dụng chưa có quyền vị trí.");
      return;
    }

    // 3) Vị trí
    let pos: Location.LocationObject | null = null;
    try {
      pos = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === "android" ? Location.Accuracy.Balanced : Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });
    } catch {
      pos = await Location.getLastKnownPositionAsync();
    }
    if (!pos) { showToast("Không lấy được vị trí."); return; }

    // 4) Mạng
    const net = await Network.getNetworkStateAsync();
    const isConnected = !!net.isConnected;
    if (!isConnected) { showToast("Thiết bị đang offline."); return; }
    const netType = `${net.type ?? "unknown"}${isConnected ? "" : "_offline"}`;

    // 5) Gọi API
    try {
      const result = await checkAttendance({
        lat: +pos.coords.latitude,
        lng: +pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy || 0),
        clientTs: Date.now(),
        netType,
        checkType: type,
        scheduleId: selectedScheduleId,
      });

      if (result.ok) {
        setSuccess({
          type,
          time:
            now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) +
            " " +
            now.toLocaleDateString("vi-VN"),
        });
        refetch();
      } else if (result.verify === "FAIL_GPS") showToast("❌ Không ở trong vùng GPS.");
      else if (result.verify === "FAIL_WIFI") showToast("❌ Không đúng Wi-Fi/IP.");
      else showToast("❌ Không hợp lệ.");
    } catch (e: any) {
      const s = e?.response?.status;
      const m = e?.response?.data?.message ?? e?.message;
      showToast(`⚠️ Lỗi ${s ?? ""} ${Array.isArray(m) ? m.join(", ") : m}`);
    }
  }

  const noShift = (shifts?.length ?? 0) === 0;

  return (
    <View style={tw`flex-1 bg-white pt-8 px-4`}>
      {/* Đồng hồ */}
      <Text style={tw`text-4xl font-bold text-center`}>{hhmm}</Text>
      <Text style={tw`text-slate-500 text-center mb-4`}>
        {now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
      </Text>

      {/* Card chọn ca */}
      <View style={tw`border border-slate-200 rounded-2xl p-3 mb-3`}>
        <Text style={tw`text-[13px] text-slate-700 mb-2`}>Ca làm việc</Text>
        <View style={tw`border border-slate-200 rounded-xl overflow-hidden`}>
          <Picker
            selectedValue={selectedScheduleId}
            onValueChange={(v) => setSelectedScheduleId(v as string)}
            enabled={!noShift && !isLoading}
            style={tw`h-11`}
          >
            {noShift ? (
              <Picker.Item label="Hôm nay bạn không có ca" value={undefined} />
            ) : (
              shifts.map((sh) => (
                <Picker.Item
                  key={sh.scheduleId}
                  label={`${sh.name} (${sh.start}–${sh.end})`}
                  value={sh.scheduleId}
                />
              ))
            )}
          </Picker>
        </View>
      </View>

      {/* Hai nút */}
      <View style={tw`flex-row gap-3 mt-4`}>
        <TouchableOpacity
          style={tw.style(
            `flex-1 h-14 rounded-xl items-center justify-center`,
            `bg-blue-600`,
            (isPending || noShift) && `opacity-60`
          )}
          onPress={() => handleCheck("IN")}
          disabled={isPending || noShift}
        >
          <Text style={tw`text-white text-lg font-semibold`}>Vào</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={tw.style(
            `flex-1 h-14 rounded-xl items-center justify-center`,
            `border border-slate-200 bg-white`,
            (isPending || noShift) && `opacity-60`
          )}
          onPress={() => handleCheck("OUT")}
          disabled={isPending || noShift}
        >
          <Text style={tw`text-slate-900 text-lg font-semibold`}>Ra</Text>
        </TouchableOpacity>
      </View>

      {/* Toast mini */}
      {toast ? (
        <Animated.View style={[tw`absolute left-5 right-5 bottom-7 rounded-xl px-4 py-2`, { backgroundColor: "rgba(0,0,0,0.85)", opacity: fade }]}>
          <Text style={tw`text-white text-center`}>{toast}</Text>
        </Animated.View>
      ) : null}

      {/* Modal xác nhận */}
      {success && (
        <>
          <View style={tw`absolute inset-0 bg-black/35`} />
          <View style={tw`absolute left-4 right-4 top-[25%] bg-white rounded-2xl p-5`}>
            <View style={tw`w-16 h-16 rounded-full bg-green-500 self-center items-center justify-center mb-3`}>
              <Text style={tw`text-white font-bold text-xl`}>✓</Text>
            </View>
            <Text style={tw`text-center text-lg font-bold`}>
              {success.type === "IN" ? "Chấm vào thành công" : "Chấm ra thành công"}
            </Text>

            <View style={tw`h-2`} />
            <Row label="Nhân viên" value={profile?.displayName ?? "—"} />
            {profile?.email ? <Row label="Mã nhân viên" value={profile.email} /> : null}
            <Row label="Thời gian" value={success.time} />

            <View style={tw`h-4`} />
            <TouchableOpacity style={tw`h-12 rounded-xl bg-green-500 items-center justify-center`} onPress={() => setSuccess(null)}>
              <Text style={tw`text-white font-semibold`}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={tw`flex-row justify-between my-1`}>
      <Text style={tw`text-slate-700`}>{label}</Text>
      <Text style={tw`font-semibold`}>{value}</Text>
    </View>
  );
}
