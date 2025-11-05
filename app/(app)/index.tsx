import HeaderBar from '@components/HeaderBar';
import { useAreas } from '@hooks/useArea';
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { useAuth } from '@providers/AuthProvider';
import { useRouter } from 'expo-router';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';



type TableVM = {
  id: string;
  name: string;
  floor?: string;
  status: 'using' | 'empty';
  amount: number;
  startedAt?: string;
};

const fmtMoney = (n: number) => {
  try {
    return n.toLocaleString('vi-VN');
  } catch {
    return String(n);
  }
};

const minutesBetween = (iso?: string) => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  const diff = Date.now() - (isNaN(t) ? 0 : t);
  return Math.max(0, Math.round(diff / 60000));
};

const fmtElapsed = (iso?: string) => {
  const m = minutesBetween(iso);
  const h = Math.floor(m / 60),
    mm = m % 60;
  if (h <= 0 && mm <= 0) return '';
  if (h <= 0) return `${mm}p`;
  return `${h}g ${mm}p`;
};

export default function TablesScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  // gọi hook ở top-level
  const areasQ = useAreas();
  const { orders, activeOrdersQuery } = useOrders();

  const [statusTab, setStatusTab] = useState<'all' | 'using' | 'empty'>('all');
  const [floor, setFloor] = useState<string>('Tất cả');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const areas = areasQ.data ?? [];

  const floorOptions = useMemo(
    () => ['Tất cả', ...Array.from(new Set((areas ?? []).map((a: any) => a.name)))],
    [areas]
  );

  const orderCreatedAt: Record<string, string | undefined> = useMemo(() => {
    const rows: any[] = activeOrdersQuery?.data ?? [];
    const dict: Record<string, string> = {};
    for (const o of rows) {
      const tid = o.table?.id ?? o.tableId;
      if (tid) dict[tid] = o.createdAt as string;
    }
    return dict;
  }, [activeOrdersQuery?.data]);

  const tables: TableVM[] = useMemo(() => {
    const list: TableVM[] = [];
    for (const a of areas ?? []) {
      for (const t of a.tables ?? []) {
        const isUsing = !!orders[t.id];
        const amount = 0; // TODO: nếu có tổng tiền, thay đổi ở đây
        list.push({
          id: t.id,
          name: t.name,
          floor: a.name,
          status: isUsing ? 'using' : 'empty',
          amount,
          startedAt: orderCreatedAt[t.id],
        });
      }
    }
    return list;
  }, [areas, orders, orderCreatedAt]);

  const filtered = useMemo(() => {
    return tables.filter((t) => {
      const okFloor = floor === 'Tất cả' ? true : t.floor === floor;
      const okStatus =
        statusTab === 'all'
          ? true
          : statusTab === 'using'
          ? t.status === 'using'
          : t.status === 'empty';
      return okFloor && okStatus;
    });
  }, [tables, floor, statusTab]);

  const renderTable = ({ item }: { item: TableVM }) => {
    const isSelected = selectedId === item.id;
    const isUsing = item.status === 'using';
    const border = isUsing ? (isSelected ? 'border-blue-500' : 'border-blue-300') : 'border-slate-200';
    const bg = isUsing ? 'bg-blue-100' : 'bg-white';

    return (
      <Pressable
        onPress={() => {
          setSelectedId(item.id);
          router.push({ pathname: '/(app)/table/[id]', params: { id: item.id, name: item.name } });
        }}
        style={tw`m-2 w-[46%] rounded-2xl border ${border} ${bg} px-4 py-4`}
      >
        <Text style={tw`text-base font-bold text-slate-900`}>{item.name}</Text>
        {isUsing ? (
          <>
            <Text style={tw`mt-2 text-slate-500`}>{fmtElapsed(item.startedAt)}</Text>
            <Text style={tw`mt-1 text-blue-600 font-semibold`}>{fmtMoney(item.amount)}</Text>
          </>
        ) : (
          <Text style={tw`mt-2 text-slate-400`}>Trống</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={tw`flex-1 bg-white mt-10`}>
      {/* Header */}
      <HeaderBar onMenu={() => setDrawerOpen(true)} onSearch={() => {}} onNotify={() => {}} onOrders={() => {}} />

      <View style={tw`pt-3 pb-2 px-4`}>
        <Text style={tw`text-xl font-extrabold text-slate-900`}>Phòng bàn</Text>
      </View>

      {/* Tabs */}
      <View style={tw`px-4`}>
        <View style={tw`flex-row gap-3 mb-3`}>
          {([
            { key: 'all', label: 'Tất cả' },
            { key: 'using', label: 'Sử dụng' },
            { key: 'empty', label: 'Còn trống' },
          ] as const).map((t) => {
            const active = statusTab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setStatusTab(t.key)}
                style={tw.style(
                  'px-4 h-9 rounded-full items-center justify-center',
                  active ? 'bg-blue-600' : 'bg-slate-100'
                )}
              >
                <Text style={tw`${active ? 'text-white' : 'text-slate-700'} font-medium`}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Floor chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`px-4 pb-3 mb-2 gap-2`}>
        {floorOptions.map((f) => {
          const active = floor === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFloor(f)}
              style={tw.style(
                'px-4 h-9 rounded-full items-center justify-center border',
                active ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'
              )}
            >
              <Text style={tw`${active ? 'text-blue-700' : 'text-slate-700'} font-medium`}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Mang về / Giao đi */}
      <View style={tw`px-3`}>
        <View style={tw`flex-row`}>
          <Pressable style={tw`flex-1 m-2 rounded-2xl border border-slate-200 bg-white px-4 py-6`}>
            <Text style={tw`text-base font-semibold`}>🧺  Mang về</Text>
          </Pressable>
          <Pressable style={tw`flex-1 m-2 rounded-2xl border border-slate-200 bg-white px-4 py-6`}>
            <Text style={tw`text-base font-semibold`}>🚚  Giao đi</Text>
          </Pressable>
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
      />

      {/* Loading overlay */}
      {areasQ.isLoading && (
        <View style={tw`absolute inset-0 items-center justify-center bg-white/60`}>
          <ActivityIndicator />
        </View>
      )}

      <SideDrawer
        open={drawerOpen}
        name={'Thu ngân'}
        onClose={() => setDrawerOpen(false)}
        onLogout={async () => {
          setDrawerOpen(false);
          await logout();
        }}
      />
    </View>
  );
}

function SideDrawer({
  open,
  name,
  onClose,
  onLogout,
}: {
  open: boolean;
  name?: string;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}) {
  const slide = useRef(new Animated.Value(0)).current; // 0: đóng, 1: mở
  const router = useRouter();

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open]);

  const WIDTH = 280;
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH, 0] });
  const overlayOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <>
      {/* Overlay tap để đóng */}
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[tw`absolute inset-0 bg-black`, { opacity: overlayOpacity }]}>
        <Pressable style={tw`flex-1`} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[tw`absolute top-0 bottom-0 left-0 bg-white shadow-lg`, { width: WIDTH, transform: [{ translateX }] }]}>
        <View style={tw`pt-12 pb-4 px-4 border-b border-slate-100`}>
          <Text style={tw`text-xl font-extrabold text-slate-900`}>Seafood POS</Text>
          <Text style={tw`mt-1 text-slate-600`}>{name ?? 'Nhân viên'}</Text>
        </View>

        <View style={tw`px-2 py-3`}>
          <DrawerItem label="Trang chủ" onPress={onClose} />
          <DrawerItem label="Đơn hiện tại" onPress={onClose} />
          <DrawerItem label="Cài đặt" onPress={onClose} />

         <DrawerItem
  label="Chấm công"
  onPress={() => {
    onClose();
router.push({ pathname: '/(app)/profile/atttendance' } as never);

  }}
/>
<DrawerItem
  label="Bảng chấm công"
  onPress={() => {
    onClose();
    router.push({ pathname: "/(app)/profile/atttendance/list" } as never);
  }}
/>
<DrawerItem
  label="Đăng ký khuôn mặt"
  onPress={() => {
    onClose();
    router.push({ pathname: "/(app)/profile/face" } as never);
  }}
/>
          <DrawerItem label="Đổi mật khẩu" onPress={onClose} />
          <DrawerItem label="Đăng xuất" onPress={onLogout} />
        </View>
      </Animated.View>

    </>
  );
}

function DrawerItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={tw`flex-row items-center h-12 px-3 rounded-lg active:bg-slate-100`}>
      <Text style={tw`text-[15px] text-slate-800`}>{label}</Text>
    </Pressable>
  );
}
