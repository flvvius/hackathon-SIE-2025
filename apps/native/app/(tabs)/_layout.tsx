import { useColorScheme } from "@/lib/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import React from "react";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";

export default function TabLayout() {
  const { isDarkColorScheme } = useColorScheme();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const me = useQuery(api.users.getCurrentUser);
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const isOwner = useQuery(api.users.isOwnerAnywhere);
  const upsert = useMutation(api.users.upsertCurrentUser);

  // Ensure user exists
  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      upsert().catch(() => {});
    }
  }, [isLoaded, isSignedIn]);

  // Show loading while checking auth status
  if (!isLoaded) {
    return null;
  }

  // Redirect to welcome screen if not authenticated
  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  return (
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
          title: "Audit",
          href: isOwner ? undefined : null, // Only show to owners of any group
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarBadge: unreadCount && unreadCount > 0 ? unreadCount : undefined,
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
  );
}
