import tw from "@lib/tw";
import { AuthAPI } from "@services/api.auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { showMessage } from "react-native-flash-message";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const initialEmail = typeof params.email === "string" ? params.email : "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () =>
      email.trim().length > 0 &&
      otp.trim().length > 0 &&
      newPassword.length >= 6 &&
      newPassword === confirmNewPassword &&
      !submitting,
    [email, otp, newPassword, confirmNewPassword, submitting]
  );

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await AuthAPI.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
        confirmNewPassword,
      });
      showMessage({ message: "Đặt lại mật khẩu thành công", type: "success" });
      (router as any).push("/(auth)/login");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? "Có lỗi xảy ra";
      showMessage({
        message: "Đặt lại mật khẩu thất bại",
        description: msg,
        type: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, email, otp, newPassword, confirmNewPassword, router]);

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-white`}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={tw`flex-1 px-5 justify-center`}>
        <Text style={tw`text-2xl font-bold text-gray-900 mb-6 text-center`}>
          Đặt lại mật khẩu
        </Text>

        <View style={tw`mb-3`}>
          <Text style={tw`mb-2 text-sm text-gray-600`}>Email</Text>
          <TextInput
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            editable={!submitting}
            style={tw`border border-gray-300 rounded-xl px-4 py-3 text-base`}
          />
        </View>

        <View style={tw`mb-3`}>
          <Text style={tw`mb-2 text-sm text-gray-600`}>Mã OTP</Text>
          <TextInput
            placeholder="OTP"
            placeholderTextColor="#9CA3AF"
            value={otp}
            onChangeText={setOtp}
            keyboardType="numeric"
            returnKeyType="next"
            editable={!submitting}
            style={tw`border border-gray-300 rounded-xl px-4 py-3 text-base`}
          />
        </View>

        <View style={tw`mb-3`}>
          <Text style={tw`mb-2 text-sm text-gray-600`}>Mật khẩu mới</Text>
          <TextInput
            placeholder="Mật khẩu mới"
            placeholderTextColor="#9CA3AF"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            returnKeyType="next"
            editable={!submitting}
            style={tw`border border-gray-300 rounded-xl px-4 py-3 text-base`}
          />
        </View>

        <View style={tw`mb-4`}>
          <Text style={tw`mb-2 text-sm text-gray-600`}>
            Xác nhận mật khẩu mới
          </Text>
          <TextInput
            placeholder="Xác nhận mật khẩu"
            placeholderTextColor="#9CA3AF"
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
            returnKeyType="done"
            editable={!submitting}
            style={tw`border border-gray-300 rounded-xl px-4 py-3 text-base`}
          />
        </View>

        <TouchableOpacity
          disabled={!canSubmit}
          onPress={onSubmit}
          style={tw.style(
            `rounded-xl h-12 items-center justify-center`,
            canSubmit ? `bg-blue-600` : `bg-gray-300`
          )}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={tw`text-white font-bold text-base`}>
              Đặt lại mật khẩu
            </Text>
          )}
        </TouchableOpacity>

        <View style={tw`mt-6 items-center`}>
          <TouchableOpacity
            onPress={() => (router as any).push("/(auth)/login")}
          >
            <Text style={tw`text-blue-600`}>Quay lại Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
