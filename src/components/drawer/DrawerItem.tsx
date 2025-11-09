
import tw from '@lib/tw';
import { Pressable, Text } from 'react-native';
function DrawerItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={tw`flex-row items-center h-12 px-3 rounded-lg active:bg-slate-100`}>
      <Text style={tw`text-[15px] text-slate-800`}>{label}</Text>
    </Pressable>
  );
}
export default DrawerItem;