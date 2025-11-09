// app/payos/return.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function PayOSReturn() {
  const router = useRouter();
  const params = useLocalSearchParams(); // status, orderCode, paymentLinkId, ...

  useEffect(() => {
    // Ở đây chỉ hiển thị "thành công" rồi quay về list bàn.
    // Trạng thái thực đã được BE cập nhật qua webhook + socket.
    const t = setTimeout(() => router.replace("/table/index"), 800);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems:"center", justifyContent:"center" }}>
      <Text>Đang xác nhận giao dịch...</Text>
    </View>
  );
}
