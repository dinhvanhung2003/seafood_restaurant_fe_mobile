import tw from "@lib/tw";
import http from "@services/http";
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

// ===== Regex số điện thoại Việt Nam =====
const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[5-9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;

function validatePhone(raw: string) {
  if (!raw) return false;
  const phone = raw.trim();
  const normalized = phone.startsWith("+84") ? "0" + phone.slice(3) : phone;
  return PHONE_REGEX.test(normalized);
}

type NewCustomerPayload = {
  type?: "PERSONAL" | "COMPANY";
  name: string;
  phone?: string;
  email?: string;
  note?: string;
};

export function AddCustomerModalMobile({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated?: (c: { id: string; name: string; phone?: string | null }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setPhone("");
    setError("");
  };

  const handleSave = async () => {
    // ===== Validate basic =====
    if (!name.trim()) {
      setError("Tên khách hàng bắt buộc");
      return;
    }

    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại");
      return;
    }

    if (!validatePhone(phone)) {
      setError("Số điện thoại không hợp lệ");
      return;
    }

    const payload: NewCustomerPayload = {
      type: "PERSONAL",
      name: name.trim(),
      phone: phone.trim(),
    };

    try {
      setSaving(true);
      setError("");

      // Nếu BE dùng route khác, ví dụ /cashier/customers thì đổi ở đây
      const res = await http.post("/customers", payload);
      const c = res.data?.data ?? res.data;

      // Gọi callback cho component cha (OrderScreen / SelectCustomerModal)
      await onCreated?.({
        id: c.id,
        name: c.name,
        phone: c.phone,
      });

      reset();
      onClose();
    } catch (e: any) {
      const message = e?.response?.data?.message || "";

      // lỗi trùng số điện thoại (BE trả message có chữ "phone")
      if (typeof message === "string" && message.toLowerCase().includes("phone")) {
        setError("Số điện thoại đã tồn tại");
        return;
      }

      setError("Không thể tạo khách hàng, vui lòng thử lại");
      console.log("Lỗi tạo khách:", e?.response?.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-6`}>
        <View style={tw`rounded-2xl bg-white p-4`}>
          <Text style={tw`text-base font-semibold mb-3`}>Thêm khách hàng</Text>

          <Text style={tw`text-xs text-slate-500 mb-2`}>
            Chỉ lấy những trường cơ bản hay dùng tại quán (Tên, SĐT). Các thông tin chi
            tiết có thể chỉnh sau ở màn hình quản lý khách hàng.
          </Text>

          {/* Tên khách */}
          <View style={tw`mb-3`}>
            <Text style={tw`text-xs text-slate-600 mb-1`}>Tên khách hàng *</Text>
            <TextInput
              style={tw`border border-slate-200 rounded-xl px-3 h-10`}
              placeholder="VD: Nguyễn Văn A"
              value={name}
              onChangeText={(txt) => {
                setName(txt);
                setError("");
              }}
            />
          </View>

          {/* Số điện thoại */}
          <View style={tw`mb-1`}>
            <Text style={tw`text-xs text-slate-600 mb-1`}>Số điện thoại *</Text>
            <TextInput
              style={tw`border border-slate-200 rounded-xl px-3 h-10`}
              placeholder="VD: 0909..."
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(txt) => {
                setPhone(txt);
                setError("");
              }}
            />
          </View>

          {/* Hiển thị lỗi */}
          {!!error && (
            <Text style={tw`text-red-500 text-xs mt-1 mb-2`}>{error}</Text>
          )}

          {/* Nút hành động */}
          <View style={tw`mt-4 flex-row justify-end gap-3`}>
            <Pressable
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text style={tw`text-slate-600`}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={tw`px-4 h-10 rounded-xl bg-blue-600 items-center justify-center ${
                saving ? "opacity-60" : ""
              }`}
            >
              <Text style={tw`text-white font-semibold`}>
                {saving ? "Đang lưu..." : "Lưu"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
