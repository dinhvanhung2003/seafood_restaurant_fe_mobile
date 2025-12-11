import { Feather } from '@expo/vector-icons';
import { useKitchenFlow } from '@hooks/notification/useKitchenFlow';
import type { HistoryItem } from '@hooks/notification/useKitchenHistory';
import { useKitchenVoids } from '@hooks/notification/useKitchenVoids';
import { useCancelSocketLive } from '@hooks/socket/socket/useCancelSocket';
import { useKitchenProgress } from '@hooks/useKitchenProgress';
import { useMenu } from '@hooks/useMenu';
import { useOrders } from '@hooks/useOrder';
import { getSocket } from '@lib/socket';
import tw from '@lib/tw';
import http from '@services/http';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AddCustomerModalMobile } from '../../../src/components/customer/modal/AddCustomerModalMobile';
import CancelOneItemModal from '../../../src/components/modal/CancelOneItemModal';
import { useKitchenHistory } from '../../../src/hooks/notification/useKitchenHistory';
import { usePosSocketLive } from '../../../src/hooks/socket/socket/useSocket';
type Meta = { id: string; name: string; price: number; image?: string };

type CustomerLite = {
  id: string;
  name: string;
  phone?: string | null;
};

export default function OrderScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
//  đánh dấu món (chỉ local, không gửi BE)
  const [isPriority, setIsPriority] = useState(false);

//  đánh dấu món (chỉ local, nhưng sẽ bật ưu tiên bếp)
const [flaggedIds, setFlaggedIds] = useState<string[]>([]);

  const toggleFlag = (rowKey: string) => {
  setFlaggedIds(prev => {
    const exists = prev.includes(rowKey);
    const next = exists
      ? prev.filter(x => x !== rowKey)
      : [...prev, rowKey];

    // 👉 Nếu còn ít nhất 1 món được gắn sao => bật ưu tiên
    //    Nếu bỏ hết sao => tắt ưu tiên
    setIsPriority(next.length > 0);

    return next;
  });
};

  
  

  const [orderNote, setOrderNote] = useState('');

  const { orders } = useOrders();

  

  const [orderNoteModalOpen, setOrderNoteModalOpen] = useState(false);
  const [itemNoteModalOpen, setItemNoteModalOpen] = useState(false);

  const [editingNoteItem, setEditingNoteItem] = useState<{
    id: string;
    menuItemId: string;
    name: string;
    note?: string | null;
  } | null>(null);

  const orderRow = orders[tableId as string]?.orders?.[0];

  const items = (orderRow?.items ?? []) as Array<{
    id: string;
    qty: number;
    rowId?: string;
    note?: string | null;
  }>;

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

  const guestCount = orderRow?.guestCount ?? 0;
  const customer: CustomerLite | null = orderRow?.customer ?? null;

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

  // đảm bảo modal huỷ luôn tắt khi vào / rời màn
  useEffect(() => {
    setCancelOneOpen(false);
    return () => {
      setCancelOneOpen(false);
    };
  }, [setCancelOneOpen]);

  const { kitchenVoids, clearKitchenVoid, clearAllKitchenVoids } =
    useKitchenVoids(currentOrderId);

  const { data: progress = [] } = useKitchenProgress(currentOrderId);
const { data: history = [], isLoading: historyLoading } = useKitchenHistory(currentOrderId);
  const [historyOpen, setHistoryOpen] = useState(false);
  usePosSocketLive(currentOrderId);
  useCancelSocketLive(currentOrderId);

 useEffect(() => {
  if (!currentOrderId) return;
  const s = getSocket();

  const onNewBatch = (p: {
    orderId: string;
    note?: string | null;
    priority?: boolean;
    source?: string;
  }) => {
    if (p.orderId !== currentOrderId) return;

    // chỉ sync lại ghi chú từ bếp (nếu có)
    setOrderNote(p.note ?? '');
    // ❌ KHÔNG setIsPriority ở đây, kẻo nó ghi đè lại ưu tiên mình đang chọn
    // setIsPriority(!!p.priority);
  };

  s.on('kitchen:new_batch', onNewBatch);
  return () => {
    s.off('kitchen:new_batch', onNewBatch);
  };
}, [currentOrderId]);


  useEffect(() => {
    if (!currentOrderId) return;
    const s = getSocket();

    const onItemNoteUpdated = (p: {
      orderId: string;
      orderItemId: string;
      menuItemId: string;
      note: string | null;
      by: string;
    }) => {
      if (p.orderId !== currentOrderId) return;
      qc.invalidateQueries({ queryKey: ['active-orders'] });
    };

    s.on('orderitem:note_updated', onItemNoteUpdated);
    return () => {
      s.off('orderitem:note_updated', onItemNoteUpdated);
    };
  }, [currentOrderId, qc]);

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

  // nếu orderRow không còn (auto huỷ) → quay về màn chọn món
  // useEffect(() => {
  //   if (!orderRow) {
  //     router.replace({
  //       pathname: '/(app)/table/[id]',
  //       params: { id: tableId as string, name },
  //     });
  //   }
  // }, [orderRow, tableId, name]);

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  const updateOrderMeta = async (body: { guestCount?: number; customerId?: string | null }) => {
    if (!currentOrderId) return;
    await http.patch(`/orders/${currentOrderId}/meta`, body);
    await qc.invalidateQueries({ queryKey: ['active-orders'] });
  };

  const renderItem = ({
    item,
  }: {
    item: { id: string; qty: number; rowId?: string; note?: string | null };
  }) => {
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


    // dùng rowId làm key chính, fallback về id nếu thiếu
    const rowKey = item.rowId ?? item.id;
    const isFlagged = flaggedIds.includes(rowKey);
    const itemNote = (item as any).note ?? '';

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

            <View style={tw`mt-1 flex-row flex-wrap`}>
              <Badge label={`Đã báo: ${p.notified}`} />
              <Badge label={`Đang nấu: ${p.preparing}`} />
              <Badge label={`Ra món: ${p.ready}`} />
              <Badge label={`Đã phục vụ: ${p.served}`} />
            </View>

            <View style={tw`mt-2`}>
              <Pressable
                onPress={() => {
                  setItemNoteModalOpen(true);
                  setEditingNoteItem({
                    id: item.rowId!,
                    menuItemId: item.id,
                    name: displayName,
                    note: itemNote,
                  });
                }}
              >
                <Chip
               
                  label={
                    itemNote
                      ? `Ghi chú: ${itemNote.slice(0, 10)}${
                          itemNote.length > 10 ? '…' : ''
                        }`
                      : 'Ghi chú'
                  }
                />
              </Pressable>
            </View>
          </View>

                  <View style={tw`flex-row items-center`}>
            {/* ⭐ nút đánh dấu chỉ cho waiter / thu ngân */}
            <Pressable
              onPress={() => toggleFlag(rowKey)}
              style={tw`mr-2`}
              hitSlop={8}
            >
              <Feather
                name="star"
                size={20}
                color={isFlagged ? '#facc15' : '#cbd5f5'} // vàng khi được đánh dấu, xám khi tắt
              />
            </Pressable>

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
      <View
        style={tw`px-4 py-3 border-b border-slate-100 flex-row items-center justify-between`}
      >
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

      {/* Chips meta */}
      <View style={tw`px-3 py-2 flex-row flex-wrap`}>
        <Pressable onPress={() => setGuestModalOpen(true)}>
          <Chip label={`Khách: ${guestCount || 0}`} />
        </Pressable>

        <View style={tw`flex-row items-center ml-2`}>
          <Pressable onPress={() => setCustomerModalOpen(true)}>
            <Chip label={customer?.name ? `KH: ${customer.name}` : 'Chọn khách'} />
          </Pressable>

          {customer && (
            <Pressable
              onPress={async () => {
                await updateOrderMeta({ customerId: null });
              }}
              style={tw`ml-1`}
            >
              <Chip label="✕" />
            </Pressable>
          )}
        </View>

        {/* <View style={tw`ml-2 mt-1`}>
          <Pressable onPress={() => setOrderNoteModalOpen(true)}>
            <Chip
              label={
                orderNote
                  ? `Ghi chú: ${orderNote.slice(0, 10)}${
                      orderNote.length > 10 ? '…' : ''
                    }`
                  : isPriority
                  ? 'Ưu tiên bếp'
                  : 'Ghi chú'
              }
            />
          </Pressable>
        </View> */}
      </View>

      {/* Danh sách món */}
      {menuQ.isLoading && !menuMap.size ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={x => x.rowId ?? `${x.id}`}
          renderItem={renderItem}
          contentContainerStyle={tw`pb-28`}
        />
      )}

      {/* Nút nổi thêm món */}
      <Pressable
        onPress={() => {
          setCancelOneOpen(false);
          router.push({
            pathname: '/(app)/table/[id]',
            params: { id: tableId as string, name },
          });
        }}
        style={tw`absolute right-5 bottom-26 h-14 w-14 rounded-full bg-blue-600 items-center justify-center shadow z-100`}
      >
        <Text style={tw`text-white text-2xl `}>＋</Text>
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
  {/* Nút lịch sử báo bếp */}
  <Pressable
    onPress={() => setHistoryOpen(true)}
    style={tw`w-20 h-12 rounded-xl border border-slate-300 items-center justify-center`}
  >
    <Feather name="clock" size={16} color="#0f172a" />
    <Text style={tw`text-[11px] mt-0.5`}>Lịch sử</Text>
  </Pressable>

  {/* Nút thông báo bếp */}
  <Pressable
    onPress={async () => {
      await onNotify({
        tableName: name || String(tableId),
        note: orderNote.trim() || undefined,
        priority: isPriority,
        source: 'waiter',
      });

      // gửi xong refresh luôn lịch sử
      await qc.invalidateQueries({ queryKey: ['kitchen-history', currentOrderId] });

      setIsPriority(false);
      setFlaggedIds([]);
    }}
    disabled={!canNotify || notifying}
    style={tw`flex-1 h-12 rounded-xl border border-blue-600 items-center justify-center ${
      !canNotify || notifying ? 'opacity-50' : ''
    }`}
  >
    <Text style={tw`text-blue-600 font-bold`}>
      {notifying ? 'Đang gửi...' : 'Thông báo'}
    </Text>
  </Pressable>
</View>

      </View>

      {/* Modal huỷ một món */}
      {cancelOneOpen && cancelOne && (
        <CancelOneItemModal
          open={cancelOneOpen}
          item={cancelOne}
          onClose={() => setCancelOneOpen(false)}
          onConfirm={confirmCancelOne}
        />
      )}

      {/* Modal chọn khách */}
      <SelectCustomerModal
        visible={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelected={async c => {
          await updateOrderMeta({ customerId: c.id });
          setCustomerModalOpen(false);
        }}
        onClear={async () => {
          await updateOrderMeta({ customerId: null });
          setCustomerModalOpen(false);
        }}
      />

      {/* Modal nhập số khách */}
      <GuestCountModalMobile
        visible={guestModalOpen}
        initialValue={guestCount || 1}
        onClose={() => setGuestModalOpen(false)}
        onSubmit={async value => {
          await updateOrderMeta({ guestCount: value });
          setGuestModalOpen(false);
        }}
      />

      {/* Modal note + ưu tiên bếp */}
      <NotePriorityModal
        visible={orderNoteModalOpen}
        note={orderNote}
        priority={isPriority}
        onClose={() => setOrderNoteModalOpen(false)}
        onSave={(note, priority) => {
          setOrderNote(note);
          setIsPriority(priority);
          setOrderNoteModalOpen(false);
        }}
      />

      {/* Modal note cho từng món */}
      {editingNoteItem && (
        <ItemNoteModal
          visible={itemNoteModalOpen}
          item={editingNoteItem}
          onClose={() => {
            setItemNoteModalOpen(false);
            setEditingNoteItem(null);
          }}
          onSave={async newNote => {
            await http.patch(`/orderitems/${editingNoteItem.id}/note`, {
              note: newNote,
            });
            await qc.invalidateQueries({ queryKey: ['active-orders'] });
            setItemNoteModalOpen(false);
            setEditingNoteItem(null);
          }}
        />
      )}
            {/* Modal lịch sử báo bếp */}
      <KitchenHistoryModal
        visible={historyOpen}
        loading={historyLoading}
        data={history}
        onClose={() => setHistoryOpen(false)}
      />

    </View>
  );
}

function ItemNoteModal({
  visible,
  item,
  onClose,
  onSave,
}: {
  visible: boolean;
  item: { id: string; name: string; note?: string | null };
  onClose: () => void;
  onSave: (note: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(item.note ?? '');

  useEffect(() => {
    setValue(item.note ?? '');
  }, [item, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-6`}>
        <View style={tw`rounded-2xl bg-white p-4`}>
          <Text style={tw`text-base font-semibold mb-1`}>Ghi chú cho món</Text>
          <Text style={tw`text-sm text-slate-600 mb-2`}>{item.name}</Text>

          <TextInput
            style={tw`border border-slate-200 rounded-xl px-3 py-2 h-24 text-left text-top`}
            placeholder="Ví dụ: Ít cay, không hành…"
            multiline
            value={value}
            onChangeText={setValue}
          />

          <View style={tw`mt-4 flex-row justify-end gap-3`}>
            <Pressable onPress={onClose}>
              <Text style={tw`text-slate-600`}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(value)}
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
      style={tw`px-2 h-6 rounded-full bg-slate-100 border border-slate-200 items-center justify-center mr-2 mb-2`}
    >
      <Text style={tw`text-[12px] text-slate-700`}>{label}</Text>
    </View>
  );
}

function SelectCustomerModal({
  visible,
  onClose,
  onSelected,
  onClear,
}: {
  visible: boolean;
  onClose: () => void;
  onSelected: (c: CustomerLite) => void | Promise<void>;
  onClear?: () => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CustomerLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSearch = async () => {
  if (!q.trim()) return;
  try {
    setLoading(true);
    // ✅ Giống web POS: /cashier/customers?q=...
    const { data } = await http.get("/customers", {
      params: { q: q.trim() },
    });

    // Ở POS web `useCustomer(q)` thường trả thẳng mảng
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : [];

    setResults(
      rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
      })),
    );
  } catch (e: any) {
    console.log("Search customer error:", e?.response?.status, e?.response?.data);
  } finally {
    setLoading(false);
  }
};


  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-6`}>
        <View style={tw`rounded-2xl bg-white p-4`}>
          <Text style={tw`text-base font-semibold mb-2`}>Chọn khách hàng</Text>

          {/* Ô search giống web (tên / SĐT) + nút thêm khách */}
          <View style={tw`flex-row items-center mb-3`}>
            <TextInput
              style={tw`flex-1 border border-slate-200 rounded-xl px-3 h-10`}
              placeholder="Tìm theo tên / SĐT"
              value={q}
              onChangeText={setQ}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <Pressable
              onPress={handleSearch}
              style={tw`ml-2 px-3 h-10 rounded-xl bg-blue-600 items-center justify-center`}
            >
              <Text style={tw`text-white font-semibold`}>Tìm</Text>
            </Pressable>
            <Pressable
              onPress={() => setCreateOpen(true)}
              style={tw`ml-2 px-3 h-10 rounded-xl bg-emerald-600 items-center justify-center`}
            >
              <Text style={tw`text-white font-semibold`}>＋</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={tw`py-6 items-center`}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={it => it.id}
              style={{ maxHeight: 280 }}
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

          <View style={tw`mt-3 flex-row justify-between`}>
            {onClear && (
              <Pressable onPress={onClear}>
                <Text style={tw`text-red-500`}>Bỏ chọn khách</Text>
              </Pressable>
            )}

            <Pressable onPress={onClose}>
              <Text style={tw`text-slate-600`}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Modal thêm khách mới (mobile) */}
      <AddCustomerModalMobile
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async c => {
          // giống web: tạo xong -> select luôn khách đó
          await onSelected({
            id: c.id,
            name: c.name,
            phone: c.phone,
          });
          setCreateOpen(false);
        }}
      />
    </Modal>
  );
}


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
    setValue(v => Math.max(1, v + delta));
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

function NotePriorityModal({
  visible,
  note,
  priority,
  onClose,
  onSave,
}: {
  visible: boolean;
  note: string;
  priority: boolean;
  onClose: () => void;
  onSave: (note: string, priority: boolean) => void;
}) {
  const [localNote, setLocalNote] = useState(note);
  const [localPriority, setLocalPriority] = useState(priority);

  useEffect(() => {
    setLocalNote(note);
    setLocalPriority(priority);
  }, [note, priority, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-6`}>
        <View style={tw`rounded-2xl bg-white p-4`}>
          <Text style={tw`text-base font-semibold mb-2`}>Ghi chú cho bếp</Text>

          <TextInput
            style={tw`border border-slate-200 rounded-xl px-3 py-2 h-24 text-left text-top`}
            placeholder="Ví dụ: Ưu tiên ra nhanh, ít cay, không hành..."
            multiline
            value={localNote}
            onChangeText={setLocalNote}
          />

          <View style={tw`mt-3 flex-row items-center justify-between`}>
            <Text style={tw`text-sm text-slate-700`}>Đánh dấu ưu tiên</Text>
            <Pressable
              onPress={() => setLocalPriority(p => !p)}
              style={tw`w-12 h-7 rounded-full ${
                localPriority ? 'bg-emerald-500' : 'bg-slate-300'
              } justify-center`}
            >
              <View
                style={tw`w-6 h-6 rounded-full bg-white ${
                  localPriority ? 'ml-6' : 'ml-1'
                }`}
              />
            </Pressable>
          </View>

          <View style={tw`mt-4 flex-row justify-end gap-3`}>
            <Pressable onPress={onClose}>
              <Text style={tw`text-slate-600`}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(localNote, localPriority)}
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
function formatKitchenTime(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function KitchenHistoryModal({
  visible,
  loading,
  data,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  data: HistoryItem[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-4`}>
        <View style={tw`max-h-[80%] rounded-2xl bg-white p-4`}>
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={tw`text-base font-semibold`}>Lịch sử báo bếp</Text>
            <Pressable onPress={onClose}>
              <Text style={tw`text-slate-600`}>Đóng</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={tw`py-6 items-center`}>
              <ActivityIndicator />
            </View>
          ) : data.length === 0 ? (
            <View style={tw`py-4 items-center`}>
              <Text style={tw`text-sm text-slate-500`}>Chưa có lịch sử.</Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(it) => it.id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <View style={tw`mb-3 rounded-xl border border-slate-200`}>
                  <View style={tw`px-3 py-2`}>
                    <Text style={tw`text-[11px] text-slate-500`}>
                      {formatKitchenTime(item.createdAt)}
                    </Text>
                    <Text style={tw`mt-0.5 text-[13px] font-medium text-slate-900`}>
                      {item.staff} thông báo bếp {item.priority ? ' (ƯU TIÊN)' : ''}
                    </Text>
                    {!!item.note && (
                      <Text style={tw`mt-0.5 text-[12px] text-slate-600`}>
                        Ghi chú: {item.note}
                      </Text>
                    )}
                  </View>

                  <View style={tw`border-t border-slate-100 px-3 py-2`}>
                    {item.items.map((it, idx) => (
                      <View
                        key={`${it.menuItemId}-${idx}`}
                        style={tw`flex-row items-center gap-2 mb-0.5`}
                      >
                        <Text style={tw`text-[11px] text-slate-400`}>•</Text>
                        <Text style={tw`text-[13px] text-slate-800`}>
                          + {it.qty} {it.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
