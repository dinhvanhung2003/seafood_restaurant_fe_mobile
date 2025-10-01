// app/(app)/table/checkout.tsx
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import http from '@services/http';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView,
    Linking,
    Modal, Platform,
    Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
const RT_URL = __DEV__
  ? 'http://localhost:8000/realtime'         // chỉnh theo host BE dev
  : 'https://your-domain.com/realtime';
type PayMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIX' | 'VIETQR';

const money = (n: number) => { try { return n.toLocaleString('vi-VN'); } catch { return String(n); } };
const parseVND = (s: string) => {
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};

const RadioRow = ({ checked, label, onPress, right }:{
  checked: boolean; label: string; onPress: () => void; right?: React.ReactNode;
}) => (
  <Pressable onPress={onPress} style={tw`flex-row items-center justify-between px-4 py-3`}>
    <View style={tw`flex-row items-center`}>
      <View style={tw`h-5 w-5 rounded-full border ${checked ? 'border-blue-600' : 'border-slate-400'} items-center justify-center`}>
        {checked ? <View style={tw`h-3 w-3 rounded-full bg-blue-600`} /> : null}
      </View>
      <Text style={tw`ml-3 text-[15px] text-slate-900`}>{label}</Text>
    </View>
    {right}
  </Pressable>
);

export default function CheckoutScreen() {
  const router = useRouter();
  const { tableId, name, total: totalParam } =
    useLocalSearchParams<{ tableId: string; name?: string; total?: string }>();
  const { orderIds, pay } = useOrders();

  const total = Math.max(0, Number(totalParam ?? 0));

  const [discountStr, setDiscountStr] = useState('0');
  const discount = useMemo(() => Math.min(parseVND(discountStr), total), [discountStr, total]);

  const [method, setMethod] = useState<PayMethod>('CASH');
  const [cashStr, setCashStr] = useState('100000');
  const [cardStr, setCardStr] = useState('0');
  const [transferStr, setTransferStr] = useState('0');

  const needToPay = Math.max(0, total - discount);
  const cash = parseVND(cashStr);
  const card = parseVND(cardStr);
  const transfer = parseVND(transferStr);

  const paid = useMemo(() => {
    if (method === 'CASH') return cash;
    if (method === 'CARD') return card;
    if (method === 'TRANSFER') return transfer;
    if (method === 'VIETQR') return 0;
    return cash + card + transfer;
  }, [method, cash, card, transfer]);

  const change = Math.max(0, paid - needToPay);
  const canPay = (method === 'VIETQR') ? needToPay > 0 : (paid >= needToPay && needToPay > 0);

  const [submitting, setSubmitting] = useState(false);

  const onPay = async () => {
    if (!canPay || !tableId) return;
    if (method === 'VIETQR') {
      setShowQr(true);
      if (!qr.imgUrl) await createQrFlow();
      return;
    }
    setSubmitting(true);
    try {
      await pay(tableId as string, needToPay);
      router.back();
    } finally { setSubmitting(false); }
  };

  // ===== VietQR state + timers =====
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState<{ imgUrl?: string; invoiceId?: string; expireAt?: string; deeplink?: string }>({});
  const [qrLoading, setQrLoading] = useState(false);
  const [remain, setRemain] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };
  useEffect(() => () => clearTimers(), []);

  const createQrFlow = async () => {
    if (!tableId) return;
    try {
      setQrLoading(true);

      const oid = orderIds[tableId as string];
      if (!oid) throw new Error('ORDER_NOT_FOUND');

      // tạo invoice từ order
      const invRes = await http.post(`/invoices/from-order/${oid}`);
      const invoiceId: string =
        invRes.data?.id ?? invRes.data?.data?.id ?? invRes.data?.invoice?.id;
      if (!invoiceId) throw new Error('CREATE_INVOICE_FAILED');

      // gọi BE VietQR
      const qrRes = await http.post('/payments/vietqr', {
        invoiceId,
        amount: needToPay,
      });

      const imgUrl: string =
        qrRes.data?.imgUrl || qrRes.data?.qrUrl || qrRes.data?.qr || qrRes.data?.qrImage;
      const expireAt: string | undefined = qrRes.data?.expireAt;
      const deeplink: string | undefined = qrRes.data?.deeplink;

      setQr({ imgUrl, invoiceId, expireAt, deeplink });

      if (expireAt) {
        const calcRemain = () => Math.max(0, Math.floor((+new Date(expireAt) - Date.now()) / 1000));
        setRemain(calcRemain());
        tickRef.current = setInterval(() => setRemain(calcRemain()), 1000);
      }

      pollRef.current = setInterval(async () => {
        try {
          const st = await http.get('/payments/status', { params: { invoiceId } });
          if (st.data?.status === 'PAID') {
            clearTimers();
            setShowQr(false);
            router.back();
          }
        } catch { }
      }, 2500);
    } catch (e) {
      console.warn(e);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={tw`flex-1 bg-white`} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      {/* Header */}
      <View style={tw`px-4 py-3 border-b border-slate-200 flex-row items-center justify-between`}>
        <Pressable onPress={() => router.back()}><Text style={tw`text-xl`}>‹</Text></Pressable>
        <View style={tw`items-center`}>
          <Text style={tw`text-[16px] font-bold`}>Thanh toán</Text>
          <Text style={tw`text-[12px] text-slate-500`}>{name ? `Bàn ${name}` : `Bàn`}</Text>
        </View>
        <View style={tw`w-6`} />
      </View>

      <ScrollView contentContainerStyle={tw`pb-28`}>
        {/* Khách lẻ */}
        <View style={tw`px-4 py-3 border-b border-slate-100`}>
          <View style={tw`h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 justify-center`}>
            <Text style={tw`text-slate-700`}>👤 Khách lẻ</Text>
          </View>
        </View>

        {/* Tổng – Giảm – Cần trả */}
        <View style={tw`px-4 py-3 border-b border-slate-100`}>
          <View style={tw`flex-row items-center justify-between py-1`}>
            <Text style={tw`text-slate-600`}>Tổng tiền hàng</Text>
            <Text style={tw`text-slate-900 font-semibold`}>{money(total)}</Text>
          </View>

          <View style={tw`flex-row items-center justify-between py-1`}>
            <Text style={tw`text-slate-600`}>Giảm giá</Text>
            <View style={tw`flex-row items-center`}>
              <Text style={tw`mr-2 text-slate-500`}>VND</Text>
              <TextInput
                value={discountStr}
                onChangeText={setDiscountStr}
                inputMode="numeric"
                keyboardType="number-pad"
                placeholder="0"
                style={tw`h-9 w-36 px-3 rounded-lg border border-slate-300 text-right`}
              />
            </View>
          </View>

          <View style={tw`flex-row items-center justify-between py-2 mt-1`}>
            <Text style={tw`text-[15px] font-semibold`}>Khách cần trả</Text>
            <Text style={tw`text-[15px] font-extrabold text-slate-900`}>{money(needToPay)}</Text>
          </View>
        </View>

        {/* Hình thức thanh toán */}
        <View style={tw`px-4 py-2`}>
          <Text style={tw`text-[12px] text-slate-500 mb-2`}>HÌNH THỨC THANH TOÁN</Text>

          <View style={tw`rounded-2xl border border-blue-400`}>
            <RadioRow checked={method === 'CASH'} label="Tiền mặt" onPress={() => setMethod('CASH')}
              right={
                <View style={tw`flex-row items-center`}>
                  <Text style={tw`mr-2 text-blue-600 font-semibold`}>VND</Text>
                  <TextInput value={cashStr} onChangeText={setCashStr}
                    editable={method === 'CASH' || method === 'MIX'}
                    inputMode="numeric" keyboardType="number-pad"
                    style={tw`h-9 w-40 px-3 rounded-lg border ${(method==='CASH'||method==='MIX') ? 'border-blue-300' : 'border-slate-200 bg-slate-100'} text-right`} />
                </View>
              }/>
          </View>

          <View style={tw`mt-2 rounded-2xl border border-slate-200`}>
            <RadioRow checked={method === 'CARD'} label="Thẻ" onPress={() => setMethod('CARD')}
              right={
                <TextInput value={cardStr} onChangeText={setCardStr}
                  editable={method === 'CARD' || method === 'MIX'}
                  inputMode="numeric" keyboardType="number-pad"
                  style={tw`h-9 w-40 px-3 rounded-lg border ${(method==='CARD'||method==='MIX') ? 'border-blue-300' : 'border-slate-200 bg-slate-100'} text-right`} />
              }/>
          </View>

          <View style={tw`mt-2 rounded-2xl border border-slate-200`}>
            <RadioRow checked={method === 'TRANSFER'} label="Chuyển khoản" onPress={() => setMethod('TRANSFER')}
              right={
                <TextInput value={transferStr} onChangeText={setTransferStr}
                  editable={method === 'TRANSFER' || method === 'MIX'}
                  inputMode="numeric" keyboardType="number-pad"
                  style={tw`h-9 w-40 px-3 rounded-lg border ${(method==='TRANSFER'||method==='MIX') ? 'border-blue-300' : 'border-slate-200 bg-slate-100'} text-right`} />
              }/>
          </View>

          {/* VietQR */}
          <View style={tw`mt-2 rounded-2xl border ${method === 'VIETQR' ? 'border-blue-400' : 'border-slate-200'}`}>
            <RadioRow
              checked={method === 'VIETQR'}
              label="Quét VietQR"
              onPress={() => setMethod('VIETQR')}
              right={
                <Pressable
                  onPress={() => { setShowQr(true); if (!qr.imgUrl) createQrFlow(); }}
                  style={tw`px-3 h-9 rounded-lg ${method === 'VIETQR' ? 'bg-blue-600' : 'bg-slate-200'} items-center justify-center`}
                >
                  <Text style={tw`${method === 'VIETQR' ? 'text-white' : 'text-slate-700'} font-medium`}>Tạo mã</Text>
                </Pressable>
              }
            />
          </View>

          <View style={tw`mt-2 rounded-2xl border border-slate-200`}>
            <RadioRow checked={method === 'MIX'} label="Kết hợp" onPress={() => setMethod('MIX')}
              right={<Text style={tw`text-slate-500`}>Nhập tiền ở các ô trên</Text>}
            />
          </View>
        </View>

        {method !== 'VIETQR' && (
          <View style={tw`px-4 py-3`}>
            <Text style={tw`text-[12px] text-slate-500 mb-1`}>Tiền thừa trả khách</Text>
            <View style={tw`h-12 rounded-xl border border-slate-200 px-4 flex-row items-center justify-between`}>
              <Text style={tw`text-slate-500`}>VND</Text>
              <Text style={tw`text-[16px] font-bold`}>{money(change)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}>
        <Pressable disabled={!canPay || submitting} onPress={onPay}
          style={tw.style('h-12 rounded-xl items-center justify-center', canPay ? 'bg-blue-600' : 'bg-slate-300')}>
          {submitting ? <ActivityIndicator color="#fff" /> :
            <Text style={tw`text-white font-bold`}>
              {method === 'VIETQR' ? `Tạo mã & thanh toán: ${money(needToPay)}` : `Thanh toán: ${money(needToPay)}`}
            </Text>}
        </Pressable>
        {!canPay && method !== 'VIETQR' && (
          <Text style={tw`mt-2 text-center text-xs text-slate-500`}>
            Nhập số tiền ≥ {money(needToPay)} để thanh toán
          </Text>
        )}
      </View>

      {/* Modal QR VietQR */}
      <Modal visible={showQr} transparent animationType="slide"
        onRequestClose={() => { setShowQr(false); clearTimers(); }}>
        <View style={tw`flex-1 bg-black/40 items-center justify-end`}>
          <View style={tw`w-full bg-white rounded-t-2xl p-4`}>
            <View style={tw`items-center`}>
              <Text style={tw`text-base font-bold`}>Quét VietQR</Text>
              <Text style={tw`mt-1 text-slate-600`}>Số tiền: {money(needToPay)} VND</Text>
              {remain != null && <Text style={tw`mt-1 text-slate-500`}>Hết hạn sau: {remain}s</Text>}
            </View>

            <View style={tw`mt-3 items-center justify-center min-h-[220px]`}>
              {qrLoading ? <ActivityIndicator /> :
                qr.imgUrl ? <Image source={{ uri: qr.imgUrl }} style={tw`w-56 h-56`} contentFit="contain" /> :
                <Text style={tw`text-slate-500`}>Không tạo được QR</Text>}
            </View>

            <View style={tw`mt-4 flex-row gap-3`}>
              <Pressable onPress={() => { setShowQr(false); clearTimers(); }}
                style={tw`flex-1 h-11 rounded-xl border border-slate-300 items-center justify-center`}>
                <Text style={tw`text-slate-700 font-medium`}>Đóng</Text>
              </Pressable>

              {qr.deeplink ? (
                <Pressable onPress={() => Linking.openURL(qr.deeplink!)}
                  style={tw`flex-1 h-11 rounded-xl bg-blue-600 items-center justify-center`}>
                  <Text style={tw`text-white font-bold`}>Mở app ngân hàng</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={async () => {
                    if (!qr.invoiceId) return;
                    await http.post('/payments/mock/vietqr-success', { invoiceId: qr.invoiceId });
                  }}
                  style={tw`flex-1 h-11 rounded-xl bg-blue-600 items-center justify-center`}>
                  <Text style={tw`text-white font-bold`}>Tôi đã chuyển (demo)</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
