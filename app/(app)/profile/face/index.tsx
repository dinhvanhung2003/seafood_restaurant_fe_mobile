// FaceEnrollScreen.tsx
import http from "@services/http";
import { CameraView, useCameraPermissions } from "expo-camera";
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

type Step = "LEFT" | "RIGHT" | "BLINK";

type Challenge = {
  id: string;
  steps: Step[];
  exp?: number;
};

const REQUIRED = 3; // đúng 3 pose

export default function FaceEnrollScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0); // index 0..REQUIRED
  const [shots, setShots] = useState<string[]>([]); // dataURL để hiển thị
  const [raws, setRaws] = useState<string[]>([]); // base64 thật để gửi BE
  const [msg, setMsg] = useState<string>("");

  // trạng thái đã đăng ký
  const [status, setStatus] = useState<{ enrolled: boolean; count: number } | null>(null);
  // challenge pose từ BE
  const [ch, setCh] = useState<Challenge | null>(null);

  const currentStep: Step | undefined = ch?.steps?.[step];

  const canCapture = useMemo(() => !!permission?.granted && !busy, [permission, busy]);

  useEffect(() => {
    // 1) lấy trạng thái
    (async () => {
      try {
        const s = await http.get("/face/status");
        setStatus(s.data);
      } catch {
        /* ignore */
      }
    })();
    // 2) xin challenge 3 pose
    (async () => {
      try {
        const r = await http.post("/face/enroll-start");
        if (r?.data?.ok) setCh(r.data.challenge);
        else setCh({ id: "fallback", steps: ["LEFT", "RIGHT", "BLINK"] });
      } catch {
        setCh({ id: "fallback", steps: ["LEFT", "RIGHT", "BLINK"] });
      }
    })();
  }, []);

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

  function tip() {
    if (!currentStep) return "";
    switch (currentStep) {
      case "LEFT":
        return "Quay nhẹ sang TRÁI, đủ sáng, bỏ khẩu trang/kính râm.";
      case "RIGHT":
        return "Quay nhẹ sang PHẢI, giữ khung hình chỉ có bạn.";
      case "BLINK":
        return "Nhìn thẳng và NHÁY MẮT 1 lần.";
    }
  }

  async function takeOne() {
    if (!(await ensurePermission())) return;
    if (!camRef.current || !currentStep) return;

    try {
      setBusy(true);
      setMsg("Đang chụp ảnh...");
      const photo = await camRef.current.takePictureAsync({
        base64: true,
        skipProcessing: true,
        quality: 0.7,
      });

      const b64 = photo.base64;
      if (!b64) {
        Alert.alert("Không lấy được ảnh", "Vui lòng thử lại.");
        return;
      }

      // Preview nhỏ (data URL) và lưu raw b64 để submit
      setShots((arr) => {
        const next = [...arr];
        next[step] = `data:image/jpeg;base64,${b64}`;
        return next;
      });
      setRaws((arr) => {
        const next = [...arr];
        next[step] = b64; // raw để gửi lên
        return next;
      });

      setMsg("");
      const nextStep = step + 1;
      setStep(nextStep);

      // Nếu đủ 3 pose → cho bấm Hoàn tất để submit
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Không gửi được ảnh. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function removeLast() {
    if (step === 0) return;
    const i = step - 1;
    setShots((arr) => {
      const next = [...arr];
      next[i] = "";
      return next;
    });
    setRaws((arr) => {
      const next = [...arr];
      next[i] = "";
      return next;
    });
    setStep(i);
  }

  async function submitAll() {
    if (!ch) return;
    // Kiểm tra đúng 3 pose và đủ thứ tự
    if (raws.length < REQUIRED || ch.steps.some((_, i) => !raws[i])) {
      Alert.alert("Thiếu ảnh", "Bạn chưa chụp đủ 3 pose theo đúng thứ tự.");
      return;
    }

    try {
      setBusy(true);
      setMsg("Đang gửi để xác thực…");

      const payload = {
        challengeId: ch.id,
        frames: ch.steps.map((pose, i) => ({
          step: pose,
          imageBase64: raws[i],
          index: i,
        })),
      };

      const r = await http.post("/face/enroll-submit", payload);
      setMsg("");
      if (r?.data?.ok) {
        Alert.alert("Hoàn tất", "Đăng ký khuôn mặt thành công!", [
          { text: "OK", onPress: () => navigation?.goBack?.() },
        ]);
      } else {
        // hiển thị lý do BE trả về (ví dụ: POSE_LEFT_FAIL / BLINK_FAIL / WRONG_STEP_ORDER …)
        Alert.alert("Không đạt liveness", r?.data?.reason || "Vui lòng thử lại ở nơi đủ sáng.");
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Không gửi được ảnh.");
    } finally {
      setBusy(false);
    }
  }

  async function resetFace() {
    Alert.alert("Chỉnh sửa khuôn mặt", "Xoá toàn bộ mẫu cũ để đăng ký lại?", [
      { text: "Huỷ" },
      {
        text: "Đồng ý",
        style: "destructive",
        onPress: async () => {
          try {
            await http.post("/face/reset");
            setStatus({ enrolled: false, count: 0 });
            // reset tiến trình
            setStep(0);
            setShots([]);
            setRaws([]);
            // xin challenge mới
            const r = await http.post("/face/enroll-start");
            if (r?.data?.ok) setCh(r.data.challenge);
          } catch (e: any) {
            Alert.alert("Lỗi", e?.response?.data?.message || "Không thể xoá mẫu cũ.");
          }
        },
      },
    ]);
  }

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

      {/* trạng thái đã đăng ký + nút chỉnh sửa */}
      {status?.enrolled ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Text style={{ color: "#059669", fontWeight: "700" }}>Đã đăng ký ({status.count})</Text>
          <TouchableOpacity onPress={resetFace} style={[s.btn, s.btnSecondary, { height: 34, paddingHorizontal: 12 }]}>
            <Text style={s.btnTextSecondary}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={{ color: "#6b7280", marginBottom: 8 }}>
          Chưa có mẫu — hãy thực hiện {REQUIRED} pose theo yêu cầu
        </Text>
      )}

      {/* hiển thị thứ tự pose từ BE */}
      <View style={s.progressRow}>
        {Array.from({ length: REQUIRED }).map((_, i) => {
          const done = !!shots[i];
          const active = i === step;
          return <View key={i} style={[s.dot, done ? s.dotDone : active ? s.dotActive : s.dotIdle]} />;
        })}
        <Text style={s.progressText}>
          {step}/{REQUIRED}{" "}
          {ch ? `• ${ch.steps.map((p) => (p === "LEFT" ? "Trái" : p === "RIGHT" ? "Phải" : "Nháy mắt")).join(" → ")}` : ""}
        </Text>
      </View>

      <Text style={s.tip}>{currentStep ? tip() : "Đã chụp đủ 3 pose. Bấm Hoàn tất để gửi."}</Text>

      <View style={s.cameraWrap}>
        <CameraView ref={camRef} style={s.camera} facing="front" enableTorch={false} autofocus="on" />
      </View>

      {!!msg && (
        <View style={s.msgBox}>
          <ActivityIndicator />
          <Text style={s.msgText}>{msg}</Text>
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity style={[s.btn, s.btnSecondary]} onPress={removeLast} disabled={busy || step === 0}>
          <Text style={s.btnTextSecondary}>Chụp lại</Text>
        </TouchableOpacity>

        {step < REQUIRED ? (
          <TouchableOpacity style={[s.btn, s.btnPrimary, !canCapture ? s.btnDisabled : null]} onPress={takeOne} disabled={!canCapture}>
            <Text style={s.btnTextPrimary}>Chụp & Gửi bước {step + 1}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.btn, s.btnPrimary, busy ? s.btnDisabled : null]} onPress={submitAll} disabled={busy}>
            <Text style={s.btnTextPrimary}>Hoàn tất</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.thumbRow}>
        {Array.from({ length: REQUIRED }).map((_, i) => (
          <View key={i} style={s.thumbBox}>
            {shots[i] ? <Image source={{ uri: shots[i] }} style={s.thumb} /> : <Text style={s.thumbHint}>{i + 1}</Text>}
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
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, flexWrap: "wrap" },
  dot: { width: 10, height: 10, borderRadius: 6, marginRight: 6, marginVertical: 4 },
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
  thumbRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 16, justifyContent: "center" },
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
 