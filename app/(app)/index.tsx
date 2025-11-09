import { useTableSocketLive } from '@hooks/socket/socket/useTableSocketLive';
import { useAreas } from '@hooks/useArea';
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { useAuth } from '@providers/AuthProvider';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import SideDrawer from '../../src/components/drawer/SideDrawer';
import HeaderBar from '../../src/components/table/HeaderBar';
import { fmtElapsed, fmtMoney, stripVN } from '../../src/lib/heplers/TableHelper';
import { TableVM } from '../../src/types/table/TableType';

type StatusTab = 'all' | 'using' | 'empty';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'using', label: 'Sử dụng' },
  { key: 'empty', label: 'Còn trống' },
];

export default function TablesScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  useTableSocketLive();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [floor, setFloor] = useState('Tất cả');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const areasQ = useAreas();
  const { orders, activeOrdersQuery, amountByTable } = useOrders();

  const areas = areasQ.data ?? [];

  const floorOptions = useMemo(
    () => ['Tất cả', ...Array.from(new Set((areas ?? []).map((a: any) => a.name)))],
    [areas],
  );

  const orderCreatedAt = useMemo<Record<string, string | undefined>>(() => {
    const rows: any[] = activeOrdersQuery?.data ?? [];
    const dict: Record<string, string> = {};
    for (const o of rows) {
      const tid = o.table?.id ?? o.tableId;
      if (tid) dict[tid] = o.createdAt as string;
    }
    return dict;
  }, [activeOrdersQuery?.data]);

  const tables = useMemo<TableVM[]>(() => {
    const list: TableVM[] = [];
    for (const a of areas ?? []) {
      for (const t of a.tables ?? []) {
        const using = !!orders[t.id];
        list.push({
          id: t.id,
          name: t.name,
          floor: a.name,
          status: using ? 'using' : 'empty',
          amount: using ? (amountByTable[t.id] ?? 0) : 0,
          startedAt: orderCreatedAt[t.id],
        });
      }
    }
    return list;
  }, [areas, orders, orderCreatedAt, amountByTable]);

  const filtered = useMemo(() => {
    const kw = stripVN(q.trim().toLowerCase());
    return tables.filter((t) => {
      const okFloor = floor === 'Tất cả' || t.floor === floor;
      const okStatus =
        statusTab === 'all' ? true : statusTab === 'using' ? t.status === 'using' : t.status === 'empty';
      const okKeyword =
        !kw ||
        stripVN(t.name.toLowerCase()).includes(kw) ||
        stripVN((t.floor ?? '').toLowerCase()).includes(kw);
      return okFloor && okStatus && okKeyword;
    });
  }, [tables, floor, statusTab, q]);

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
      <Pressable onPress={() => goTable(item)} style={tw`m-2 w-[46%] rounded-2xl border ${border} ${bg} px-4 py-4`}>
        <Text style={tw`text-base font-bold text-slate-900`}>{item.name}</Text>
        {using ? (
          <>
            <Text style={tw`mt-2 text-slate-500`}>{fmtElapsed(item.startedAt)}</Text>
            <Text style={tw`mt-1 text-blue-600 font-semibold`}>{fmtMoney(item.amount ?? 0)}</Text>
          </>
        ) : (
          <Text style={tw`mt-2 text-slate-400`}>Trống</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={tw`flex-1 bg-white mt-10`}>
      <HeaderBar
        onMenu={() => setDrawerOpen(true)}
        searchValue={q}
        onChangeSearch={setQ}
        onClearSearch={() => setQ('')}
        showActions={false}
      />

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
        keyboardShouldPersistTaps="handled"
      />

      {areasQ.isLoading && (
        <View style={tw`absolute inset-0 items-center justify-center bg-white/60`}>
          <ActivityIndicator />
        </View>
      )}

      <SideDrawer
        open={drawerOpen}
        name="Thu ngân"
        onClose={() => setDrawerOpen(false)}
        onLogout={async () => {
          setDrawerOpen(false);
          await logout();
        }}
      />
    </View>
  );
}
