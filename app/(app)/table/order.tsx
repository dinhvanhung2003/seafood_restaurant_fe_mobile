// apps/mobile/app/(app)/table/order.tsx
import { useKitchenFlow } from '@hooks/notification/useKitchenFlow';
import { useKitchenVoids } from '@hooks/notification/useKitchenVoids';
import { useCancelSocketLive } from '@hooks/socket/socket/useCancelSocket';
import { useKitchenProgress } from '@hooks/useKitchenProgress';
import { useMenu } from '@hooks/useMenu';
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import http from '@services/http';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import CancelOneItemModal from '../../../src/components/modal/CancelOneItemModal';
import { usePosSocketLive } from '../../../src/hooks/socket/socket/useSocket';

type Meta = { id: string; name: string; price: number; image?: string };

// Kiểu khách hàng tối thiểu
type CustomerLite = {
  id: string;
  name: string;
  phone?: string | null;
};

export default function OrderScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { orders } = useOrders();
  const orderRow = orders[tableId as string]?.orders?.[0];
  const items: Array<{ id: string; qty: number; rowId?: string }> = orderRow?.items ?? [];

  // meta món
  const menuQ = useMenu({ page: 1, limit: 500, search: '', categoryId: 'all' });
  const menuMap = useMemo(() => {
    const raw = Array.isArray(menuQ.data?.data) ? menuQ.data.data : menuQ.data ?? [];
    const map = new Map<string, Meta>();
    for (const r of raw) {
      map.set(r.id, {
        id: r.id,
        name: r.name,
        price: Number(r.price ?? 0),
        image: r.image ?? r.imageUrl ?? r.photoUrl,
      });
    }
    return map;
  }, [menuQ.data]);

  const total = useMemo(
    () => items.reduce((s, it) => s + (menuMap.get(it.id)?.price ?? 0) * it.qty, 0),
    [items, menuMap],
  );

  // meta khách / số khách từ orderRow
  const guestCount = orderRow?.guestCount ?? 0;
  const customer: CustomerLite | null = orderRow?.customer ?? null;

  // flow hủy / báo bếp
  const {
    currentOrderId,
    canNotify,
    notifying,
    onChangeQty,
    onNotify,
    cancelOneOpen,
    cancelOne,
    setCancelOneOpen,
    confirmCancelOne,
  } = useKitchenFlow(tableId as string);

  // banner void từ bếp
  const { kitchenVoids, clearKitchenVoid, clearAllKitchenVoids } =
    useKitchenVoids(currentOrderId);

  // progress để show badge
  const { data: progress = [] } = useKitchenProgress(currentOrderId);

  usePosSocketLive(currentOrderId);
  useCancelSocketLive(currentOrderId);

  const progressMap = useMemo(() => {
    const m = new Map<
      string,
      { notified: number; preparing: number; ready: number; served: number; cooked: number }
    >();
    for (const r of progress as any[]) {
      m.set(r.menuItemId, {
        notified: r.notified,
        preparing: r.preparing,
        ready: r.ready,
        served: r.served,
        cooked: r.cooked,
      });
    }
    return m;
  }, [progress]);

  // 🔹 state mở modal
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  // 🔹 gọi API cập nhật meta order
  const updateOrderMeta = async (body: { guestCount?: number; customerId?: string | null }) => {
    if (!currentOrderId) return;
    await http.patch(`/orders/${currentOrderId}/meta`, body);
    // tuỳ hệ thống query key, anh/chị có thể refetch:
    // await qc.invalidateQueries({ queryKey: ['orders'] });
    // hoặc chỉ rely vào socket order:meta_updated
    await qc.invalidateQueries({ queryKey: ['active-orders'] });
  };

  const renderItem = ({ item }: { item: { id: string; qty: number; rowId?: string } }) => {
    const meta = menuMap.get(item.id);
    const displayName = meta?.name ?? item.id.slice(0, 6);
    const price = meta?.price ?? 0;
    const p =
      progressMap.get(item.id) ?? {
        notified: 0,
        preparing: 0,
        ready: 0,
        served: 0,
        cooked: 0,
      };

    return (
      <View style={tw`px-4 py-3 border-b border-slate-100`}>
        <View style={tw`flex-row items-center gap-3`}>
          <Image
            source={meta?.image ? { uri: meta.image } : undefined}
            style={tw`w-12 h-12 rounded-lg bg-slate-100`}
            contentFit="cover"
            transition={150}
          />
          <View style={tw`flex-1`}>
            <Text numberOfLines={2} style={tw`text-[15px] font-semibold text-slate-900`}>
              {displayName}
            </Text>
            <Text style={tw`mt-1 text-slate-600`}>{price.toLocaleString('vi-VN')}</Text>

            <View style={tw`mt-1 flex-row flex-wrap gap-2`}>
              <Badge label={`Đã báo: ${p.notified}`} />
              <Badge label={`Đang nấu: ${p.preparing}`} />
              <Badge label={`Ra món: ${p.ready}`} />
              <Badge label={`Đã phục vụ: ${p.served}`} />
            </View>
          </View>

          <View style={tw`flex-row items-center`}>
            <Pressable
              onPress={() => onChangeQty(item.id, -1, displayName)}
              style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
            >
              <Text style={tw`text-xl`}>−</Text>
            </Pressable>
            <Text style={tw`mx-3 w-6 text-center font-semibold`}>{item.qty}</Text>
            <Pressable
              onPress={() => onChangeQty(item.id, +1, displayName)}
              style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
            >
              <Text style={tw`text-xl`}>＋</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={tw`flex-1 bg-white`}>
      {/* Header */}
      <View style={tw`px-4 py-3 border-b border-slate-100 flex-row items-center justify-between`}>
        <Pressable onPress={() => router.back()}>
          <Text style={tw`text-xl`}>‹</Text>
        </Pressable>
        <Text style={tw`text-base font-bold`}>{name ? `${name}` : 'Đơn'}</Text>
        <Pressable>
          <Text style={tw`text-xl`}>⋯</Text>
        </Pressable>
      </View>

      {/* Banner món đã huỷ từ bếp */}
      {!!kitchenVoids?.length && (
        <View style={tw`px-4 pt-2`}>
          {kitchenVoids.map((v: any, idx: number) => {
            const meta = menuMap.get(v.menuItemId);
            const displayName =
              meta?.name || v.name || `Món ${v.menuItemId?.slice(0, 6) || '???'}`;
            return (
              <View
                key={`${v.menuItemId}-${v.ticketId ?? idx}`}
                style={tw`mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2`}
              >
                <View style={tw`flex-row items-center justify-between`}>
                  <Text style={tw`text-[13px] font-semibold text-red-700`}>
                    {displayName} x{v.qty} — Đã hủy từ bếp
                  </Text>
                  <Pressable onPress={() => clearKitchenVoid(v.menuItemId)}>
                    <Text style={tw`text-[11px] text-red-700`}>Ẩn</Text>
                  </Pressable>
                </View>
                {!!v.reason && (
                  <Text style={tw`mt-1 text-[12px] text-red-700`}>Lý do: {v.reason}</Text>
                )}
              </View>
            );
          })}

          {kitchenVoids.length > 1 && (
            <Pressable
              onPress={clearAllKitchenVoids}
              style={tw`self-end mt-1 px-3 py-1 rounded-full bg-red-100`}
            >
              <Text style={tw`text-[11px] font-medium text-red-700`}>Ẩn tất cả</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 🔹 Chips: khách + số khách + ghi chú */}
      <View style={tw`px-3 py-2 flex-row flex-wrap gap-2`}>
        <Pressable onPress={() => setGuestModalOpen(true)}>
          <Chip label={`Khách: ${guestCount || 0}`} />
        </Pressable>

        <Pressable onPress={() => setCustomerModalOpen(true)}>
          <Chip
            label={
              customer?.name
                ? `KH: ${customer.name}`
                : 'Chọn khách'
            }
          />
        </Pressable>

        <Chip label="Ghi chú" />
      </View>

      {/* Danh sách món */}
      {menuQ.isLoading && !menuMap.size ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.rowId ?? `${x.id}`}
          renderItem={renderItem}
          contentContainerStyle={tw`pb-28`}
        />
      )}

      {/* Nút nổi thêm món */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(app)/table/[id]',
            params: { id: tableId as string, name },
          })
        }
        style={tw`absolute right-5 bottom-26 h-14 w-14 rounded-full bg-blue-600 items-center justify-center shadow z-100`}
      >
        <Text style={tw`text-white text-2xl`}>＋</Text>
      </Pressable>

      {/* Thanh đáy */}
      <View
        style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}
      >
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text style={tw`text-slate-600`}>Tổng tiền</Text>
          <Text style={tw`text-[16px] font-bold`}>{total.toLocaleString('vi-VN')}</Text>
        </View>

        <View style={tw`flex-row gap-3`}>
          <Pressable
            onPress={() => onNotify(name || String(tableId))}
            disabled={!canNotify || notifying}
            style={tw`flex-1 h-12 rounded-xl border border-blue-600 items-center justify-center ${
              !canNotify || notifying ? 'opacity-50' : ''
            }`}
          >
            <Text style={tw`text-blue-600 font-bold`}>
              {notifying ? 'Đang gửi...' : 'Thông báo'}
            </Text>
          </Pressable>

          {/* <Pressable
            style={tw`flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center`}
            onPress={() =>
              router.push({
                pathname: '/(app)/table/checkout',
                params: { tableId: tableId as string, name, total: String(total) },
              })
            }
          >
            <Text style={tw`text-white font-bold`}>Thanh toán</Text>
          </Pressable> */}
        </View>
      </View>

      <CancelOneItemModal
        open={cancelOneOpen}
        item={cancelOne}
        onClose={() => setCancelOneOpen(false)}
        onConfirm={confirmCancelOne}
      />

      {/* 🔹 Modal chọn khách */}
      <SelectCustomerModal
        visible={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelected={async (c) => {
          await updateOrderMeta({ customerId: c.id });
          setCustomerModalOpen(false);
        }}
      />

      {/* 🔹 Modal nhập số khách */}
      <GuestCountModalMobile
        visible={guestModalOpen}
        initialValue={guestCount || 1}
        onClose={() => setGuestModalOpen(false)}
        onSubmit={async (value) => {
          await updateOrderMeta({ guestCount: value });
          setGuestModalOpen(false);
        }}
      />
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={tw`px-3 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center`}
    >
      <Text style={tw`text-slate-700`}>{label}</Text>
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View
      style={tw`px-2 h-6 rounded-full bg-slate-100 border border-slate-200 items-center justify-center`}
    >
      <Text style={tw`text-[12px] text-slate-700`}>{label}</Text>
    </View>
  );
}

/** ===== Modal chọn khách (mobile) ===== */
function SelectCustomerModal({
  visible,
  onClose,
  onSelected,
}: {
  visible: boolean;
  onClose: () => void;
  onSelected: (c: CustomerLite) => void | Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CustomerLite[]>([]);

  const handleSearch = async () => {
    if (!q.trim()) return;
    try {
      setLoading(true);
      // 👉 Endpoint search khách – chỉnh lại path/param cho đúng BE của anh/chị
      const { data } = await http.get('/customers', {
        params: { search: q.trim(), limit: 20 },
      });
      // giả sử BE trả { data: [...] }
      const rows = Array.isArray(data?.data) ? data.data : data ?? [];
      setResults(
        rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-6`}>
        <View style={tw`rounded-2xl bg-white p-4 max-h-[70%]`}>
          <Text style={tw`text-base font-semibold mb-2`}>Chọn khách hàng</Text>

          <View style={tw`flex-row items-center mb-3`}>
            <TextInput
              style={tw`flex-1 border border-slate-200 rounded-xl px-3 h-10`}
              placeholder="Tìm theo tên / SĐT"
              value={q}
              onChangeText={setQ}
            />
            <Pressable
              onPress={handleSearch}
              style={tw`ml-2 px-3 h-10 rounded-xl bg-blue-600 items-center justify-center`}
            >
              <Text style={tw`text-white font-semibold`}>Tìm</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={tw`py-6 items-center`}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(it) => it.id}
              style={tw`max-h-[40vh]`}
              ListEmptyComponent={
                <View style={tw`py-4 items-center`}>
                  <Text style={tw`text-slate-500 text-sm`}>Không có kết quả.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelected(item)}
                  style={tw`px-3 py-2 rounded-lg border border-slate-200 mb-2`}
                >
                  <Text style={tw`font-medium`}>{item.name}</Text>
                  {!!item.phone && (
                    <Text style={tw`text-xs text-slate-500`}>{item.phone}</Text>
                  )}
                </Pressable>
              )}
            />
          )}

          <View style={tw`mt-3 flex-row justify-end gap-3`}>
            <Pressable onPress={onClose}>
              <Text style={tw`text-slate-600`}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** ===== Modal nhập số khách (mobile) ===== */
function GuestCountModalMobile({
  visible,
  initialValue,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initialValue: number;
  onClose: () => void;
  onSubmit: (value: number) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initialValue || 1);

  const change = (delta: number) => {
    setValue((v) => Math.max(1, v + delta));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-10`}>
        <View style={tw`rounded-2xl bg-white p-4 items-center`}>
          <Text style={tw`text-base font-semibold mb-3`}>Số khách</Text>

          <View style={tw`flex-row items-center gap-4 mb-4`}>
            <Pressable
              onPress={() => change(-1)}
              style={tw`w-10 h-10 rounded-full bg-slate-100 items-center justify-center`}
            >
              <Text style={tw`text-xl`}>−</Text>
            </Pressable>
            <Text style={tw`text-2xl font-bold w-10 text-center`}>{value}</Text>
            <Pressable
              onPress={() => change(+1)}
              style={tw`w-10 h-10 rounded-full bg-slate-100 items-center justify-center`}
            >
              <Text style={tw`text-xl`}>＋</Text>
            </Pressable>
          </View>

          <View style={tw`flex-row gap-4`}>
            <Pressable onPress={onClose}>
              <Text style={tw`text-slate-600`}>Huỷ</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(value)}
              style={tw`px-4 h-10 rounded-xl bg-blue-600 items-center justify-center`}
            >
              <Text style={tw`text-white font-semibold`}>Lưu</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
