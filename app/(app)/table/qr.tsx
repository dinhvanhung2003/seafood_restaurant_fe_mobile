// app/(app)/table/qr.tsx
import tw from '@lib/tw';
import http from '@services/http';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

type QrResp = { invoiceId: string; amount: number; qrUrl: string; addInfo: string; expireAt: string };

export default function VietQRScreen() {
  const { invoiceId, amount } = useLocalSearchParams<{ invoiceId: string; amount?: string }>();
  const router = useRouter();

  const [qr, setQr] = useState<QrResp | null>(null);
  const [status, setStatus] = useState<'UNPAID'|'PARTIAL'|'PAID'|'NOT_FOUND'|'LOADING'>('LOADING');
  const [left, setLeft] = useState<number>(600); // 10 phút

  // tạo QR (hoặc nhận từ màn trước truyền sang cũng được)
  useEffect(() => {
    const run = async () => {
      const { data } = await http.post<QrResp>('/payments/vietqr', {
        invoiceId,
        amount: amount ? Number(amount) : undefined,
      });
      setQr(data);
      setStatus('UNPAID');
    };
    run().catch(() => setStatus('NOT_FOUND'));
  }, [invoiceId]);

  // countdown
  useEffect(() => {
    const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // poll trạng thái
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      const { data } = await http.get('/payments/status', { params: { invoiceId: qr.invoiceId }});
      setStatus(data.status);
      if (data.status === 'PAID') {
        clearInterval(t);
        router.back(); // hoặc chuyển sang màn “Hoá đơn đã thanh toán”
      }
    }, 3000);
    return () => clearInterval(t);
  }, [qr]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  if (!qr) {
    return <View style={tw`flex-1 items-center justify-center`}><ActivityIndicator /></View>;
  }

  return (
    <View style={tw`flex-1 bg-white`}>
      {/* Header */}
      <View style={tw`px-4 py-3 border-b border-slate-200 flex-row items-center justify-between`}>
        <Pressable onPress={() => router.back()}><Text style={tw`text-xl`}>‹</Text></Pressable>
        <Text style={tw`text-[16px] font-bold`}>Quét VietQR</Text>
        <View style={tw`w-6`} />
      </View>

      <View style={tw`flex-1 items-center justify-center px-6`}>
        <Image source={{ uri: qr.qrUrl }} style={tw`w-64 h-64`} />
        <Text style={tw`mt-4 text-slate-600`}>Số tiền: <Text style={tw`font-bold`}>{qr.amount.toLocaleString('vi-VN')} VND</Text></Text>
        <Text style={tw`mt-1 text-slate-600`}>Nội dung: <Text style={tw`font-semibold`}>{qr.addInfo}</Text></Text>
        <Text style={tw`mt-1 text-slate-500`}>Hết hạn sau: {mm}:{ss}</Text>

        {status === 'PAID' ? (
          <Text style={tw`mt-4 text-green-600 font-bold`}>ĐÃ THANH TOÁN</Text>
        ) : (
          <>
            <Text style={tw`mt-4 text-slate-500`}>Mở app ngân hàng để quét QR và chuyển khoản.</Text>
            {/* Nút mock để demo */}
            <Pressable
              onPress={async () => {
                await http.post('/payments/mock/vietqr-success', { invoiceId: qr.invoiceId });
              }}
              style={tw`mt-4 h-11 px-5 rounded-xl bg-blue-600 items-center justify-center`}
            >
              <Text style={tw`text-white font-bold`}>Tôi đã chuyển</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
