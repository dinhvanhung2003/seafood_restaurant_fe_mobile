import { Feather } from '@expo/vector-icons';
import { useTableSocketLive } from '@hooks/socket/socket/useTableSocketLive';
import { useAreas } from '@hooks/useArea';
import { useOrders } from '@hooks/useOrder';
import { fmtElapsed, fmtMoney, stripVN } from "@lib/heplers/TableHelper";
import tw from '@lib/tw';
import { useAuth } from '@providers/AuthProvider';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import SideDrawer from '../../src/components/drawer/SideDrawer';
import HeaderBar from '../../src/components/table/HeaderBar';
import type { WaiterCancelNotif } from '../../src/hooks/notification/useWaiterOrderCancelled';
import { useWaiterOrderCancelled } from '../../src/hooks/notification/useWaiterOrderCancelled';
import { getSocket } from '../../src/lib/socket';

import { TableVM } from '../../src/types/table/TableType';

type StatusTab = 'all' | 'using' | 'empty';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'using', label: 'Sử dụng' },
  { key: 'empty', label: 'Còn trống' },
];

export default function TablesScreen() {
  const router = useRouter();
  const {profile, logout } = useAuth();
  useTableSocketLive();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [floor, setFloor] = useState('Tất cả');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const areasQ = useAreas();
  const { orders, activeOrdersQuery, amountByTable } = useOrders();
const ownerByTable = useMemo<Record<string, string | undefined>>(() => {
  const rows: any[] = activeOrdersQuery?.data ?? [];
  const dict: Record<string, string> = {};
  for (const o of rows) {
    const tid = o.table?.id ?? o.tableId;
    const uid = o.createdBy?.id;
    if (tid && uid) dict[tid] = uid;
  }
  return dict;
}, [activeOrdersQuery?.data]);

  const areas = areasQ.data ?? [];

  const floorOptions = useMemo(
    () => ['Tất cả', ...Array.from(new Set((areas ?? []).map((a: any) => a.name)))],
    [areas],
  );
 const [notifModalOpen, setNotifModalOpen] = useState(false);
  const {
    items: cancelNotifs,
    unreadCount,
    markRead,
    markAllRead,
  } = useWaiterOrderCancelled();
  const orderCreatedAt = useMemo<Record<string, string | undefined>>(() => {
    const rows: any[] = activeOrdersQuery?.data ?? [];
    const dict: Record<string, string> = {};
    for (const o of rows) {
      const tid = o.table?.id ?? o.tableId;
      if (tid) dict[tid] = o.createdAt as string;
    }
    return dict;
  }, [activeOrdersQuery?.data]);
 const currentUserId = profile?.userId ?? null;
  const tables = useMemo<TableVM[]>(() => {
  const list: TableVM[] = [];
  for (const a of areas ?? []) {
    for (const t of a.tables ?? []) {
      const ordForTable: any = (orders as any)[t.id]; // order đang active ở bàn này
      const using = !!ordForTable;

      list.push({
        id: t.id,
        name: t.name,
        floor: a.name,
        status: using ? "using" : "empty",
        amount: using ? (amountByTable[t.id] ?? 0) : 0,
        // ƯU TIÊN lấy từ orders (trước giờ vẫn đúng),
        // nếu không có thì mới dùng createdAt từ activeOrdersQuery
        startedAt:
          (ordForTable && (ordForTable.startedAt || ordForTable.createdAt)) ??
          orderCreatedAt[t.id],
        isMine: using && ownerByTable[t.id] === currentUserId,
      });
    }
  }
  return list;
}, [
  areas,
  orders,
  amountByTable,
  ownerByTable,
  currentUserId,
  orderCreatedAt,
]);
useEffect(() => {
    if (!profile?.userId) return;

    const s = getSocket();
    const room = `waiter:${profile.userId}`;

    console.log('[waiter] join room', room);
    s.emit('room:join', room);
  }, [profile?.userId]);
  const filtered = useMemo(() => {
  const kw = stripVN(q.trim().toLowerCase());
  return tables.filter((t) => {
    const okFloor = floor === 'Tất cả' || t.floor === floor;
    const okStatus =
      statusTab === 'all'
        ? true
        : statusTab === 'using'
        ? t.status === 'using'
        : t.status === 'empty';
    const okKeyword =
      !kw ||
      stripVN(t.name.toLowerCase()).includes(kw) ||
      stripVN((t.floor ?? '').toLowerCase()).includes(kw);

    const okOwner = !onlyMine || t.isMine;   // 👈 nếu bật “Đơn của tôi” thì chỉ lấy bàn isMine

    return okFloor && okStatus && okKeyword && okOwner;
  });
}, [tables, floor, statusTab, q, onlyMine]);


  const goTable = (t: TableVM) => {
    setSelectedId(t.id);
    router.push({ pathname: '/(app)/table/[id]', params: { id: t.id, name: t.name } });
  };

 const renderTable = ({ item }: { item: TableVM }) => {
  const isSelected = selectedId === item.id;
  const using = item.status === 'using';
  const border = using ? (isSelected ? 'border-blue-500' : 'border-blue-300') : 'border-slate-200';
  const bg = using ? 'bg-blue-100' : 'bg-white';

  return (
    <Pressable
      onPress={() => goTable(item)}
      style={tw`relative m-2 w-[46%] rounded-2xl border ${border} ${bg} px-4 py-4`}  // 👈 thêm relative
    >
      {/* tick góc phải nếu là đơn của mình */}
      {item.isMine && (
        <View
          style={tw`absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 items-center justify-center`}
        >
          <Text style={tw`text-white text-xs`}>✓</Text>
        </View>
      )}

      <Text style={tw`text-base font-bold text-slate-900`}>{item.name}</Text>
    {using ? (
  <>
    <Text style={tw`mt-2 text-slate-500`}>
      {item.startedAt ? fmtElapsed(item.startedAt) : "Đang phục vụ"}
    </Text>
    <Text style={tw`mt-1 text-blue-600 font-semibold`}>
      {fmtMoney(item.amount ?? 0)}
    </Text>
  </>
) : (
  <Text style={tw`mt-2 text-slate-400`}>Trống</Text>
)}

    </Pressable>
  );
};


  return (
    <View style={tw`flex-1 bg-white mt-10`}>
    <View style={tw`relative`}>
        <HeaderBar
          onMenu={() => setDrawerOpen(true)}
          searchValue={q}
          onChangeSearch={setQ}
          onClearSearch={() => setQ('')}
          showActions={false}
        />

        <Pressable
          onPress={() => setNotifModalOpen(true)}
          hitSlop={10}
          style={tw`absolute right-4 top-3 flex-row items-center`}
        >
          <Feather name="bell" size={20} color="#0f172a" />
          {!!unreadCount && (
            <View
              style={tw`-ml-2 -mt-2 w-4 h-4 rounded-full bg-red-500 items-center justify-center`}
            >
              <Text style={tw`text-[9px] text-white font-bold`}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={tw`pt-3 pb-2 px-4`}>
        <Text style={tw`text-xl font-extrabold text-slate-900`}>Phòng bàn</Text>
      </View>

      {/* Tabs */}
      <View style={tw`px-4`}>
        <View style={tw`flex-row gap-3 mb-3`}>
          {TABS.map(({ key, label }) => {
            const active = statusTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setStatusTab(key)}
                style={tw.style('px-4 h-9 rounded-full items-center justify-center', active ? 'bg-blue-600' : 'bg-slate-100')}
              >
                <Text style={tw`${active ? 'text-white' : 'text-slate-700'} font-medium`}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
{/* Filter "Đơn của tôi" */}
<View style={tw`px-4 mb-2`}>
  <Pressable
    onPress={() => setOnlyMine((v) => !v)}
    style={tw.style(
      'self-start flex-row items-center px-3 h-8 rounded-full border',
      onlyMine ? 'bg-green-50 border-green-400' : 'bg-white border-slate-200'
    )}
  >
    <Text style={tw`${onlyMine ? 'text-green-700' : 'text-slate-700'} text-sm font-medium`}>
      Đơn của tôi
    </Text>
    {onlyMine && (
      <Text style={tw`ml-1 text-green-700 text-sm`}>✓</Text>
    )}
  </Pressable>
</View>

      {/* Floor chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`px-4 pb-3 mb-2 gap-2`}>
        {floorOptions.map((f) => {
          const active = floor === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFloor(f)}
              style={tw.style('px-4 h-9 rounded-full items-center justify-center border', active ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200')}
            >
              <Text style={tw`${active ? 'text-blue-700' : 'text-slate-700'} font-medium`}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Quick actions */}
      <View style={tw`px-3`}>
        <View style={tw`flex-row`}>
          {/* <Pressable style={tw`flex-1 m-2 rounded-2xl border border-slate-200 bg-white px-4 py-6`}>
            <Text style={tw`text-base font-semibold`}>🧺  Mang về</Text>
          </Pressable>
          <Pressable style={tw`flex-1 m-2 rounded-2xl border border-slate-200 bg-white px-4 py-6`}>
            <Text style={tw`text-base font-semibold`}>🚚  Giao đi</Text>
          </Pressable> */}
        </View>
      </View>

      {/* Grid */}
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        numColumns={2}
        renderItem={renderTable}
        contentContainerStyle={tw`px-1 pb-8`}
        ListEmptyComponent={
          <View style={tw`mt-10 items-center`}>
            <Text style={tw`text-slate-500`}>Không có bàn phù hợp.</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />

      {areasQ.isLoading && (
        <View style={tw`absolute inset-0 items-center justify-center bg-white/60`}>
          <ActivityIndicator />
        </View>
      )}

    <SideDrawer
  open={drawerOpen}
  name={profile?.displayName}
  tableId={selectedId ?? undefined}
  onClose={() => setDrawerOpen(false)}
  onLogout={logout}
/>
<WaiterCancelNotifModal
        visible={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
        data={cancelNotifs}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
      />
    </View>
  );
}
function WaiterCancelNotifModal({
  visible,
  onClose,
  data,
  onMarkRead,
  onMarkAllRead,
}: {
  visible: boolean;
  onClose: () => void;
  data: WaiterCancelNotif[];
  onMarkRead: (id: string) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 bg-black/40 justify-center px-6`}>
        <View style={tw`rounded-2xl bg-white p-4 max-h-[80%]`}>
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={tw`text-base font-semibold`}>Thông báo huỷ từ bếp</Text>
            <Pressable onPress={onClose}>
              <Text style={tw`text-slate-600`}>Đóng</Text>
            </Pressable>
          </View>

          <FlatList
            data={data}
            keyExtractor={it => it.id}
            ListEmptyComponent={
              <View style={tw`py-4 items-center`}>
                <Text style={tw`text-slate-500 text-sm`}>Chưa có thông báo.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onMarkRead(item.id)}
                style={tw`mb-2 p-3 rounded-xl border border-slate-200 ${
                  !item.read ? 'bg-amber-50' : 'bg-white'
                }`}
              >
                <View style={tw`flex-row justify-between mb-1`}>
                  <Text style={tw`text-[13px] text-slate-500`}>
                    {item.tableName ? `Bàn ${item.tableName}` : 'Không rõ bàn'}
                  </Text>
                  <Text style={tw`text-[11px] text-slate-400`}>
                    {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <Text style={tw`text-[14px] font-semibold mb-1`}>{item.title}</Text>
                <Text style={tw`text-[13px] text-slate-700`}>{item.message}</Text>

                {/* {!!item.reason && (
                  <Text style={tw`mt-1 text-[12px] text-slate-500`}>
                    Lý do: {item.reason}
                  </Text>
                )} */}
              </Pressable>
            )}
          />

          {!!data.length && (
            <View style={tw`mt-2 flex-row justify-between`}>
              <Pressable onPress={onMarkAllRead}>
                <Text style={tw`text-blue-600 text-sm font-semibold`}>
                  Đánh dấu tất cả đã đọc
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}