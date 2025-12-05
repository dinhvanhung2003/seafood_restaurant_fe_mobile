import { Feather } from '@expo/vector-icons';
import { useKitchenFlow } from '@hooks/notification/useKitchenFlow';
import { useMenu } from '@hooks/useMenu';
import { useOrders } from '@hooks/useOrder';
import tw from '@lib/tw';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { stripVN } from '../../../src/lib/heplers/TableHelper';

type MenuRow = {
  id: string;
  name: string;
  image?: string;
  price: number;
  finalPrice: number;
  discountAmount: number;
  pct: number;
  hasPromo: boolean;
  badge?: string | null;
};

type Category = {
  id: string;
  name: string;
};

export default function TableMenuScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();

  const [page] = useState(1);
  const [limit] = useState(200);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<'all' | string>('all');

  const menuQ = useMenu({
    page,
    limit,
    search: '',
    categoryId: 'all',
  });

  const { orders } = useOrders();

  // chỉ dùng onChangeQty + setCancelOneOpen
  const { onChangeQty, setCancelOneOpen } = useKitchenFlow(tableId as string);

  // cleanup: khi rời màn này thì đóng state popup huỷ món (nếu có)
 useEffect(() => {
  // vào màn: tắt luôn nếu đang mở từ màn trước
  setCancelOneOpen(false);

  // rời màn: tắt thêm 1 lần cho chắc
  return () => {
    setCancelOneOpen(false);
  };
}, [setCancelOneOpen]);

  const activeItems = orders[tableId as string]?.orders?.[0]?.items ?? [];
  const countInCart = activeItems.reduce((s: number, it: any) => s + it.qty, 0);

  const rawMenu: any[] = useMemo(() => {
    return Array.isArray(menuQ.data?.data) ? menuQ.data.data : menuQ.data ?? [];
  }, [menuQ.data]);

  const categories: Category[] = useMemo(() => {
    const map = new Map<string, string>();

    for (const r of rawMenu) {
      const cid = r.categoryId ?? r.category?.id;
      const cname = r.categoryName ?? r.category?.name;

      if (cid && cname && !map.has(cid)) {
        map.set(cid, cname);
      }
    }

    return [
      { id: 'all', name: 'Tất cả' },
      ...Array.from(map.entries()).map(([id, name]) => ({ id, name })),
    ];
  }, [rawMenu]);

  const items: MenuRow[] = useMemo(() => {
    const keyword = stripVN(search.trim().toLowerCase());

    return rawMenu
      .filter((r: any) => r.isAvailable)
      .filter((r: any) => {
        if (categoryId === 'all') return true;
        const rCatId = r.categoryId ?? r.category?.id;
        return rCatId === categoryId;
      })
      .filter((r: any) => {
        if (!keyword) return true;
        const name = stripVN((r.name ?? '').toLowerCase());
        return name.includes(keyword);
      })
      .map((r: any) => {
        const discountAmount = Number(r.discountAmount ?? NaN);
        const hasPromo = Number.isFinite(discountAmount) && discountAmount > 0;

        const origin = Number(r.price ?? 0) || 0;
        const priceAfterDiscountRaw = Number(r.priceAfterDiscount ?? NaN);

        const finalPrice =
          hasPromo && Number.isFinite(priceAfterDiscountRaw)
            ? priceAfterDiscountRaw
            : origin;

        const pct =
          hasPromo && origin > 0
            ? Math.min(100, Math.round((discountAmount / origin) * 100))
            : 0;

        const badge =
          hasPromo && typeof r.badge === 'string' && r.badge.trim().length > 0
            ? r.badge.trim()
            : null;

        return {
          id: r.id,
          name: r.name,
          image: r.image ?? r.imageUrl ?? r.photoUrl,
          price: origin,
          finalPrice,
          discountAmount: hasPromo ? discountAmount : 0,
          pct,
          hasPromo,
          badge,
        } as MenuRow;
      });
  }, [rawMenu, search, categoryId]);

  const handleSelectItem = async (item: MenuRow) => {
    await onChangeQty(item.id, +1, item.name);
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
          <View style={tw`w-16 h-16 rounded-xl bg-slate-100 overflow-hidden relative`}>
            <Image
              source={item.image ? { uri: item.image } : undefined}
              style={tw`w-full h-full`}
              contentFit="cover"
            />

            {item.hasPromo && (
              <View style={tw`absolute left-0 top-0 rounded-br-md bg-emerald-600 px-1.5 py-0.5`}>
                <Text style={tw`text-[10px] font-semibold text-white`}>
                  {item.badge ?? `-${item.discountAmount.toLocaleString('vi-VN')}đ`}
                </Text>
              </View>
            )}
          </View>

          <View style={tw`flex-1`}>
            <Text numberOfLines={2} style={tw`text-[15px] font-semibold text-slate-900`}>
              {item.name}
            </Text>

            {item.hasPromo ? (
              <View style={tw`mt-1`}>
                <Text style={tw`text-[12px] text-slate-400 line-through`}>
                  {item.price.toLocaleString('vi-VN')}₫
                </Text>
                <Text style={tw`text-[15px] font-bold text-emerald-700`}>
                  {item.finalPrice.toLocaleString('vi-VN')}₫
                </Text>
                <Text style={tw`mt-0.5 text-[11px] text-emerald-700`}>
                  Tiết kiệm {item.pct}% ({item.discountAmount.toLocaleString('vi-VN')}đ)
                </Text>
              </View>
            ) : (
              <Text style={tw`mt-1 text-slate-600`}>
                {item.price.toLocaleString('vi-VN')}₫
              </Text>
            )}
          </View>

          {qty > 0 && (
            <View style={tw`flex-row items-center`}>
              <Pressable
                onPress={e => {
                  e.stopPropagation();
                  onChangeQty(item.id, -1, item.name);
                }}
                style={tw`h-9 w-9 rounded-full bg-slate-100 items-center justify-center`}
              >
                <Text style={tw`text-xl`}>−</Text>
              </Pressable>
              <Text style={tw`mx-3 w-6 text-center font-semibold`}>{qty}</Text>
              <Pressable
                onPress={e => {
                  e.stopPropagation();
                  onChangeQty(item.id, +1, item.name);
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

  const renderCategoryChip = ({ item }: { item: Category }) => {
    const isActive = item.id === categoryId;
    return (
      <Pressable
        onPress={() => setCategoryId(item.id as any)}
        style={tw.style(
          'px-3 py-1 rounded-full mr-2 mb-2 border',
          isActive ? 'bg-blue-600 border-blue-600' : 'bg-slate-100 border-slate-200',
        )}
      >
        <Text
          style={tw.style('text-xs font-medium', isActive ? 'text-white' : 'text-slate-700')}
        >
          {item.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Header search + category */}
      <View style={tw`bg-white border-b border-slate-100 px-4 pt-12 pb-2`}>
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

        {categories.length > 0 && (
          <FlatList
            data={categories}
            keyExtractor={c => c.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderCategoryChip}
            contentContainerStyle={tw`mt-2 pb-1`}
          />
        )}
      </View>

      {/* Danh sách món */}
      {menuQ.isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={it => it.id}
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
      <View
        style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}
      >
        <Pressable
          onPress={() => {
            setCancelOneOpen(false);

            router.push({
              pathname: '/(app)/table/order',
              params: { id: tableId as string, name },
            });
          }}
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
