import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Container } from "@/components/container";
import { useQuery } from "convex/react";
import { api } from "@coTask/backend/convex/_generated/api";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function Home() {
  const { user } = useUser();
  const groupsWithStats = useQuery(api.groups.myGroupsWithStats);

  // Calculate overall stats
  const totalGroups = groupsWithStats?.length || 0;
  const totalTasks = groupsWithStats?.reduce((sum, g) => sum + g.stats.total, 0) || 0;
  const completedTasks = groupsWithStats?.reduce((sum, g) => sum + g.stats.completed, 0) || 0;
  const pendingTasks = groupsWithStats?.reduce((sum, g) => sum + g.stats.pending, 0) || 0;

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

          {/* Stats Overview */}
          <View className="flex-row gap-3 mb-6">
            <View className="flex-1 bg-card border border-border rounded-xl p-4">
              <Text className="text-muted-foreground text-sm mb-1">Groups</Text>
              <Text className="text-foreground text-2xl font-bold">{totalGroups}</Text>
            </View>
            <View className="flex-1 bg-card border border-border rounded-xl p-4">
              <Text className="text-muted-foreground text-sm mb-1">Total Tasks</Text>
              <Text className="text-foreground text-2xl font-bold">{totalTasks}</Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-6">
            <View className="flex-1 bg-card border border-border rounded-xl p-4">
              <Text className="text-muted-foreground text-sm mb-1">Pending</Text>
              <Text className="text-orange-500 text-2xl font-bold">{pendingTasks}</Text>
            </View>
            <View className="flex-1 bg-card border border-border rounded-xl p-4">
              <Text className="text-muted-foreground text-sm mb-1">Completed</Text>
              <Text className="text-green-500 text-2xl font-bold">{completedTasks}</Text>
            </View>
          </View>

          {/* Recent Groups */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground text-xl font-semibold">Your Groups</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/groups")}>
                <Text className="text-primary text-sm font-medium">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="gap-3">
              {groupsWithStats?.slice(0, 3).map((g) => (
                <TouchableOpacity
                  key={g._id}
                  className="bg-card border border-border rounded-xl p-4"
                  onPress={() => router.push(`/group/${g._id}`)}
                >
                  <View className="flex-row items-center gap-3 mb-3">
                    <View
                      className="h-8 w-1.5 rounded-full"
                      style={{ backgroundColor: g.color || "#94a3b8" }}
                    />
                    <View className="flex-1">
                      <Text className="text-card-foreground font-semibold text-lg">
                        {g.name}
                      </Text>
                      {g.description && (
                        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                          {g.description}
                        </Text>
                      )}
                    </View>
                    <View className="bg-primary/10 px-2 py-1 rounded">
                      <Text className="text-primary text-xs font-medium uppercase">
                        {g.role}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-4">
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="list-outline" size={16} color="#9ca3af" />
                      <Text className="text-muted-foreground text-sm">
                        {g.stats.total} tasks
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                      <Text className="text-green-500 text-sm">{g.stats.completed}</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="time-outline" size={16} color="#f59e0b" />
                      <Text className="text-orange-500 text-sm">{g.stats.pending}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              {groupsWithStats && groupsWithStats.length === 0 && (
                <View className="bg-card border border-border rounded-xl p-6 items-center">
                  <Ionicons name="people-outline" size={48} color="#9ca3af" />
                  <Text className="text-foreground font-semibold mt-3 mb-1">
                    No groups yet
                  </Text>
                  <Text className="text-muted-foreground text-sm text-center mb-4">
                    Create your first group to start organizing tasks
                  </Text>
                  <TouchableOpacity
                    className="bg-primary px-6 py-2 rounded-lg"
                    onPress={() => router.push("/(tabs)/groups")}
                  >
                    <Text className="text-primary-foreground font-semibold">
                      Create Group
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
