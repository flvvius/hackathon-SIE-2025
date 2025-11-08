import { View, Text, ScrollView } from "react-native";
import { Container } from "@/components/container";
import { useQuery } from "convex/react";
import { api } from "@coTask/backend/convex/_generated/api";
import { useUser } from "@clerk/clerk-expo";
import { SignOutButton } from "@/components/sign-out-button";

export default function Home() {
  const { user } = useUser();
  const healthCheck = useQuery(api.healthCheck.get);
  const privateData = useQuery(api.privateData.get);

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          <Text className="font-mono text-foreground text-3xl font-bold mb-2">
            CoTask
          </Text>
          <Text className="text-muted-foreground mb-6">
            Welcome back,{" "}
            {user?.firstName || user?.emailAddresses[0].emailAddress}
          </Text>

          <View className="bg-card border border-border rounded-xl p-6 mb-6 shadow-sm">
            <View className="flex-row items-center gap-3">
              <View
                className={`h-3 w-3 rounded-full ${
                  healthCheck ? "bg-green-500" : "bg-orange-500"
                }`}
              />
              <View className="flex-1">
                <Text className="text-sm font-medium text-card-foreground">
                  Convex Backend
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {healthCheck === undefined
                    ? "Checking connection..."
                    : healthCheck === "OK"
                      ? "Connected and ready"
                      : "Disconnected"}
                </Text>
              </View>
            </View>
          </View>

          {privateData && (
            <View className="bg-card border border-border rounded-xl p-6 mb-6">
              <Text className="text-foreground font-semibold mb-2">
                Private Data Test
              </Text>
              <Text className="text-muted-foreground">
                {privateData.message}
              </Text>
            </View>
          )}

          <SignOutButton />
        </View>
      </ScrollView>
    </Container>
  );
}
