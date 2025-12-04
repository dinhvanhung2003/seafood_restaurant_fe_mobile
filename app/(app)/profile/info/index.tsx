import tw from "@lib/tw";
import { useAuth } from "@providers/AuthProvider";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

export default function ProfileInfoScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <View style={tw`flex-1 bg-white pt-12`}>
      {/* Header */}
      <View style={tw`px-4 mb-4 flex-row items-center`}>
        <Pressable onPress={() => router.back()} style={tw`mr-3`}>
          <Text style={tw`text-lg text-blue-600`}></Text>
        </Pressable>
        <Text style={tw`text-xl font-bold text-slate-900`}>Thông tin cá nhân</Text>
      </View>

      <ScrollView contentContainerStyle={tw`px-4 pb-20`}>
        {/* Avatar */}
        <View style={tw`items-center mt-4`}>
          {profile?.avatar ? (
            <Image
              source={{ uri: profile.avatar }}
              style={tw`w-28 h-28 rounded-full`}
            />
          ) : (
            <View
              style={tw`w-28 h-28 rounded-full bg-slate-200 items-center justify-center`}
            >
              <Text style={tw`text-3xl text-slate-500`}>
                {profile?.displayName?.[0] ?? "U"}
              </Text>
            </View>
          )}

          <Text style={tw`mt-3 text-xl font-bold text-slate-900`}>
            {profile?.displayName ?? "–"}
          </Text>
          <Text style={tw`text-slate-600`}>{profile?.email ?? ""}</Text>
        </View>

        {/* Info Box */}
        <View style={tw`mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-200`}>
          <InfoRow label="Họ tên" value={profile?.displayName} />
          <InfoRow label="Email" value={profile?.email} />
          <InfoRow label="Vai trò" value={profile?.role} />
          {/* <InfoRow label="Mã nhân viên" value={profile?.employeeCode ?? "—"} /> */}
          {/* <InfoRow label="User ID" value={profile?.userId} /> */}
        </View>
      </ScrollView>
    </View>
  );
}

/* Component dòng thông tin */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={tw`mb-3`}>
      <Text style={tw`text-slate-500 text-sm`}>{label}</Text>
      <Text style={tw`text-slate-900 text-base font-medium`}>
        {value ?? "—"}
      </Text>
    </View>
  );
}
