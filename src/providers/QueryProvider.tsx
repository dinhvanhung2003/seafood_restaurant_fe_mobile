import NetInfo from '@react-native-community/netinfo';
import {
    QueryClient,
    QueryClientProvider,
    focusManager,
    onlineManager,
} from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';

// 1 client cho toàn app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  },
});

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // báo online/offline cho React Query
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      onlineManager.setOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  // focusManager cho mobile
  useEffect(() => {
    const sub = AppState.addEventListener('change', status => {
      focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
