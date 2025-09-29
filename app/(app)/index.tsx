// app/(app)/index.tsx
import { useAreas } from '@hooks/useArea';
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

type TableVM = {
  id: string;
  name: string;
  floor: string;
  status: 'using' | 'empty';
  amount: number;         // tổng tiền hiện tại
  startedAt?: string;     // thời điểm tạo đơn (để hiển thị “xg yp”)
};

function timeAgoShort(iso?: string) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}p`;
  return `${h}g ${mm}p`;
}

export default function HomeScreen() {
  const router = useRouter();
  const areasQ = useAreas();
  const { activeOrdersQuery, orders, orderIds } = useOrders();

  const floors = useMemo(
    () => ['Tất cả', ...new Set((areasQ.data ?? []).map(a => a.name))],
    [areasQ.data]
  );
  const [floor, setFloor] = useState<string>('Tất cả');

  // map Areas -> TableVM và hợp nhất trạng thái đơn hàng
  const tables: TableVM[] = useMemo(() => {
    const base: TableVM[] = [];
    for (const a of areasQ.data ?? []) {
      for (const t of a.tables ?? []) {
        const hasOrder = !!orders[t.id];
        // tổng tiền đơn hiện tại
        const items = orders[t.id]?.orders[0]?.items ?? [];
        const totalQty = items.reduce((s, it) => s + it.qty, 0);
        const amount =
          (activeOrdersQuery.data ?? [])
            .find((o: any) => o.id === orderIds[t.id])
            ?.items?.reduce(
              (sum: number, it: any) =>
                sum + (Number(it?.menuItem?.price ?? it?.price ?? 0) * Number(it?.quantity ?? 0)),
              0
            ) ?? 0;

        // giờ bắt đầu
        const startedAt = (activeOrdersQuery.data ?? [])
          .find((o: any) => o.id === orderIds[t.id])?.createdAt as string | undefined;

        base.push({
          id: t.id,
          name: t.name,
          floor: a.name,
          status: hasOrder ? 'using' : 'empty',
          amount: amount || totalQty ? amount : 0,
          startedAt,
        });
      }
    }
    // lọc theo tầng
    return base.filter(b => floor === 'Tất cả' || b.floor === floor);
  }, [areasQ.data, orders, orderIds, activeOrdersQuery.data, floor]);

  if (areasQ.isLoading || activeOrdersQuery.isLoading) {
    return (
      <View style={tw`flex-1 items-center justify-center`}>
        <ActivityIndicator />
        <Text style={tw`mt-2 text-slate-500`}>Đang tải…</Text>
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-white`}>
      {/* Header đơn giản */}
      <View style={tw`px-4 pt-4 pb-2`}>
        <Text style={tw`text-xl font-extrabold text-slate-900`}>Phòng bàn</Text>
      </View>

      {/* Tabs tầng/khu */}
      <FlatList
        data={floors}
        keyExtractor={(s) => s}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tw`px-3`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setFloor(item)}
            style={tw.style(
              `px-4 h-9 mr-2 rounded-full border`,
              floor === item ? `bg-blue-50 border-blue-500` : `bg-white border-slate-200`
            )}
          >
            <Text style={tw.style(`text-sm leading-9`,
              floor === item ? `text-blue-600 font-bold` : `text-slate-700`
            )}>
              {item}
            </Text>
          </Pressable>
        )}
      />

      {/* Lưới bàn */}
      <FlatList
        data={tables}
        keyExtractor={(t) => t.id}
        numColumns={2}
        contentContainerStyle={tw`p-3 pb-6`}
        columnWrapperStyle={tw`mb-3`}
        renderItem={({ item }) => {
          const using = item.status === 'using';
          return (
            <Pressable
              // onPress={() => router.push({ pathname: '/(app)/order', params: { tableId: item.id } })}
              style={tw.style(
                `flex-1 mr-3 rounded-2xl p-4 border`,
                using ? `bg-blue-50 border-blue-300` : `bg-white border-slate-200`
              )}
            >
              <Text style={tw`text-base font-bold text-slate-900`} numberOfLines={1}>
                {item.name}
              </Text>

              {using ? (
                <>
                  <Text style={tw`text-[11px] text-slate-500 mt-2`}>{timeAgoShort(item.startedAt)}</Text>
                  <Text style={tw`mt-1 text-blue-700 font-extrabold`}>{item.amount.toLocaleString('vi-VN')}</Text>
                </>
              ) : (
                <Text style={tw`mt-2 text-slate-400`}>Trống</Text>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={tw`px-4 py-8 items-center`}>
            <Text style={tw`text-slate-500`}>Chưa có dữ liệu bàn</Text>
          </View>
        }
      />
    </View>
  );
}
