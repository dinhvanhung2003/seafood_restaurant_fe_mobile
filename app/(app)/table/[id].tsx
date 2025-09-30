import { useMenu } from '@hooks/useMenu';
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { Image } from 'expo-image'; // <— ảnh mượt + cache
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

type MenuRow = { id: string; name: string; image?: string; price: number };

export default function TableMenuScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const [page] = useState(1);
  const [limit] = useState(30);
  const [search] = useState('');
  const [categoryId] = useState('all');

  const menuQ = useMenu({ page, limit, search, categoryId });
  const { orders, addOne, changeQty } = useOrders();

  const activeItems = orders[tableId as string]?.orders?.[0]?.items ?? [];
  const countInCart = activeItems.reduce((s: number, it: any) => s + it.qty, 0);

  const items: MenuRow[] = useMemo(() => {
    const raw = Array.isArray(menuQ.data?.data) ? menuQ.data.data : (menuQ.data ?? []);
    return raw.map((r: any) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price ?? 0),                 // "30000.00" -> 30000
      image: r.image ?? r.imageUrl ?? r.photoUrl,  // field nào có thì dùng
    }));
  }, [menuQ.data]);

  const renderItem = ({ item }: { item: MenuRow }) => {
    const row = activeItems.find((x: any) => x.id === item.id);
    const qty = row?.qty ?? 0;

    return (
      <View style={tw`px-4 py-3 border-b border-slate-100 bg-white`}>
        <View style={tw`flex-row items-center gap-3`}>
          {/* thumbnail */}
          <Image
            source={item.image ? { uri: item.image } : undefined}
            style={tw`w-16 h-16 rounded-xl bg-slate-100`}
            contentFit="cover"
            // placeholder mờ (tùy chọn):
            // placeholder={blurhash}
            transition={150}
          />

          {/* tên + giá */}
          <View style={tw`flex-1`}>
            <Text numberOfLines={2} style={tw`text-[15px] font-semibold text-slate-900`}>
              {item.name}
            </Text>
            <Text style={tw`mt-1 text-slate-600`}>{item.price.toLocaleString('vi-VN')}</Text>
          </View>

          {/* nút + / - */}
          {qty === 0 ? (
            <Pressable
              onPress={() => addOne(tableId as string, item.id)}
              style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
            >
              <Text style={tw`text-xl`}>＋</Text>
            </Pressable>
          ) : (
            <View style={tw`flex-row items-center`}>
              <Pressable
                onPress={() => changeQty(tableId as string, item.id, -1, activeItems)}
                style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
              >
                <Text style={tw`text-xl`}>−</Text>
              </Pressable>
              <Text style={tw`mx-3 w-6 text-center font-semibold`}>{qty}</Text>
              <Pressable
                onPress={() => changeQty(tableId as string, item.id, +1, activeItems)}
                style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
              >
                <Text style={tw`text-xl`}>＋</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Header */}
      <View style={tw`px-4 py-3 bg-white border-b border-slate-100 flex-row items-center justify-between`}>
        <Pressable onPress={() => router.back()}><Text style={tw`text-xl`}>‹</Text></Pressable>
        <Text style={tw`text-base font-bold`}>{name ? `Bàn ${name}` : 'Bàn'}</Text>
        <View style={tw`w-6`} />
      </View>

      {/* List */}
      {menuQ.isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={tw`pb-28`}
        />
      )}

      {/* Bottom bar */}
      <View style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}>
        <Pressable
          onPress={() => router.push({ pathname: '/(app)/table/order', params: { id: tableId as string, name } })}
          style={tw.style(`flex-1 h-12 rounded-xl items-center justify-center`, countInCart ? `bg-blue-600` : `bg-slate-300`)}
          disabled={countInCart === 0}
        >
          <Text style={tw`text-white font-bold`}>
            {countInCart === 0 ? 'Chọn món' : `Xem đơn (${countInCart})`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
