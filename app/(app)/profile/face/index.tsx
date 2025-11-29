import http from "@services/http";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import tw from "twrnc";

type LivenessStep = "LEFT" | "RIGHT" | "BLINK";

type Challenge = {
  id: string;
  steps: LivenessStep[];
  exp: number;
};

type FaceStatus = { enrolled: boolean; count: number };

type EnrollSubmitFrame = {
  step: LivenessStep;
  imageBase64: string;
};

export default function FaceEnrollScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [status, setStatus] = useState<FaceStatus | null>(null);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const REQUIRED = challenge?.steps.length ?? 0;

  const [stepIndex, setStepIndex] = useState(0);
  const [shotsUri, setShotsUri] = useState<string[]>([]);

  const framesRef = useRef<EnrollSubmitFrame[]>([]);

  const canCapture = useMemo(
    () => !!permission?.granted && !busy && !!challenge && stepIndex < REQUIRED,
    [permission, busy, challenge, stepIndex, REQUIRED]
  );

  // load status khuôn mặt
  useEffect(() => {
    (async () => {
      try {
        const r = await http.get<FaceStatus>("/face/status");
        setStatus(r.data);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    startChallenge();
  }, []);

  async function startChallenge() {
    try {
      setBusy(true);
      const r = await http.post<{ ok: boolean; challenge: Challenge }>(
        "/face/enroll-start",
        {}
      );
      if (!r.data?.ok) {
        Alert.alert("Lỗi", "Không tạo được thử thách khuôn mặt");
        return;
      }
      setChallenge(r.data.challenge);
      framesRef.current = [];
      setShotsUri([]);
      setStepIndex(0);
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message ?? "Không tạo được challenge");
    } finally {
      setBusy(false);
    }
  }

  function currentStep(): LivenessStep | null {
    if (!challenge) return null;
    if (stepIndex >= challenge.steps.length) return null;
    return challenge.steps[stepIndex];
  }

  function tip() {
    const s = currentStep();
    if (!s) return "Đang chuẩn bị thử thách…";

    if (s === "LEFT") return "Quay nhẹ sang TRÁI, nhìn vào camera 1–2 giây.";
    if (s === "RIGHT") return "Quay nhẹ sang PHẢI, nhìn vào camera 1–2 giây.";
    if (s === "BLINK") return "Nhìn thẳng vào camera và nháy mắt rõ ràng.";

    return "";
  }

  async function ensurePermission() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Cần quyền camera", "Hãy cấp quyền camera.");
        return false;
      }
    }
    return true;
  }

  async function takeAndEnroll() {
    if (!(await ensurePermission())) return;
    if (!camRef.current || busy) return;
    if (!challenge) return;

    const step = currentStep();
    if (!step) return;

    try {
      setBusy(true);
      setMsg("Đang chụp ảnh…");

      const photo = await camRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });

      const img = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // lưu preview
      setShotsUri((arr) => {
        const next = [...arr];
        next[stepIndex] = img.uri;
        return next;
      });

      framesRef.current[stepIndex] = {
        step,
        imageBase64: img.base64!,
      };

      const next = stepIndex + 1;
      setStepIndex(next);
      setMsg("");

      if (next < REQUIRED) return;

      // đủ 3 ảnh → gửi submit
      setMsg("Đang gửi ảnh để kiểm tra…");
      const frames = framesRef.current.filter(Boolean);

      const resp = await http.post("/face/enroll-submit", {
        challengeId: challenge.id,
        frames,
      });

      if (!resp.data?.ok) {
        Alert.alert("Không hợp lệ", "Vui lòng thử lại theo đúng hướng dẫn.", [
          { text: "OK", onPress: () => startChallenge() },
        ]);
        return;
      }

      const s = await http.get<FaceStatus>("/face/status");
      setStatus(s.data);

      Alert.alert("Hoàn tất", "Đăng ký khuôn mặt thành công!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể gửi ảnh.");
    } finally {
      setBusy(false);
      setMsg("");
    }
  }

  function removeLast() {
    if (busy || stepIndex === 0) return;
    const i = stepIndex - 1;

    setShotsUri((arr) => {
      const next = [...arr];
      next[i] = "";
      return next;
    });

    framesRef.current[i] = undefined as any;
    setStepIndex(i);
  }

  async function onResetFace() {
    Alert.alert("Xoá khuôn mặt", "Xoá toàn bộ mẫu và đăng ký lại?", [
      { text: "Huỷ" },
      {
        text: "Đồng ý",
        style: "destructive",
        onPress: async () => {
          await http.post("/face/reset", {});
          setStatus({ enrolled: false, count: 0 });
          startChallenge();
        },
      },
    ]);
  }

  // ===== UI =====
  if (!permission)
    return (
      <SafeAreaView style={tw`flex-1 items-center justify-center bg-white`}>
        <ActivityIndicator />
        <Text style={tw`text-slate-500 mt-2`}>Đang kiểm tra quyền…</Text>
      </SafeAreaView>
    );

  if (!permission.granted)
    return (
      <SafeAreaView style={tw`flex-1 p-4 pt-10 bg-white`}>
        <Text style={tw`text-xl font-bold mb-2`}>Cần quyền camera</Text>
        <Text style={tw`text-slate-600 mb-4`}>
          Ứng dụng cần quyền camera để đăng ký khuôn mặt.
        </Text>

        <TouchableOpacity
          onPress={requestPermission}
          style={tw`h-12 rounded-xl bg-blue-600 items-center justify-center`}
        >
          <Text style={tw`text-white font-semibold`}>Cho phép</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={tw`flex-1 bg-white p-4`}>
      <Text style={tw`text-xl font-bold mt-2 mb-3`}>Đăng ký khuôn mặt</Text>

      {/* Trạng thái */}
      <View style={tw`flex-row items-center justify-between mb-2`}>
        {status?.enrolled ? (
          <Text style={tw`text-green-600 font-bold`}>
            Đã đăng ký ({status.count})
          </Text>
        ) : (
          <Text style={tw`text-slate-500`}>
            Chưa đăng ký — cần hoàn tất thử thách
          </Text>
        )}

        {status?.enrolled && (
          <TouchableOpacity
            onPress={onResetFace}
            style={tw`px-3 h-9 rounded-lg border border-slate-300 items-center justify-center`}
          >
            <Text style={tw`text-slate-700 font-semibold`}>Xoá mẫu</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress */}
      <View style={tw`flex-row items-center mb-2`}>
        {Array.from({ length: REQUIRED || 3 }).map((_, i) => {
          const done = !!shotsUri[i];
          const active = i === stepIndex;
          return (
            <View
              key={i}
              style={tw.style(
                `w-3 h-3 rounded-full mr-2`,
                done
                  ? `bg-blue-600`
                  : active
                  ? `bg-blue-300`
                  : `bg-slate-300`
              )}
            />
          );
        })}
        <Text style={tw`text-slate-500 ml-1`}>
          {stepIndex}/{REQUIRED}
        </Text>
      </View>

      <Text style={tw`text-slate-700 mb-2`}>{tip()}</Text>

      {/* CAMERA */}
      <View style={tw`w-full h-96 rounded-2xl overflow-hidden bg-black mb-3`}>
        <CameraView ref={camRef} style={tw`flex-1`} facing="front" />
      </View>

      {msg ? (
        <View style={tw`flex-row items-center gap-2 mb-2`}>
          <ActivityIndicator />
          <Text style={tw`text-slate-600`}>{msg}</Text>
        </View>
      ) : null}

      {/* ACTION BUTTONS */}
      <View style={tw`flex-row gap-3 mb-4`}>
        <TouchableOpacity
          style={tw.style(
            `flex-1 h-12 rounded-xl border border-slate-300 items-center justify-center`,
            busy && `opacity-50`
          )}
          onPress={removeLast}
          disabled={busy || stepIndex === 0}
        >
          <Text style={tw`text-slate-700 font-semibold`}>Chụp lại</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={tw.style(
            `flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center`,
            !canCapture && `opacity-50`
          )}
          disabled={!canCapture}
          onPress={takeAndEnroll}
        >
          <Text style={tw`text-white font-semibold`}>
            {stepIndex >= (REQUIRED || 1) - 1 ? "Hoàn tất" : "Chụp & Gửi"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* THUMBNAILS */}
      <View style={tw`flex-row gap-3`}>
        {Array.from({ length: REQUIRED || 3 }).map((_, i) => (
          <View
            key={i}
            style={tw`w-20 h-20 rounded-xl border border-slate-300 items-center justify-center overflow-hidden`}
          >
            {shotsUri[i] ? (
              <Image source={{ uri: shotsUri[i] }} style={tw`w-full h-full`} />
            ) : (
              <Text style={tw`text-slate-400`}>{i + 1}</Text>
            )}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
