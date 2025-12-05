import tw from "@lib/tw";
import { AuthAPI } from "@services/api.auth";
import { useRouter } from "expo-router";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && !submitting,
    [email, submitting]
  );

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await AuthAPI.forgotPassword(email.trim());
      showMessage({
        message: "Mã OTP đã được gửi đến email nếu tồn tại",
        type: "success",
      });
      // Điều hướng tới màn Reset, truyền email để người dùng không phải gõ lại
      (router as any).push(
        "/(auth)/reset-password?email=" + encodeURIComponent(email.trim())
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? "Có lỗi xảy ra";
      showMessage({
        message: "Gửi OTP thất bại",
        description: msg,
        type: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, email, router]);

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-white`}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={tw`flex-1 px-5 justify-center`}>
        <Text style={tw`text-2xl font-bold text-gray-900 mb-6 text-center`}>
          Quên mật khẩu
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
            returnKeyType="send"
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
            <Text style={tw`text-white font-bold text-base`}>Gửi mã OTP</Text>
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
