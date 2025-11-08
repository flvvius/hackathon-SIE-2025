import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { View, Text, ActivityIndicator } from "react-native";
import { Container } from "@/components/container";

export default function OAuthCallback() {
  const router = useRouter();
  const { setActive: setActiveSignIn } = useSignIn();
  const { setActive: setActiveSignUp } = useSignUp();

  useEffect(() => {
    // This component handles the OAuth callback
    // Clerk automatically handles the session, we just need to redirect
    const timer = setTimeout(() => {
      router.replace("/(tabs)");
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Container>
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-foreground mt-4">Completing sign in...</Text>
      </View>
    </Container>
  );
}
