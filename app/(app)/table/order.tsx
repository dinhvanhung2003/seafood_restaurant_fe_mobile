// apps/mobile/app/(app)/table/order.tsx
import { useKitchenHistory } from "@hooks/useKitchenHistory";
import { useKitchenProgress } from "@hooks/useKitchenProgress";
import { useMenu } from "@hooks/useMenu";
import { useOrders } from "@hooks/useOrder";
import tw from "@lib/tw";
import http from "@services/http";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
// import { useKitchenSocketLive } from "../../../src/hooks/socket/socket/useKitchenSocketLive";
// import { useOrderSocketLive } from "../../../src/hooks/socket/socket/useOrderSocketLive";
import { usePosSocketLive } from "../../../src/hooks/socket/socket/useSocket";
//  helper kiểm tra UUID v4
const isUuid = (s?: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s ?? "");

type Meta = { id: string; name: string; price: number; image?: string };

export default function OrderScreen() {
  const { id: tableId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // ===== Lấy đơn hiện tại của bàn =====
  // ⚠️ Lấy cả orderIds để dùng UUID từ server
  const { orders, orderIds, changeQty } = useOrders();

  const orderRow = orders[tableId as string]?.orders?.[0];
  const items: Array<{ id: string; qty: number; rowId?: string }> = orderRow?.items ?? [];

  // ✅ Dùng UUID thật từ BE
  const currentOrderId = orderIds[tableId as string];

  // ===== Meta món =====
  const menuQ = useMenu({ page: 1, limit: 500, search: "", categoryId: "all" });
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
    [items, menuMap]
  );

// socket cho các chức năng của order
// useOrderSocketLive(currentOrderId);

  // ===== Tiến độ đã báo bếp (để tính delta) =====
  const { data: progress = [] } = useKitchenProgress(currentOrderId);
  useKitchenHistory(currentOrderId);

  const notifiedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of progress) m.set(r.menuItemId, r.notified);
    return m;
  }, [progress]);

  const deltaItems = useMemo(
    () =>
      items
        .map((i) => {
          const sent = notifiedMap.get(i.id) ?? 0;
          return { menuItemId: i.id, delta: Math.max(0, i.qty - sent) };
        })
        .filter((d) => d.delta > 0),
    [items, notifiedMap]
  );

  // ✅ Chỉ cho phép gửi khi orderId là UUID hợp lệ và có delta
  const canNotify = isUuid(currentOrderId) && deltaItems.length > 0;
  const [notifying, setNotifying] = useState(false);

  // ===== Gửi bếp =====
  const onNotify = async () => {
    if (!isUuid(currentOrderId)) {
      Alert.alert("Thông báo", "Chưa có order hợp lệ cho bàn này.");
      return;
    }
    if (!canNotify || notifying) return;

    setNotifying(true);
    try {
      await http.post(`/kitchen/orders/${currentOrderId}/notify-items`, {
        items: deltaItems,            // [{ menuItemId, delta }]
        priority: true,
        tableName: name || String(tableId),
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["kitchen-progress", currentOrderId] }),
        qc.invalidateQueries({ queryKey: ["kitchen-history", currentOrderId] }),
      ]);

      Alert.alert("Thành công", "Đã gửi bếp!");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Không thể gửi bếp";
      Alert.alert("Lỗi", msg);
    } finally {
      setNotifying(false);
    }
  };
  // ===== Tiến độ đã báo bếp =====
// useKitchenSocketLive(currentOrderId);
usePosSocketLive(currentOrderId);
  // menuItemId -> counts
  const progressMap = useMemo(() => {
    const m = new Map<
      string,
      { notified: number; preparing: number; ready: number; served: number; cooked: number }
    >();
    for (const r of progress) {
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
  // ===== Render =====
  const renderItem = ({ item }: { item: { id: string; qty: number; rowId?: string } }) => {
    const meta = menuMap.get(item.id);
    const displayName = meta?.name ?? item.id.slice(0, 6);
    const price = meta?.price ?? 0;
const p = progressMap.get(item.id) ?? {
      notified: 0, preparing: 0, ready: 0, served: 0, cooked: 0,
    };
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
            <Text style={tw`mt-1 text-slate-600`}>{price.toLocaleString("vi-VN")}</Text>
            
            {/* tiến độ bếp */}
            <View style={tw`mt-1 flex-row flex-wrap gap-2`}>
              <Badge label={`Đã báo: ${p.notified}`} />
              <Badge label={`Đang nấu: ${p.preparing}`} />
              <Badge label={`Ra món: ${p.ready}`} />
              <Badge label={`Đã phục vụ: ${p.served}`} />
            </View>
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
        <Text style={tw`text-base font-bold`}>{name ? `${name}` : "Đơn"}</Text>
        <Pressable>
          <Text style={tw`text-xl`}>⋯</Text>
        </Pressable>
      </View>

      {/* Chips */}
      <View style={tw`px-3 py-2 flex-row flex-wrap gap-2`}>
        <Chip label="Khách lẻ" />
        <Chip label="Ghi chú" />
        <Chip label="Khách đến" />
      </View>

      {/* Danh sách món */}
      <FlatList
        data={items}
        keyExtractor={(x) => x.rowId ?? `${x.id}`}
        renderItem={renderItem}
        contentContainerStyle={tw`pb-28`}
      />

      {/* Nút nổi thêm món */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(app)/table/[id]",
            params: { id: tableId as string, name },
          })
        }
        style={tw`absolute right-5 bottom-26 h-14 w-14 rounded-full bg-blue-600 items-center justify-center shadow z-100`}
      >
        <Text style={tw`text-white text-2xl`}>＋</Text>
      </Pressable>

      {/* Thanh đáy */}
      <View style={tw`absolute left-0 right-0 bottom-0 px-4 pb-5 pt-3 bg-white border-t border-slate-200`}>
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text style={tw`text-slate-600`}>Tổng tiền</Text>
          <Text style={tw`text-[16px] font-bold`}>{total.toLocaleString("vi-VN")}</Text>
        </View>

        <View style={tw`flex-row gap-3`}>
          <Pressable
            onPress={onNotify}
            disabled={!canNotify || notifying}
            style={tw`flex-1 h-12 rounded-xl border border-blue-600 items-center justify-center ${(!canNotify || notifying) ? "opacity-50" : ""}`}
          >
            <Text style={tw`text-blue-600 font-bold`}>
              {notifying ? "Đang gửi..." : "Thông báo"}
            </Text>
          </Pressable>
          <Pressable
            style={tw`flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center`}
            onPress={() =>
              router.push({
                pathname: "/(app)/table/checkout",
                params: { tableId: tableId as string, name, total: String(total) },
              })
            }
          >
            <Text style={tw`text-white font-bold`}>Thanh toán</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={tw`px-3 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center`}>
      <Text style={tw`text-slate-700`}>{label}</Text>
    </View>
  );
}
function Badge({ label }: { label: string }) {
  return (
    <View style={tw`px-2 h-6 rounded-full bg-slate-100 border border-slate-200 items-center justify-center`}>
      <Text style={tw`text-[12px] text-slate-700`}>{label}</Text>
    </View>
  );
}