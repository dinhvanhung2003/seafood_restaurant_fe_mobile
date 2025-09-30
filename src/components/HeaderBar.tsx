// components/HeaderBar.tsx
import { Feather } from '@expo/vector-icons';
import tw from '@lib/tw';
import { Image, Pressable, SafeAreaView, Text, View } from 'react-native';

type Props = {
  onMenu?: () => void;
  onSearch?: () => void;
  onNotify?: () => void;
  onOrders?: () => void;
  logoSource?: any; // optional: require('.../assets/kiotviet.png')
};

export default function HeaderBar({
  onMenu,
  onSearch,
  onNotify,
  onOrders,
  logoSource,
}: Props) {
  return (
    <SafeAreaView style={tw`bg-white`}>
      <View style={tw`h-12 flex-row items-center px-3`}>
        {/* Hamburger */}
        <Pressable onPress={onMenu} hitSlop={10} style={tw`pr-2`}>
          <Feather name="menu" size={22} />
        </Pressable>

        {/* Logo + Title */}
        <View style={tw`flex-row items-center gap-2 flex-1`}>
          {logoSource ? (
            <Image source={logoSource} style={{ width: 28, height: 28 }} resizeMode="contain" />
          ) : (
            // fallback logo “2 hạt màu” đơn giản
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-3.5 h-3.5 rounded-full bg-blue-600 mr-0.5`} />
              <View style={tw`w-3.5 h-3.5 rounded-full bg-green-500`} />
            </View>
          )}
          <Text style={tw`text-xl font-extrabold text-slate-900`}>KiotViet</Text>
        </View>

        {/* Actions */}
        <Pressable onPress={onSearch} hitSlop={10} style={tw`px-2`}>
          <Feather name="search" size={20} />
        </Pressable>
        <Pressable onPress={onNotify} hitSlop={10} style={tw`px-2`}>
          <Feather name="bell" size={20} />
        </Pressable>
        <Pressable onPress={onOrders} hitSlop={10} style={tw`pl-2`}>
          <Feather name="file-text" size={20} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
