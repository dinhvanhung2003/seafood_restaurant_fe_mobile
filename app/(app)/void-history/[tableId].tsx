// app/(app)/void-history/[tableId].tsx
import { useVoidEvents } from '@hooks/useVoidEvents';
import tw from '@lib/tw';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

const fmtTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function VoidHistoryScreen() {
  const { tableId, tableName } = useLocalSearchParams<{
    tableId: string;
    tableName?: string;
  }>();
  const router = useRouter();
  const q = useVoidEvents(tableId);

  const data = q.data ?? [];

  const renderItem = ({ item }: any) => {
    const who =
      item.source === 'kitchen'
        ? 'Bếp huỷ'
        : item.source === 'waiter'
        ? 'Phục vụ huỷ'
        : 'Thu ngân huỷ';

    return (
      <View
        style={tw`mb-3 rounded-2xl border border-slate-200 bg-white px-4 py-3`}
      >
        <View style={tw`flex-row justify-between items-center`}>
          <Text style={tw`font-semibold text-slate-900`}>
            {item.itemName} x{item.qty}
          </Text>
          <Text style={tw`text-xs text-slate-400`}>
            {fmtTime(item.createdAt)}
          </Text>
        </View>

        <Text style={tw`mt-1 text-xs text-slate-600`}>
          {who}
          {item.byName ? ` · ${item.byName}` : ''}
        </Text>

        {item.reason ? (
          <Text style={tw`mt-1 text-xs italic text-slate-500`}>
            Lý do: {item.reason}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Header đơn giản */}
      <View
        style={tw`flex-row items-center px-4 pt-12 pb-3 border-b border-slate-200 bg-white`}
      >
        <Pressable onPress={() => router.back()} style={tw`mr-3`}>
          <Text style={tw`text-blue-600 text-base`}>{'<'}</Text>
        </Pressable>
        <View>
          <Text style={tw`text-base font-bold text-slate-900`}>
            Lịch sử huỷ bàn
          </Text>
          <Text style={tw`text-xs text-slate-600 mt-0.5`}>
            {tableName || 'Bàn hiện tại'} · Hôm nay
          </Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={tw`px-4 pt-3 pb-6`}
        data={data}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={tw`mt-10 items-center`}>
            <Text style={tw`text-slate-500 text-sm`}>
              Chưa có lịch sử huỷ cho bàn này hôm nay.
            </Text>
          </View>
        }
      />
    </View>
  );
}
