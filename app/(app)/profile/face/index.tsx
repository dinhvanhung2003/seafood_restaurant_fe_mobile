// FaceEnrollScreen.tsx
import http from "@services/http";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import tw from "twrnc";

// 3 bước cơ bản (bạn có thể đổi text gợi ý cho khớp backend)
const STEPS: Array<"CENTER" | "LEFT" | "RIGHT"> = ["CENTER", "LEFT", "RIGHT"];
const REQUIRED = STEPS.length;

type FaceStatus = { enrolled: boolean; count: number };

export default function FaceEnrollScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0); // 0..REQUIRED
  const [shotsUri, setShotsUri] = useState<string[]>([]); // chỉ lưu URI để render
  const [msg, setMsg] = useState<string>("");

  const [status, setStatus] = useState<FaceStatus | null>(null);

  const canCapture = useMemo(
    () => !!permission?.granted && !busy && step < REQUIRED,
    [permission, busy, step]
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await http.get<FaceStatus>("/face/status");
        setStatus(r.data);
      } catch {
        // ignore
      }
    })();
  }, []);

  function tip() {
    const t: Record<(typeof STEPS)[number], string> = {
      CENTER: "Nhìn thẳng, đủ sáng, bỏ khẩu trang/kính râm.",
      LEFT: "Quay nhẹ sang TRÁI (giữ bình thường).",
      RIGHT: "Quay nhẹ sang PHẢI (giữ bình thường).",
    };
    const k = STEPS[Math.min(step, REQUIRED - 1)];
    return t[k];
  }

  async function ensurePermission() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Cần quyền camera", "Vui lòng cấp quyền camera để đăng ký khuôn mặt.");
        return false;
      }
    }
    return true;
  }

  async function takeAndEnroll() {
    if (!(await ensurePermission())) return;
    if (!camRef.current || busy) return;

    try {
      setBusy(true);
      setMsg("Đang chụp ảnh…");

      // 1) Chụp
      const photo = await camRef.current.takePictureAsync({
        base64: true,
        quality: 0.5, // giảm để nhẹ RAM
        exif: false,
        skipProcessing: true,
      });
      if (!photo?.base64 || !photo?.uri) {
        Alert.alert("Không lấy được ảnh", "Vui lòng thử lại.");
        return;
      }

      // 2) Resize + nén trước khi gửi để tránh 413 & giảm crash
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!manipulated.base64) {
        Alert.alert("Không xử lý được ảnh", "Vui lòng thử lại.");
        return;
      }

      // 3) Hiển thị preview = URI (không set base64 vào state!)
      setShotsUri((arr) => {
        const next = [...arr];
        next[step] = manipulated.uri;
        return next;
      });

      setMsg("Đang gửi ảnh để đăng ký…");
      // Gọi API enroll từng ảnh (đơn giản). Nếu bạn dùng flow challenge/liveness,
      // thay bằng gọi /face/enroll-submit khi đã gom đủ 3 ảnh.
      const r = await http.post("/face/enroll", { imageBase64: manipulated.base64 });

      // dọn base64 khỏi object để GC dọn nhanh
      (manipulated as any).base64 = undefined;

      if (!r?.data?.ok) {
        Alert.alert(
          "Ảnh không hợp lệ",
          "Không nhận diện được khuôn mặt. Hãy chụp rõ hơn và chỉ 1 người trong khung."
        );
        // gỡ thumbnail vừa thêm
        setShotsUri((arr) => {
          const next = [...arr];
          next[step] = "";
          return next;
        });
        return;
      }

      const nextStep = step + 1;
      setStep(nextStep);
      setMsg("");

      if (nextStep >= REQUIRED) {
        // có thể gọi lại /face/status để cập nhật
        try {
          const s = await http.get<FaceStatus>("/face/status");
          setStatus(s.data);
        } catch {}
        Alert.alert("Hoàn tất", "Đăng ký khuôn mặt thành công!", [
          { text: "OK", onPress: () => navigation?.goBack?.() },
        ]);
      }
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || "Không gửi được ảnh.";
      Alert.alert("Lỗi", message);
    } finally {
      setBusy(false);
    }
  }

  function removeLast() {
    if (busy || step === 0) return;
    const i = step - 1;
    setShotsUri((arr) => {
      const next = [...arr];
      next[i] = "";
      return next;
    });
    setStep(i);
  }

  async function onResetFace() {
    Alert.alert("Chỉnh sửa khuôn mặt", "Xoá toàn bộ mẫu cũ để đăng ký lại?", [
      { text: "Huỷ" },
      {
        text: "Đồng ý",
        style: "destructive",
        onPress: async () => {
          try {
            await http.post("/face/reset", {});
            setStatus({ enrolled: false, count: 0 });
            setStep(0);
            setShotsUri([]);
            setMsg("");
            Alert.alert("Đã xoá mẫu cũ", "Bạn có thể đăng ký lại ngay bây giờ.");
          } catch (e: any) {
            const message = e?.response?.data?.message || e?.message || "Không thể xoá mẫu cũ.";
            Alert.alert("Lỗi", message);
          }
        },
      },
    ]);
  }

  // ===== RENDER =====
  if (!permission) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator />
        <Text style={s.hint}>Đang kiểm tra quyền camera…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.title}>Cần quyền camera</Text>
        <Text style={s.hint}>Ứng dụng cần quyền để chụp ảnh khuôn mặt.</Text>
        <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={requestPermission}>
          <Text style={s.btnTextPrimary}>Cho phép</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.header}>Đăng ký khuôn mặt</Text>

      {/* Trạng thái đã đăng ký & nút chỉnh sửa */}
      <View style={tw`flex-row items-center justify-between mb-2`}>
        {status?.enrolled ? (
          <Text style={tw`text-green-600 font-bold`}>Đã đăng ký ({status.count})</Text>
        ) : (
          <Text style={tw`text-slate-500`}>Chưa có mẫu — cần {REQUIRED} ảnh</Text>
        )}
        {status?.enrolled ? (
          <TouchableOpacity onPress={onResetFace} style={[s.btn, s.btnSecondary, { height: 36, paddingHorizontal: 12 }]}>
            <Text style={s.btnTextSecondary}>Chỉnh sửa</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tiến độ */}
      <View style={s.progressRow}>
        {Array.from({ length: REQUIRED }).map((_, i) => {
          const done = !!shotsUri[i];
          const active = i === step;
          return <View key={i} style={[s.dot, done ? s.dotDone : active ? s.dotActive : s.dotIdle]} />;
        })}
        <Text style={s.progressText}>{step}/{REQUIRED}</Text>
      </View>

      <Text style={s.tip}>{tip()}</Text>

      {/* Camera */}
      <View style={s.cameraWrap}>
        <CameraView ref={camRef} style={s.camera} facing="front" enableTorch={false} autofocus="on" />
      </View>

      {!!msg && (
        <View style={s.msgBox}>
          <ActivityIndicator />
          <Text style={s.msgText}>{msg}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity style={[s.btn, s.btnSecondary]} onPress={removeLast} disabled={busy || step === 0}>
          <Text style={s.btnTextSecondary}>Chụp lại</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.btn, s.btnPrimary, (!canCapture ? s.btnDisabled : null)]} onPress={takeAndEnroll} disabled={!canCapture}>
          <Text style={s.btnTextPrimary}>{step >= REQUIRED - 1 ? "Chụp & Hoàn tất" : "Chụp & Gửi"}</Text>
        </TouchableOpacity>
      </View>

      {/* Thumbnails */}
      <View style={s.thumbRow}>
        {Array.from({ length: REQUIRED }).map((_, i) => (
          <View key={i} style={s.thumbBox}>
            {shotsUri[i] ? <Image source={{ uri: shotsUri[i] }} style={s.thumb} /> : <Text style={s.thumbHint}>{i + 1}</Text>}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "#fff" },
  header: { fontSize: 20, fontWeight: "800", marginTop: 8, marginBottom: 6, color: "#111827" },
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 6, marginRight: 6 },
  dotIdle: { backgroundColor: "#e5e7eb" },
  dotActive: { backgroundColor: "#93c5fd" },
  dotDone: { backgroundColor: "#2563eb" },
  progressText: { marginLeft: 4, color: "#6b7280" },
  tip: { color: "#374151", marginBottom: 8 },
  cameraWrap: { height: 380, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  camera: { flex: 1 },
  actions: { flexDirection: "row", gap: 12, marginTop: 14 },
  btn: { flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#2563eb" },
  btnTextPrimary: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnSecondary: { borderWidth: StyleSheet.hairlineWidth, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  btnTextSecondary: { color: "#111827", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
  msgBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
  msgText: { color: "#374151" },
  thumbRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 16 },
  thumbBox: {
    width: 70,
    height: 70,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  thumbHint: { color: "#9ca3af" },
  hint: { color: "#6b7280", textAlign: "center", marginTop: 8 },
  title: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 8 },
});
