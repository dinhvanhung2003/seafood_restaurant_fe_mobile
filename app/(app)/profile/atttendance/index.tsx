import NetInfo from "@react-native-community/netinfo";
import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import tw from "twrnc";
import FaceModal from "./FaceModal";

import type { CheckType, ShiftToday } from "@hooks/useAttendance";
import { useAttendanceCheck, useTodayShifts } from "@hooks/useAttendance";
import { useAuth } from "@providers/AuthProvider";
import { getFaceStatus } from "@services/face";

const toYMD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
type ChallengeType = "TURN_LEFT" | "TURN_RIGHT" | "LOOK_UP";

type FaceShotResult = {
  frames: string[];       // base64 của 2–3 ảnh
  challenge: ChallengeType;
};
const nowHHmm = (d = new Date()) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function MobileAttendanceScreen() {
  const { profile } = useAuth();

  // Đồng hồ realtime
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hhmm = useMemo(() => nowHHmm(now), [now]);

  // Ca làm việc hôm nay
  const { data: shifts = [], isLoading, refetch } = useTodayShifts(toYMD());
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | undefined>(
    undefined,
  );
const [challenge, setChallenge] = useState<ChallengeType | null>(null);
const faceResultRef = useRef<FaceShotResult | null>(null);

  // Auto chọn ca đầu tiên
  useEffect(() => {
    if (shifts.length && !selectedScheduleId) {
      setSelectedScheduleId(shifts[0].scheduleId);
    }
  }, [shifts, selectedScheduleId]);

  // Ca đang chọn + trạng thái IN / OUT
  const currentShift = useMemo(
    () =>
      (shifts as ShiftToday[]).find(
        (sh) => sh.scheduleId === selectedScheduleId,
      ),
    [shifts, selectedScheduleId],
  );

  const hasIn = !!currentShift?.attCheckIn;
  const hasOut = !!currentShift?.attCheckOut;

  // Toast mini
  const [toast, setToast] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  function showToast(msg: string) {
    setToast(msg);
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start(() =>
      setTimeout(() => {
        Animated.timing(fade, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2200),
    );
  }

  // API chấm công
  const { mutateAsync: checkAttendance, isPending } = useAttendanceCheck();

  // Modal khuôn mặt
  const [faceOpen, setFaceOpen] = useState(false);
  const faceB64Ref = useRef<string | null>(null);

  // Loading cho nút check (IN/OUT)
  const [checkingType, setCheckingType] = useState<CheckType | null>(null);

  // Popup thành công
  const [success, setSuccess] = useState<{ type: CheckType; time: string } | null>(
    null,
  );

  const noShift = (shifts?.length ?? 0) === 0;

  async function handleCheck(type: CheckType) {
    if (!selectedScheduleId) {
      showToast("Hôm nay bạn không có ca được phân.");
      return;
    }

    // Chặn IN/OUT nếu ca đã có dữ liệu
    if (type === "IN" && hasIn) {
      showToast("Ca này bạn đã chấm vào rồi.");
      return;
    }
    if (type === "OUT" && hasOut) {
      showToast("Ca này bạn đã chấm ra rồi.");
      return;
    }

    // Bắt buộc đã đăng ký khuôn mặt
    const st = await getFaceStatus().catch(() => null);
    if (!st?.enrolled) {
      showToast("Bạn chưa đăng ký khuôn mặt.");
      return;
    }
const challenges: ChallengeType[] = ["TURN_LEFT", "TURN_RIGHT", "LOOK_UP"];
  const ch = challenges[Math.floor(Math.random() * challenges.length)];
  setChallenge(ch);
const faceRes = await new Promise<FaceShotResult | null>((resolve) => {
  // Mở modal
  setFaceOpen(true);

  // Timeout nếu user không thao tác
  const t = setTimeout(() => {
    resolve(null);
  }, 20000);

  // Hàm resolve sẽ được FaceModal gọi
  (globalThis as any).__ATT_FACE_RESOLVE__ = (res: FaceShotResult | null) => {
    clearTimeout(t);
    resolve(res);
  };
});

// Đóng modal
setFaceOpen(false);

// Kiểm tra kết quả
if (!faceRes || !faceRes.frames || faceRes.frames.length === 0) {
  showToast("Bạn chưa hoàn tất chụp khuôn mặt.");
  return;
}

// Lưu lại frame để gửi lên BE
faceResultRef.current = faceRes;


    // 1) Location service
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      showToast("Hãy bật Dịch vụ vị trí.");
      return;
    }

    // 2) Quyền vị trí
    const { status, canAskAgain } =
      await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      showToast(
        canAskAgain
          ? "Hãy cho phép quyền vị trí."
          : "Ứng dụng chưa có quyền vị trí.",
      );
      return;
    }

    // 3) Lấy vị trí hiện tại
    let pos: Location.LocationObject | null = null;
    try {
      pos = await Location.getCurrentPositionAsync({
        accuracy:
          Platform.OS === "android"
            ? Location.Accuracy.Balanced
            : Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });
    } catch {
      pos = await Location.getLastKnownPositionAsync();
    }
    if (!pos) {
      showToast("Không lấy được vị trí.");
      return;
    }

    // 4) Network
   // 4) Network
const netState = await Network.getNetworkStateAsync();
if (!netState.isConnected) {
  showToast("Thiết bị đang offline.");
  return;
}

// Map đúng union 'wifi' | 'cellular' | 'unknown'
let netType: "wifi" | "cellular" | "unknown" = "unknown";
if (netState.type === Network.NetworkStateType.WIFI) {
  netType = "wifi";
} else if (netState.type === Network.NetworkStateType.CELLULAR) {
  netType = "cellular";
}

// (Tuỳ chọn) Lấy SSID/BSSID – cần NetInfo + quyền Location
let ssid: string | null = null;
let bssid: string | null = null;
try {
  const netInfo = await NetInfo.fetch();
  ssid = (netInfo.details as any)?.ssid ?? null;
  bssid = (netInfo.details as any)?.bssid ?? null;
} catch {
  // im lặng, không lỗi cũng được
}

// 5) Gọi API chấm công
setCheckingType(type);
try {
  const result = await checkAttendance({
    lat: +pos.coords.latitude,
    lng: +pos.coords.longitude,
    accuracy: Math.round(pos.coords.accuracy || 0),
    clientTs: Date.now(),
    netType,
    ssid,
    bssid,
    checkType: type,
    scheduleId: selectedScheduleId,
    imagesBase64: faceResultRef.current!.frames,
    challenge: faceResultRef.current!.challenge,
  } as any);

  console.log("DEBUG checkAttendance result:", result);

  if (result?.ok) {
    // ✅ Thành công
    setSuccess({
      type,
      time:
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }) +
        " " +
        now.toLocaleDateString("vi-VN"),
    });
    refetch();
    showToast("✅ Chấm công thành công!");
  } else {
    const verify = result?.verify as string | undefined;
    const reason = (result as any)?.reason as string | undefined;
    const score = (result as any)?.score as number | undefined;

    // Ưu tiên các lỗi “ngoại vi”
    if (verify === "FAIL_GPS") {
      showToast("❌ Không ở trong vùng GPS.");
    } else if (verify === "FAIL_WIFI") {
      showToast("❌ Không đúng Wi-Fi/IP.");
    }
    // Lỗi khuôn mặt tổng quát, có reason chi tiết
    else if (verify === "FAIL_FACE") {
      if (reason === "NO_MATCH") {
        showToast("❌ Hệ thống không tìm thấy khuôn mặt của bạn.\nThử chụp lại rõ hơn, đủ sáng nhé.");
      } else if (reason === "LOW_SCORE") {
        showToast(
          `❌ Độ khớp khuôn mặt chỉ ~${Math.round(score || 0)}% (< ngưỡng).\nThử chụp gần hơn, ít che mặt hơn.`
        );
      } else if (reason === "DIFF_USER") {
        showToast("❌ Khuôn mặt không trùng với tài khoản đăng nhập.");
      } else if (reason === "NO_FACE" || reason === "IMAGE_EMPTY") {
        showToast("❌ Không nhận diện được khuôn mặt.\nThử chụp lại rõ hơn nhé.");
      } else {
        showToast("❌ Lỗi xác thực khuôn mặt, vui lòng thử lại.");
      }
    }
    // Phòng trường hợp BE trả trực tiếp verify = NO_FACE / LOW_SCORE / ...
    else if (verify === "NO_FACE" || verify === "IMAGE_EMPTY") {
      showToast("❌ Không nhận diện được khuôn mặt.");
    } else if (verify === "LOW_SCORE") {
      showToast(
        `❌ Độ khớp khuôn mặt chỉ ~${Math.round(score || 0)}%.\nThử chụp gần hơn, ít che mặt hơn.`
      );
    } else if (verify === "DIFF_USER") {
      showToast("❌ Đây không phải khuôn mặt của bạn.");
    } else if (verify === "NO_MATCH") {
      showToast("❌ Bạn chưa đăng ký khuôn mặt.");
    } else if (verify === "ERROR") {
      showToast("❌ Lỗi hệ thống khi xác thực khuôn mặt, vui lòng thử lại.");
    } else {
      // Fallback cho mọi case lạ
      showToast("❌ Không hợp lệ.");
    }
  }
} catch (e: any) {
  const s = e?.response?.status;
  const m = e?.response?.data?.message ?? e?.message;
  showToast(`⚠️ Lỗi ${s ?? ""} ${Array.isArray(m) ? m.join(", ") : m}`);
} finally {
  setCheckingType(null);
}
  }

  return (
    <View style={tw`flex-1 bg-white pt-8 px-4`}>
      {/* Đồng hồ */}
      <Text style={tw`text-4xl font-bold text-center`}>{hhmm}</Text>
      <Text style={tw`text-slate-500 text-center mb-4`}>
        {now.toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </Text>

      {/* Card chọn ca */}
      <View style={tw`border border-slate-200 rounded-2xl p-3 mb-3`}>
        <Text style={tw`text-[13px] text-slate-700 mb-2`}>Ca làm việc</Text>
        <View style={tw`border border-slate-200 rounded-xl overflow-hidden`}>
  {noShift ? (
    // Trường hiển thị thông tin khi không có ca
    <View style={tw`h-11 justify-center px-3 bg-slate-50`}>
      <Text style={tw`text-slate-400`}>Hôm nay bạn không có ca</Text>
    </View>
  ) : (
    <Picker
      selectedValue={selectedScheduleId}
      onValueChange={(v) => setSelectedScheduleId(v as string)}
      enabled={!isLoading}        // 👈 bỏ !noShift ở đây
      style={tw`h-11`}
    >
      {(shifts as ShiftToday[]).map((sh) => (
        <Picker.Item
          key={sh.scheduleId}
          label={`${sh.name} (${sh.start}–${sh.end})`}
          value={sh.scheduleId}
        />
      ))}
    </Picker>
  )}
</View>


        {/* Trạng thái chấm công của ca đang chọn */}
        {currentShift && (
          <Text
            style={tw.style(
              "mt-2 text-xs",
              hasOut ? "text-emerald-600" : hasIn ? "text-blue-600" : "text-slate-500",
            )}
          >
            {hasOut
              ? `Đã chấm vào ${currentShift.attCheckIn} và ra ${currentShift.attCheckOut}.`
              : hasIn
              ? `Đã chấm vào lúc ${currentShift.attCheckIn}.`
              : "Bạn chưa chấm công cho ca này."}
          </Text>
        )}
      </View>

      {/* Hai nút */}
      <View style={tw`flex-row gap-3 mt-4`}>
        {/* Nút VÀO – chỉ hiện khi chưa IN và chưa OUT */}
        {!hasIn && !hasOut && (
          <TouchableOpacity
            style={tw.style(
              `flex-1 h-14 rounded-xl items-center justify-center bg-blue-600`,
              (isPending || noShift) && `opacity-60`,
            )}
            onPress={() => handleCheck("IN" as CheckType)}
            disabled={isPending || noShift}
          >
            <View style={tw`flex-row items-center justify-center`}>
              {checkingType === "IN" && (
                <ActivityIndicator
                  color="#fff"
                  style={tw`mr-2`}
                />
              )}
              <Text style={tw`text-white text-lg font-semibold`}>
                {checkingType === "IN" ? "Đang chấm..." : "Vào"}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Nút RA – chỉ hiện khi đã IN và chưa OUT */}
        {hasIn && !hasOut && (
          <TouchableOpacity
            style={tw.style(
              `flex-1 h-14 rounded-xl items-center justify-center border border-slate-200 bg-white`,
              (isPending || noShift) && `opacity-60`,
            )}
            onPress={() => handleCheck("OUT" as CheckType)}
            disabled={isPending || noShift}
          >
            <View style={tw`flex-row items-center justify-center`}>
              {checkingType === "OUT" && (
                <ActivityIndicator
                  color="#0f172a"
                  style={tw`mr-2`}
                />
              )}
              <Text style={tw`text-slate-900 text-lg font-semibold`}>
                {checkingType === "OUT" ? "Đang chấm..." : "Ra"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Toast mini */}
      {toast ? (
        <Animated.View
          style={[
            tw`absolute left-5 right-5 bottom-7 rounded-xl px-4 py-2`,
            { backgroundColor: "rgba(0,0,0,0.85)", opacity: fade },
          ]}
        >
          <Text style={tw`text-white text-center`}>{toast}</Text>
        </Animated.View>
      ) : null}

      {/* Modal chụp khuôn mặt */}
   <FaceModal
  visible={faceOpen}
  challenge={challenge}          // NEW
  onClose={() => {
    if ((globalThis as any).__ATT_FACE_RESOLVE__) {
      (globalThis as any).__ATT_FACE_RESOLVE__(null);
      (globalThis as any).__ATT_FACE_RESOLVE__ = null;
    }
    setFaceOpen(false);
  }}
  onShot={(res: FaceShotResult) => {
    faceResultRef.current = res;
    if ((globalThis as any).__ATT_FACE_RESOLVE__) {
      (globalThis as any).__ATT_FACE_RESOLVE__(res);
      (globalThis as any).__ATT_FACE_RESOLVE__ = null;
    }
    setFaceOpen(false);
  }}
/>


      {/* Modal xác nhận */}
      {success && (
        <>
          <View style={tw`absolute inset-0 bg-black/35`} />
          <View
            style={tw`absolute left-4 right-4 top-[25%] bg-white rounded-2xl p-5`}
          >
            <View
              style={tw`w-16 h-16 rounded-full bg-green-500 self-center items-center justify-center mb-3`}
            >
              <Text style={tw`text-white font-bold text-xl`}>✓</Text>
            </View>
            <Text style={tw`text-center text-lg font-bold`}>
              {success.type === "IN"
                ? "Chấm vào thành công"
                : "Chấm ra thành công"}
            </Text>

            <View style={tw`h-2`} />
            <Row label="Nhân viên" value={profile?.displayName ?? "—"} />
            {profile?.email ? (
              <Row label="Mã nhân viên" value={profile.email} />
            ) : null}
            <Row label="Thời gian" value={success.time} />

            <View style={tw`h-4`} />
            <TouchableOpacity
              style={tw`h-12 rounded-xl bg-green-500 items-center justify-center`}
              onPress={() => setSuccess(null)}
            >
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
