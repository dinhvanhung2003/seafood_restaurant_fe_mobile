// app/(app)/_layout.tsx
import { useAuth } from '@providers/AuthProvider'; // path đúng với alias của bạn
import { Redirect, Stack } from 'expo-router';
import React from 'react';

export default function AppLayout() {
  const { isAuthenticated, loading } = useAuth();

  // đang load token từ AsyncStorage -> chưa quyết định điều hướng
  if (loading) return null;

  // CHƯA có token -> ép về login
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  // Có token -> cho vào app
  return <Stack screenOptions={{ headerShown: false }} />;
}
