import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from "react-native";
import tw from "twrnc";

type Props = {
  visible: boolean;
  onClose: () => void;
  onShot: (b64: string) => void; // trả base64 (KHÔNG prefix) cho màn gọi
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
    const img = await camRef.current.takePictureAsync({
      base64: true,
      quality: 0.8,
      skipProcessing: true,
    });
    if (img?.base64) onShot(img.base64);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black`}>
        {granted ? (
          <CameraView ref={camRef} style={tw`flex-1`} facing="front" autofocus="on" />
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
