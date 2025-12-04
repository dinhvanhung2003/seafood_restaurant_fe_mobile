import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import tw from "twrnc";

/* ==== TYPES LIVENESS ==== */
export type ChallengeType = "TURN_LEFT" | "TURN_RIGHT" | "LOOK_UP";

export type FaceShotResult = {
  frames: string[];        // 2–3 frame base64 (KHÔNG prefix)
  challenge: ChallengeType;
};

type Props = {
  visible: boolean;
  challenge: ChallengeType | null;
  onClose: () => void;
  onShot: (res: FaceShotResult) => void;
};

export default function FaceModal({ visible, challenge, onClose, onShot }: Props) {
  const camRef = useRef<CameraView | null>(null);
  const [perm, request] = useCameraPermissions();
  const granted = !!perm?.granted;

  // bước 1: nhìn thẳng, bước 2: làm theo challenge
  const [step, setStep] = useState<1 | 2>(1);
  const [shooting, setShooting] = useState(false);
  const framesRef = useRef<string[]>([]);

  useEffect(() => {
    if (visible && !granted) request();
  }, [visible, granted, request]);

  // Reset state mỗi lần mở modal
  useEffect(() => {
    if (visible) {
      setStep(1);
      framesRef.current = [];
      setShooting(false);
    }
  }, [visible]);

  function getInstruction() {
    if (!challenge) return "Giữ khuôn mặt trong khung và làm theo hướng dẫn.";

    if (step === 1) {
      return "Bước 1: Nhìn thẳng vào camera, giữ yên mặt và bấm CHỤP LẦN 1.";
    }

    switch (challenge) {
      case "TURN_LEFT":
        return "Bước 2: Hãy quay mặt sang TRÁI, giữ yên 1–2 giây rồi bấm CHỤP LẦN 2.";
      case "TURN_RIGHT":
        return "Bước 2: Hãy quay mặt sang PHẢI, giữ yên 1–2 giây rồi bấm CHỤP LẦN 2.";
      case "LOOK_UP":
        return "Bước 2: Hãy NGẨNG MẶT LÊN một chút rồi bấm CHỤP LẦN 2.";
      default:
        return "Bước 2: Làm theo hướng dẫn trên màn hình rồi bấm CHỤP LẦN 2.";
    }
  }

  async function takeShot() {
    if (!camRef.current || shooting) return;

    try {
      setShooting(true);

      // 1) Chụp ảnh KHÔNG base64, quality vừa phải
      const raw = await camRef.current.takePictureAsync({
        base64: false,
        quality: Platform.OS === "android" ? 0.6 : 0.5,
        skipProcessing: Platform.OS === "android",
      });

      // 2) Resize về ~640px, nén và LÚC NÀY mới lấy base64
      const manipulated = await ImageManipulator.manipulateAsync(
        raw.uri,
        [{ resize: { width: 640 } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (manipulated.base64) {
        framesRef.current.push(manipulated.base64);

        if (step === 1) {
          // Xong bước 1 → chuyển sang bước 2 (user quay đầu làm theo challenge)
          setStep(2);
        } else {
          // Đã có 2 frame → trả về cho cha xử lý liveness
          if (challenge) {
            onShot({
              frames: framesRef.current,
              challenge,
            });
          }
        }
      }
    } catch (err) {
      console.log("FACE_SHOT_ERROR", err);
    } finally {
      setShooting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black`}>
        {granted ? (
          <>
            <CameraView
              ref={camRef}
              style={tw`flex-1`}
              facing="front"
              autofocus="on"
            />

            {/* Overlay hướng dẫn */}
            <View
              style={tw`absolute top-10 left-4 right-4 bg-black/60 rounded-2xl px-4 py-3`}
            >
              <Text style={tw`text-white font-semibold mb-1`}>
                Kiểm tra sống (liveness)
              </Text>
              <Text style={tw`text-white text-xs`}>
                {getInstruction()}
              </Text>
              <Text style={tw`text-slate-300 text-[11px] mt-1`}>
                Ảnh bước {step}/2 – hãy đảm bảo mặt rõ nét, đủ sáng.
              </Text>
            </View>
          </>
        ) : (
          <View style={tw`flex-1 items-center justify-center`}>
            <ActivityIndicator />
            <Text style={tw`text-white mt-3`}>Đang xin quyền camera…</Text>
          </View>
        )}

        {/* Thanh action dưới */}
        <View style={tw`absolute bottom-0 left-0 right-0 p-4 bg-black/60`}>
          <View style={tw`flex-row gap-3`}>
            <TouchableOpacity
              onPress={onClose}
              style={tw`flex-1 h-12 rounded-xl items-center justify-center bg-slate-700`}
            >
              <Text style={tw`text-white font-semibold`}>Đóng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!granted || shooting}
              onPress={takeShot}
              style={tw.style(
                `flex-1 h-12 rounded-xl items-center justify-center`,
                granted ? `bg-green-600` : `bg-slate-600`
              )}
            >
              {shooting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={tw`text-white font-semibold`}>
                  {step === 1 ? "Chụp lần 1" : "Chụp lần 2"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
