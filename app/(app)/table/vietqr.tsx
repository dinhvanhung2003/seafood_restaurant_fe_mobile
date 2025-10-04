import tw from '@lib/tw';
import http from '@services/http';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { io, Socket } from 'socket.io-client';

const RT_URL = __DEV__
  ? 'http://192.168.1.3:8000/realtime'   // ĐỔI thành IP LAN BE của bạn
  : 'https://your-api.example.com/realtime';

const money = (n: number) => { try { return n.toLocaleString('vi-VN'); } catch { return String(n); } };
const norm = (p?: string | string[]) => (Array.isArray(p) ? p[0] : (p ?? ''));

const toast = (msg: string) => {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('', msg);
};

export default function VietQRWaitingScreen() {
  const router = useRouter();
  const { invoiceId: invoiceParam, name: nameParam } =
    useLocalSearchParams<{ invoiceId?: string | string[]; name?: string | string[] }>();

  const invoiceId = norm(invoiceParam);
  const name = norm(nameParam);

  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | undefined>();

  // socket
  const socketRef = useRef<Socket | null>(null);
  const disconnectSocket = () => { socketRef.current?.disconnect(); socketRef.current = null; };

  const onPaidSuccess = useCallback(() => {
    disconnectSocket();
    toast('Thanh toán thành công');
    setTimeout(() => router.replace('/table/index'), 350);
  }, [router]);

  const connectSocket = useCallback((invId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_invoice', { invoiceId: invId });
      socketRef.current.disconnect();
    }
    const s = io(RT_URL, { transports: ['websocket'], forceNew: true });
    socketRef.current = s;

    s.on('connect', () => s.emit('join_invoice', { invoiceId: invId }));
    s.on('invoice.paid', onPaidSuccess);
    s.on('invoice.partial', (p: any) => {
      const amt = typeof p?.amount === 'number' ? money(p.amount) : '';
      const rem = typeof p?.remaining === 'number' ? money(p.remaining) : '';
      if (amt || rem) toast(`Đã nhận ${amt} — còn thiếu ${rem}`);
    });
  }, [onPaidSuccess]);

  // (tuỳ chọn) Mở lại link thanh toán nếu user cần
  const openAgain = useCallback(async () => {
    if (!invoiceId) return;
    try {
      setLoading(true);
      // hỏi BE tình trạng còn thiếu
      const st = await http.get('/payments/status', { params: { invoiceId } });
      if (st.data?.status === 'PAID') {
        onPaidSuccess();
        return;
      }
      const remaining = Number(st.data?.remaining ?? 0);
      if (!remaining) {
        onPaidSuccess();
        return;
      }
      // xin link mới từ PayOS
      const linkRes = await http.post('/payments/payos/create-link', {
        invoiceId,
        amount: remaining,
        buyerName: name || 'Guest',
      });
      const url = linkRes.data?.checkoutUrl || linkRes.data?.data?.checkoutUrl;
      if (!url) throw new Error('NO_CHECKOUT_URL');
      setCheckoutUrl(url);
      await Linking.openURL(url);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Không thể mở link thanh toán';
      Alert.alert('Lỗi', String(msg));
    } finally {
      setLoading(false);
    }
  }, [invoiceId, name, onPaidSuccess]);

  useEffect(() => {
    if (!invoiceId) {
      Alert.alert('Thiếu invoice', 'Không có invoiceId để theo dõi.');
      router.replace('/table/index');
      return;
    }
    connectSocket(invoiceId);
    return () => disconnectSocket();
  }, [invoiceId, connectSocket, router]);

  return (
    <KeyboardAvoidingView style={tw`flex-1 bg-white`} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      {/* Header */}
      <View style={tw`px-4 py-3 border-b border-slate-200 flex-row items-center justify-between`}>
        <Pressable onPress={() => router.replace('/table/index')}>
          <Text style={tw`text-xl`}>‹</Text>
        </Pressable>
        <View style={tw`items-center`}>
          <Text style={tw`text-[16px] font-bold`}>Chờ thanh toán</Text>
          <Text style={tw`text-[12px] text-slate-500`}>{name ? `Bàn ${name}` : `Bàn`}</Text>
        </View>
        <View style={tw`w-6`} />
      </View>

      <ScrollView contentContainerStyle={tw`px-4 pb-6`}>
        <View style={tw`mt-6 items-center`}>
          <Text style={tw`text-slate-700`}>Vui lòng hoàn tất thanh toán trong trang PayOS.</Text>
          <Text style={tw`mt-1 text-slate-500`}>Màn hình sẽ tự đóng khi thanh toán thành công.</Text>
        </View>

        <View style={tw`mt-6`}>
          <Pressable
            disabled={loading}
            onPress={openAgain}
            style={tw`h-12 rounded-xl bg-blue-600 items-center justify-center`}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={tw`text-white font-bold`}>Mở lại link thanh toán</Text>}
          </Pressable>

          {checkoutUrl ? (
            <Text style={tw`mt-2 text-center text-xs text-slate-500`}>
              Nếu không tự mở, bấm “Mở lại link thanh toán”.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
