import tw from '@lib/tw';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

export type CancelTarget = { orderItemId: string; name: string; qty: number };

const REASONS = ['Khách đổi món', 'Đặt nhầm', 'Hết hàng', 'In lộn phiếu', 'Khác'] as const;
type ReasonKey = (typeof REASONS)[number];

export default function CancelOneItemModal({
  open,
  onClose,
  item,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  item: CancelTarget | null;
  onConfirm: (p: { qty: number; reason: string }) => Promise<void> | void;
}) {


  console.log('CancelOneItemModal rendered with item:', item);
  // số lượng tối đa được phép huỷ
  const max = useMemo(() => item?.qty ?? 0, [item]);

  const [qty, setQty] = useState(1);
  const [reasonKey, setReasonKey] = useState<ReasonKey>('Khác');
  const [reasonOther, setReasonOther] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // reset state mỗi lần mở modal cho một item mới
  useEffect(() => {
    if (open && item) {
      setQty(1);
      setReasonKey('Khác');
      setReasonOther('');
      setSubmitting(false);
    }
  }, [open, item?.orderItemId]);

  // không mở hoặc không có item thì không render gì
  if (!open || !item) return null;

  const reason = reasonKey === 'Khác' ? reasonOther.trim() : reasonKey;

  const canSubmit = qty >= 1 && qty <= max && reason.length > 0 && !submitting;

  const handleConfirm = async () => {
    if (!canSubmit || submitting) return;
    try {
      setSubmitting(true);
      await onConfirm({ qty, reason });
    } catch (err) {
      console.error('CancelOneItemModal onConfirm error', err);
      // TODO: nếu có notify/toast thì show message ở đây
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 items-center justify-center`}>
        <View style={tw`w-[90%] rounded-xl bg-white p-5`}>
          <Text style={tw`text-base font-semibold mb-2`}>Xác nhận giảm / Huỷ món</Text>

          <Text style={tw`text-sm text-slate-600 mb-4`}>
            Bạn có chắc chắn muốn huỷ món{' '}
            <Text style={tw`font-semibold`}>{item.name}</Text> không?
          </Text>

          {/* SỐ LƯỢNG HUỶ */}
          <View style={tw`mb-4`}>
            <Text style={tw`mb-1 text-sm font-medium text-slate-700`}>Số lượng huỷ</Text>
            <View style={tw`flex-row items-center gap-3`}>
              <Pressable
                onPress={() => setQty(q => Math.max(1, q - 1))}
                style={tw`h-8 w-8 rounded-full border items-center justify-center`}
              >
                <Text style={tw`text-lg`}>–</Text>
              </Pressable>

              <Text style={tw`min-w-[40px] text-center font-semibold`}>{qty}</Text>
              <Text style={tw`text-slate-500`}>/ {max}</Text>

              <Pressable
                onPress={() => setQty(q => Math.min(max, q + 1))}
                style={tw`h-8 w-8 rounded-full border items-center justify-center`}
              >
                <Text style={tw`text-lg`}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* LÝ DO HUỶ */}
          <View style={tw`mb-4`}>
            <Text style={tw`mb-1 text-sm font-medium text-slate-700`}>Lý do huỷ</Text>

            <View style={tw`flex-row flex-wrap gap-2`}>
              {REASONS.map(r => {
                const active = reasonKey === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReasonKey(r)}
                    style={tw.style(
                      'px-3 h-9 rounded-full border items-center justify-center',
                      active ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300',
                    )}
                  >
                    <Text style={tw`${active ? 'text-white' : 'text-slate-700'} text-sm`}>
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {reasonKey === 'Khác' && (
              <TextInput
                style={tw`mt-2 h-10 rounded-md border px-3 text-sm`}
                placeholder="Nhập lý do khác…"
                value={reasonOther}
                onChangeText={setReasonOther}
              />
            )}
          </View>

          {/* ACTION */}
          <View style={tw`flex-row justify-end gap-2`}>
            <Pressable
              onPress={onClose}
              style={tw`h-10 px-4 rounded-md border items-center justify-center`}
            >
              <Text>Huỷ</Text>
            </Pressable>

            <Pressable
              disabled={!canSubmit}
              onPress={handleConfirm}
              style={tw.style(
                'h-10 px-4 rounded-md items-center justify-center',
                canSubmit ? 'bg-red-600' : 'bg-red-300',
              )}
            >
              <Text style={tw`text-white font-semibold`}>
                {submitting ? 'Đang xử lý…' : 'Chắc chắn'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
