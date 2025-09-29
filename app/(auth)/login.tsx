// app/(auth)/login.tsx
import tw from '@lib/tw';
import { useAuth } from '@providers/AuthProvider';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';

export default function LoginScreen() {
  const { login, submitting } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.length > 0 && !submitting,
    [username, password, submitting]
  );

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const ok = await login(username.trim(), password);

    if (ok) {
      showMessage({
        message: 'Đăng nhập thành công',
        type: 'success',
      });
      // Điều hướng sẽ do AuthGate ở app/_layout.tsx lo
    } else {
      showMessage({
        message: 'Đăng nhập thất bại',
        description: 'Vui lòng kiểm tra lại tài khoản/mật khẩu.',
        type: 'danger',
      });
    }
  }, [canSubmit, login, username, password]);

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-white`}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={tw`flex-1 px-5 justify-center`}>
        <Text style={tw`text-2xl font-bold text-gray-900 mb-2`}>Đăng nhập</Text>
        <Text style={tw`text-gray-500 mb-6`}>
          Chỉ nhân viên có quyền <Text style={tw`font-semibold`}>WAITER</Text> mới truy cập được ứng dụng.
        </Text>

        <View style={tw`mb-3`}>
          <Text style={tw`mb-2 text-sm text-gray-600`}>Tên đăng nhập</Text>
          <TextInput
            placeholder="Email / SĐT"
            placeholderTextColor="#9CA3AF"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            editable={!submitting}
            style={tw`border border-gray-300 rounded-xl px-4 py-3 text-base`}
          />
        </View>

        <View style={tw`mb-4`}>
          <Text style={tw`mb-2 text-sm text-gray-600`}>Mật khẩu</Text>
          <View style={tw`relative`}>
            <TextInput
              placeholder="Mật khẩu"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              editable={!submitting}
              style={tw`border border-gray-300 rounded-xl px-4 py-3 pr-16 text-base`}
            />
            <TouchableOpacity
              onPress={() => setSecure((s) => !s)}
              disabled={submitting}
              style={tw`absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg`}
            >
              <Text style={tw`text-blue-600 font-semibold`}>{secure ? 'Hiện' : 'Ẩn'}</Text>
            </TouchableOpacity>
          </View>
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
            <Text style={tw`text-white font-bold text-base`}>Đăng nhập</Text>
          )}
        </TouchableOpacity>

        <View style={tw`mt-6 items-center`}>
          <Text style={tw`text-gray-500 text-xs`}>© {new Date().getFullYear()} Seafood Restaurant</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
