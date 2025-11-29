import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import tw from "twrnc";

type Props = {
  visible: boolean;
  onClose: () => void;
  onShot: (b64: string) => void; // base64 KHÔNG prefix
};

export default function FaceModal({ visible, onClose, onShot }: Props) {
  const camRef = useRef<CameraView | null>(null);
  const [perm, request] = useCameraPermissions();
  const granted = !!perm?.granted;

  useEffect(() => {
    if (visible && !granted) request();
  }, [visible, granted, request]);

  async function takeShot() {
    if (!camRef.current) return;

    try {
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
        onShot(manipulated.base64); // gửi chuỗi base64 gọn
        onClose();                  // đóng modal để giải phóng camera
      }
    } catch (err) {
      console.log("FACE_SHOT_ERROR", err);
      onClose();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black`}>
        {granted ? (
          <CameraView
            ref={camRef}
            style={tw`flex-1`}
            facing="front"
            autofocus="on"
          />
        ) : (
          <View style={tw`flex-1 items-center justify-center`}>
            <ActivityIndicator />
            <Text style={tw`text-white mt-3`}>Đang xin quyền camera…</Text>
          </View>
        )}

        <View style={tw`absolute bottom-0 left-0 right-0 p-4 bg-black/50`}>
          <View style={tw`flex-row gap-3`}>
            <TouchableOpacity
              onPress={onClose}
              style={tw`flex-1 h-12 rounded-xl items-center justify-center bg-slate-700`}
            >
              <Text style={tw`text-white font-semibold`}>Đóng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!granted}
              onPress={takeShot}
              style={tw.style(
                `flex-1 h-12 rounded-xl items-center justify-center`,
                granted ? `bg-green-600` : `bg-slate-600`
              )}
            >
              <Text style={tw`text-white font-semibold`}>Chụp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
