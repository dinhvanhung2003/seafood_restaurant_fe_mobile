import { Feather } from '@expo/vector-icons';
import tw from '@lib/tw';
import { Pressable, SafeAreaView, TextInput, View } from 'react-native';

type Props = {
  // Left side actions
  onMenu?: () => void;
  onBack?: () => void;

  // Search (controlled)
  searchValue?: string;
  onChangeSearch?: (v: string) => void;
  onClearSearch?: () => void;
  onCloseSearch?: () => void; // <-- NEW: đóng tìm kiếm
  searchPlaceholder?: string;

  // Right actions
  onNotify?: () => void;
  onOrders?: () => void;
  showActions?: boolean;

  // Title/logo (optional)
  title?: string;
  logoSource?: any;
};

export default function HeaderBar({
  onMenu,
  onBack,
  onNotify,
  onOrders,
  searchValue,
  onChangeSearch,
  onClearSearch,
  onCloseSearch, // NEW
  searchPlaceholder = 'Tìm bàn…',
  showActions = false,
}: Props) {
  const showBack = !!onBack || !!onCloseSearch;

  return (
    <SafeAreaView style={tw`bg-white`}>
      <View style={tw`h-12 flex-row items-center px-3`}>
        {/* Left: back or menu */}
        <Pressable
          onPress={showBack ? (onCloseSearch ?? onBack) : onMenu}
          hitSlop={10}
          style={tw`pr-2`}
        >
          <Feather name={showBack ? 'arrow-left' : 'menu'} size={22} />
        </Pressable>

        {/* Search field */}
        <View
          style={tw`flex-1 flex-row items-center bg-slate-100 rounded-2xl px-3 h-9`}
        >
          <TextInput
            value={searchValue}
            onChangeText={onChangeSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
            style={tw`flex-1 px-1 py-1 text-[16px]`}
          />
          {searchValue ? (
            <Pressable onPress={onClearSearch} hitSlop={10}>
              <Feather name="x" size={18} />
            </Pressable>
          ) : null}
        </View>

        {/* Optional right icons */}
        {showActions && (
          <>
            <Pressable onPress={onNotify} hitSlop={10} style={tw`px-2`}>
              <Feather name="bell" size={20} />
            </Pressable>
            <Pressable onPress={onOrders} hitSlop={10} style={tw`pl-2`}>
              <Feather name="file-text" size={20} />
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
