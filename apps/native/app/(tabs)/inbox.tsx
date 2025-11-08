import { Container } from "@/components/container";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function InboxScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const notifications = useQuery(api.notifications.myNotifications, {
    onlyUnread: false,
  });
  const markRead = useMutation(api.notifications.markRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const handleNotificationPress = async (notification: any) => {
    // Mark as read
    if (!notification.isRead) {
      await markRead({ notificationId: notification._id });
    }

    // Navigate to related content
    if (notification.relatedTaskId) {
      router.push(`/task/${notification.relatedTaskId}`);
    } else if (notification.relatedGroupId) {
      router.push(`/group/${notification.relatedGroupId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead({});
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Wait for query to refresh
    setTimeout(() => setRefreshing(false), 500);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "task_delegated":
      case "task_assigned":
        return "📋";
      case "subtask_delegated":
        return "📝";
      case "task_completed":
        return "✅";
      case "subtask_completed":
        return "✓";
      case "group_invite":
        return "👥";
      case "deadline_approaching":
        return "⏰";
      case "mention":
        return "@";
      default:
        return "🔔";
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  return (
    <Container>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="px-4 py-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-3xl font-bold text-foreground">Inbox</Text>
            {unreadCount > 0 && (
              <View className="bg-red-500 rounded-full px-3 py-1">
                <Text className="text-white font-bold text-sm">
                  {unreadCount}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg text-muted-foreground">
              Your notifications and updates
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllAsRead}>
                <Text className="text-primary font-medium text-sm">
                  Mark all read
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="gap-2">
            {notifications?.map((n) => (
              <TouchableOpacity
                key={n._id}
                onPress={() => handleNotificationPress(n)}
                className={`border rounded-xl p-4 ${
                  n.isRead
                    ? "bg-card border-border"
                    : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                }`}
              >
                <View className="flex-row items-start gap-3">
                  <Text className="text-2xl">
                    {getNotificationIcon(n.type)}
                  </Text>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className={`font-semibold ${
                          n.isRead
                            ? "text-card-foreground"
                            : "text-blue-900 dark:text-blue-100"
                        }`}
                      >
                        {n.encryptedTitle}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {formatDate(n.createdAt)}
                      </Text>
                    </View>
                    <Text
                      className={`text-sm ${
                        n.isRead
                          ? "text-muted-foreground"
                          : "text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {n.encryptedMessage}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {notifications && notifications.length === 0 && (
              <View className="items-center justify-center py-12">
                <Text className="text-6xl mb-4">📭</Text>
                <Text className="text-xl font-semibold text-foreground mb-2">
                  All caught up!
                </Text>
                <Text className="text-muted-foreground text-center">
                  You have no notifications at the moment
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
