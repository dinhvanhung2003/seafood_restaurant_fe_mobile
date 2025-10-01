import { useMenu } from '@hooks/useMenu'; // để lấy name/price/image
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

type Meta = { id: string; name: string; price: number; image?: string };

export default function OrderScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();

  // Lấy đơn hiện tại
  const { orders, changeQty, confirm } = useOrders();
  const items = orders[tableId as string]?.orders?.[0]?.items ?? [];

  // Lấy meta món (name/price/image) – đơn giản nhất: fetch 1 list đủ lớn
  const menuQ = useMenu({ page: 1, limit: 500, search: '', categoryId: 'all' });
  const menuMap = useMemo(() => {
    const raw = Array.isArray(menuQ.data?.data) ? menuQ.data.data : (menuQ.data ?? []);
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

  const total = useMemo(() => {
    return items.reduce((s, it) => s + (menuMap.get(it.id)?.price ?? 0) * it.qty, 0);
  }, [items, menuMap]);

  const renderItem = ({ item }: { item: { id: string; qty: number; rowId?: string } }) => {
    const meta = menuMap.get(item.id);
    const displayName = meta?.name ?? item.id.slice(0, 6);
    const price = meta?.price ?? 0;

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
            <Text style={tw`mt-1 text-slate-600`}>
              {(price).toLocaleString('vi-VN')}
            </Text>
          </View>

          {/* cụm số lượng */}
          <View style={tw`flex-row items-center`}>
            <Pressable
              onPress={() => changeQty(tableId as string, item.id, -1, items)}
              style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
            >
              <Text style={tw`text-xl`}>−</Text>
            </Pressable>
            <Text style={tw`mx-3 w-6 text-center font-semibold`}>{item.qty}</Text>
            <Pressable
              onPress={() => changeQty(tableId as string, item.id, +1, items)}
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
        <Text style={tw`text-base font-bold`}>{name ? `Bàn ${name}` : 'Đơn'}</Text>
        <Pressable>
          <Text style={tw`text-xl`}>⋯</Text>
        </Pressable>
      </View>

      {/* Chips (decor) */}
      <View style={tw`px-3 py-2 flex-row flex-wrap gap-2`}>
        <Chip label="Khách lẻ" />
        <Chip label="Ghi chú" />
        <Chip label="Khách đến" />
      </View>

      {/* Danh sách món trong đơn */}
      <FlatList
        data={items}
        keyExtractor={(x) => x.rowId ?? `${x.id}`}
        renderItem={renderItem}
        contentContainerStyle={tw`pb-28`}
      />

      {/* Nút nổi “+” quay lại menu để thêm món */}
      <Pressable
        onPress={() => router.push({ pathname: '/(app)/table/[id]', params: { id: tableId as string, name } })}
        style={tw`absolute right-5 bottom-24 h-14 w-14 rounded-full bg-blue-600 items-center justify-center shadow`}
      >
        <Text style={tw`text-white text-2xl`}>＋</Text>
      </Pressable>

      {/* Thanh đáy */}
      <View style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}>
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text style={tw`text-slate-600`}>Tổng tiền</Text>
          <Text style={tw`text-[16px] font-bold`}>{total.toLocaleString('vi-VN')}</Text>
        </View>

        <View style={tw`flex-row gap-3`}>
          <Pressable
            onPress={() => confirm(tableId as string)}
            style={tw`flex-1 h-12 rounded-xl border border-blue-600 items-center justify-center`}
          >
            <Text style={tw`text-blue-600 font-bold`}>Thông báo</Text>
          </Pressable>
          <Pressable
            style={tw`flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center`}
            onPress={() => router.push({ pathname: '/(app)/table/checkout', params: { tableId: tableId as string, name, total: String(total) } })}
          >
            <Text style={tw`text-white font-bold`}>Thanh toán</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Chip nhỏ như bản thiết kế */
function Chip({ label }: { label: string }) {
  return (
    <View style={tw`px-3 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center`}>
      <Text style={tw`text-slate-700`}>{label}</Text>
    </View>
  );
}
