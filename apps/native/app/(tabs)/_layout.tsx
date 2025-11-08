import { useColorScheme } from "@/lib/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import React from "react";
import { View, Modal, Text, TouchableOpacity } from "react-native";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";

export default function TabLayout() {
  const { isDarkColorScheme } = useColorScheme();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const me = useQuery(api.users.getCurrentUser);
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const upsert = useMutation(api.users.upsertCurrentUser);
  const setRole = useMutation(api.users.setDefaultRole);
  const [showRoleModal, setShowRoleModal] = React.useState(false);

  // Ensure user exists and evaluate role selection
  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      upsert().catch(() => {});
    }
  }, [isLoaded, isSignedIn]);

  React.useEffect(() => {
    if (me && !me.defaultRole) {
      setShowRoleModal(true);
    }
  }, [me]);

  const chooseRole = async (role: "owner" | "scrum_master" | "attendee") => {
    await setRole({ defaultRole: role });
    setShowRoleModal(false);
  };

  // Show loading while checking auth status
  if (!isLoaded) {
    return null;
  }

  // Redirect to welcome screen if not authenticated
  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: isDarkColorScheme
            ? "hsl(217.2 91.2% 59.8%)"
            : "hsl(221.2 83.2% 53.3%)",
          tabBarInactiveTintColor: isDarkColorScheme
            ? "hsl(240 5% 64.9%)"
            : "hsl(240 3.8% 46.1%)",
          tabBarStyle: {
            backgroundColor: isDarkColorScheme
              ? "hsl(240 10% 3.9%)"
              : "hsl(0 0% 100%)",
            borderTopColor: isDarkColorScheme
              ? "hsl(240 3.7% 15.9%)"
              : "hsl(240 5.9% 90%)",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            tabBarIcon: ({ color }) => (
              <Ionicons name="list-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: "Inbox",
            tabBarBadge:
              unreadCount && unreadCount > 0 ? unreadCount : undefined,
            tabBarIcon: ({ color }) => (
              <Ionicons name="notifications-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: "Groups",
            tabBarIcon: ({ color }) => (
              <Ionicons name="people-outline" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-outline" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
      <Modal visible={showRoleModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="w-full bg-card border border-border rounded-2xl p-6">
            <Text className="text-2xl font-bold text-card-foreground mb-2">
              Select Role
            </Text>
            <Text className="text-muted-foreground mb-4">
              Choose how you want to participate. You can still get different
              roles per group later.
            </Text>
            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary rounded-xl p-4"
                onPress={() => chooseRole("owner")}
              >
                <Text className="text-primary-foreground font-semibold">
                  Owner • full control
                </Text>
                <Text className="text-primary-foreground/80 text-xs mt-1">
                  Create groups and manage everything.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-primary/90 rounded-xl p-4"
                onPress={() => chooseRole("scrum_master")}
              >
                <Text className="text-primary-foreground font-semibold">
                  Scrum Master • coordination
                </Text>
                <Text className="text-primary-foreground/80 text-xs mt-1">
                  Maintain tasks and help teams stay on track.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-primary/80 rounded-xl p-4"
                onPress={() => chooseRole("attendee")}
              >
                <Text className="text-primary-foreground font-semibold">
                  Attendee • focus on tasks
                </Text>
                <Text className="text-primary-foreground/80 text-xs mt-1">
                  Complete assigned tasks and subtasks.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
