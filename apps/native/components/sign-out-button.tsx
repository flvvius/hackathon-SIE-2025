import { useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

export const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
    }
  };

  return (
    <TouchableOpacity
      onPress={handleSignOut}
      className="border border-destructive rounded-lg py-3 px-6"
    >
      <Text className="text-center text-destructive font-semibold">
        Sign Out
      </Text>
    </TouchableOpacity>
  );
};
