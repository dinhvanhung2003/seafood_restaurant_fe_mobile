import { Feather } from '@expo/vector-icons';
import { useMenu } from '@hooks/useMenu';
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { stripVN } from '../../../src/lib/heplers/TableHelper';

type MenuRow = { id: string; name: string; image?: string; price: number };

export default function TableMenuScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const [page] = useState(1);
  const [limit] = useState(200);
  const [search, setSearch] = useState('');
  const [categoryId] = useState('all');

  const menuQ = useMenu({ page, limit, search, categoryId });
  const { orders, addOne, changeQty } = useOrders();

  const activeItems = orders[tableId as string]?.orders?.[0]?.items ?? [];
  const countInCart = activeItems.reduce((s: number, it: any) => s + it.qty, 0);

  // chỉ lấy món đang hoạt động và lọc theo keyword
  const items: MenuRow[] = useMemo(() => {
    const raw = Array.isArray(menuQ.data?.data) ? menuQ.data.data : menuQ.data ?? [];
    const keyword = stripVN(search.trim().toLowerCase());
    return raw
      .filter((r: any) => r.isAvailable)
      .filter((r: any) => {
        if (!keyword) return true;
        const name = stripVN((r.name ?? '').toLowerCase());
        return name.includes(keyword);
      })
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        price: Number(r.price ?? 0),
        image: r.image ?? r.imageUrl ?? r.photoUrl,
      }));
  }, [menuQ.data, search]);

  // chọn món (bấm item)
  const handleSelectItem = async (item: MenuRow) => {
    await addOne(tableId as string, item.id);
  };

  const renderItem = ({ item }: { item: MenuRow }) => {
    const row = activeItems.find((x: any) => x.id === item.id);
    const qty = row?.qty ?? 0;

    return (
      <Pressable
        onPress={() => handleSelectItem(item)}
        style={tw`px-4 py-3 border-b border-slate-100 bg-white active:bg-slate-50`}
      >
        <View style={tw`flex-row items-center gap-3`}>
          <Image
            source={item.image ? { uri: item.image } : undefined}
            style={tw`w-16 h-16 rounded-xl bg-slate-100`}
            contentFit="cover"
          />

          {/* Tên + Giá */}
          <View style={tw`flex-1`}>
            <Text numberOfLines={2} style={tw`text-[15px] font-semibold text-slate-900`}>
              {item.name}
            </Text>
            <Text style={tw`mt-1 text-slate-600`}>
              {item.price.toLocaleString('vi-VN')}₫
            </Text>
          </View>

          {/* Hiển thị số lượng nếu đã chọn */}
          {qty > 0 && (
            <View style={tw`flex-row items-center`}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation(); // tránh click trùng onPress cha
                  changeQty(tableId as string, item.id, -1, activeItems);
                }}
                style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
              >
                <Text style={tw`text-xl`}>−</Text>
              </Pressable>
              <Text style={tw`mx-3 w-6 text-center font-semibold`}>{qty}</Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  changeQty(tableId as string, item.id, +1, activeItems);
                }}
                style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
              >
                <Text style={tw`text-xl`}>＋</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Header có tìm kiếm */}
      <View style={tw`bg-white border-b border-slate-100 px-4 pt-12 pb-3`}>
        <View style={tw`flex-row items-center bg-slate-100 rounded-2xl px-3 h-10`}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={tw`pr-2`}>
            <Feather name="arrow-left" size={20} />
          </Pressable>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm món trong thực đơn…"
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
            style={tw`flex-1 px-1 text-[16px]`}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Feather name="x" size={18} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Danh sách món */}
      {menuQ.isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={tw`pb-28`}
          ListEmptyComponent={
            <View style={tw`py-10 items-center`}>
              <Text style={tw`text-slate-500`}>Không có món phù hợp.</Text>
            </View>
          }
        />
      )}

      {/* Thanh đáy */}
      <View style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(app)/table/order',
              params: { id: tableId as string, name },
            })
          }
          style={tw.style(
            `flex-1 h-12 rounded-xl items-center justify-center`,
            countInCart ? `bg-blue-600` : `bg-slate-300`,
          )}
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
