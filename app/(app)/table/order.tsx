import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

export default function OrderScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const { orders, changeQty, confirm } = useOrders();

  const items = orders[tableId as string]?.orders?.[0]?.items ?? [];
  const total = 0; // nếu cần tính tiền, ghép giá như web

  return (
    <View style={tw`flex-1 bg-white`}>
      <View style={tw`px-4 py-3 border-b border-slate-100 flex-row items-center justify-between`}>
        <Pressable onPress={() => router.back()}><Text style={tw`text-xl`}>‹</Text></Pressable>
        <Text style={tw`text-base font-bold`}>Đơn: {name ? `Bàn ${name}` : tableId}</Text>
        <View style={tw`w-6`} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(x) => x.rowId ?? `${x.id}`}
        renderItem={({ item }) => (
          <View style={tw`px-4 py-3 border-b border-slate-100 flex-row items-center justify-between`}>
            <Text style={tw`flex-1 mr-2`}>{item.id}</Text>
            <View style={tw`flex-row items-center`}>
              <Pressable onPress={() => changeQty(tableId as string, item.id, -1, items)} style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}>
                <Text style={tw`text-xl`}>−</Text>
              </Pressable>
              <Text style={tw`mx-3 w-6 text-center font-semibold`}>{item.qty}</Text>
              <Pressable onPress={() => changeQty(tableId as string, item.id, +1, items)} style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}>
                <Text style={tw`text-xl`}>＋</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={tw`pb-24`}
      />

      <View style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}>
        <View style={tw`flex-row gap-3`}>
          <Pressable onPress={() => confirm(tableId as string)} style={tw`flex-1 h-12 rounded-xl border border-blue-600 items-center justify-center`}>
            <Text style={tw`text-blue-600 font-bold`}>Thông báo</Text>
          </Pressable>
          <Pressable style={tw`flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center`}>
            <Text style={tw`text-white font-bold`}>Thanh toán</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
