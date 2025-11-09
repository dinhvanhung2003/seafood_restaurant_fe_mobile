import tw from '@lib/tw';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import DrawerItem from './DrawerItem';


function SideDrawer({
  open,
  name,
  onClose,
  onLogout,
}: {
  open: boolean;
  name?: string;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}) {
  const slide = useRef(new Animated.Value(0)).current; // 0: đóng, 1: mở
  const router = useRouter();

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open]);

  const WIDTH = 280;
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH, 0] });
  const overlayOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <>
      {/* Overlay tap để đóng */}
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[tw`absolute inset-0 bg-black`, { opacity: overlayOpacity }]}>
        <Pressable style={tw`flex-1`} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[tw`absolute top-0 bottom-0 left-0 bg-white shadow-lg`, { width: WIDTH, transform: [{ translateX }] }]}>
        <View style={tw`pt-12 pb-4 px-4 border-b border-slate-100`}>
          <Text style={tw`text-xl font-extrabold text-slate-900`}>Seafood POS</Text>
          <Text style={tw`mt-1 text-slate-600`}>{name ?? 'Nhân viên'}</Text>
        </View>

        <View style={tw`px-2 py-3`}>
          <DrawerItem label="Trang chủ" onPress={onClose} />
          {/* <DrawerItem label="Đơn hiện tại" onPress={onClose} /> */}
          {/* <DrawerItem label="Cài đặt" onPress={onClose} /> */}

         <DrawerItem
  label="Chấm công"
  onPress={() => {
    onClose();
router.push({ pathname: '/(app)/profile/atttendance' } as never);

  }}
/>
<DrawerItem
  label="Bảng chấm công"
  onPress={() => {
    onClose();
    router.push({ pathname: "/(app)/profile/atttendance/list" } as never);
  }}
/>
<DrawerItem
  label="Đăng ký khuôn mặt"
  onPress={() => {
    onClose();
    router.push({ pathname: "/(app)/profile/face" } as never);
  }}
/>
          <DrawerItem label="Đổi mật khẩu" onPress={onClose} />
          <DrawerItem label="Đăng xuất" onPress={onLogout} />
        </View>
      </Animated.View>

    </>
  );
}
export default SideDrawer;