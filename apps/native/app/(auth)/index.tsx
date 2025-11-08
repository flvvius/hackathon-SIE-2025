import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { Container } from "@/components/container";
import { Ionicons } from "@expo/vector-icons";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Container>
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-12">
          <View className="bg-primary/10 rounded-full p-6 mb-6">
            <Ionicons name="checkmark-circle" size={80} color="#3b82f6" />
          </View>
          <Text className="text-4xl font-bold text-foreground mb-3 text-center">
            Welcome to CoTask
          </Text>
          <Text className="text-lg text-muted-foreground text-center max-w-sm">
            Collaborative task management with end-to-end encryption
          </Text>
        </View>

        <View className="space-y-4">
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-up")}
            className="bg-primary rounded-xl py-4 mb-3"
          >
            <Text className="text-center text-white font-semibold text-lg">
              Get Started
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in")}
            className="border-2 border-border rounded-xl py-4"
          >
            <Text className="text-center text-foreground font-semibold text-lg">
              I already have an account
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-12">
          <View className="flex-row items-center mb-4">
            <Ionicons name="lock-closed-outline" size={20} color="#737378" />
            <Text className="text-muted-foreground ml-2">
              End-to-end encrypted
            </Text>
          </View>
          <View className="flex-row items-center mb-4">
            <Ionicons name="people-outline" size={20} color="#737378" />
            <Text className="text-muted-foreground ml-2">
              Collaborative task management
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="sync-outline" size={20} color="#737378" />
            <Text className="text-muted-foreground ml-2">
              Real-time synchronization
            </Text>
          </View>
        </View>
      </View>
    </Container>
  );
}
