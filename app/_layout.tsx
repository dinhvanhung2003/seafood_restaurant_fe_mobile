// app/_layout.tsx
import { AuthProvider, useAuth } from '@providers/AuthProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import '../global.css';

const qc = new QueryClient();
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading /*, role*/ } = useAuth();
  const segments = useSegments();            // ví dụ: ["(auth)", "login"] hoặc ["(app)"]
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Nếu CHƯA đăng nhập mà đang ở (app) -> đẩy về login
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    // Nếu ĐÃ đăng nhập mà đang ở (auth) -> đẩy vào app
    if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)');
      return;
    }

    // Nếu muốn check role:
    // if (isAuthenticated && role !== 'WAITER') router.replace('/(auth)/no-permission');
  }, [isAuthenticated, loading, segments]);

  if (loading) {
    return (
       <QueryClientProvider client={qc}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
      </QueryClientProvider>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
        <FlashMessage position="top" />
      </AuthGate>
    </AuthProvider>
  );
}
