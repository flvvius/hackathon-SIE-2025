import React, { createContext, useContext, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@coTask/backend/convex/_generated/api";
import { useRouter } from "expo-router";

type ToastNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  relatedTaskId?: string;
  relatedGroupId?: string;
};

type NotificationContextType = {
  showToast: (notification: ToastNotification) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [translateY] = useState(new Animated.Value(-100));
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(
    null
  );

  // Subscribe to new notifications
  const notifications = useQuery(api.notifications.myNotifications, {
    onlyUnread: true,
  });

  // Show toast when new notification arrives
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const latest = notifications[0];
      // Only show toast if this is a new notification we haven't seen
      if (latest._id !== lastNotificationId) {
        setLastNotificationId(latest._id);
        showToast({
          id: latest._id,
          title: latest.encryptedTitle,
          message: latest.encryptedMessage,
          type: latest.type,
          relatedTaskId: latest.relatedTaskId,
          relatedGroupId: latest.relatedGroupId,
        });
      }
    }
  }, [notifications]);

  const showToast = (notification: ToastNotification) => {
    setToast(notification);

    // Slide in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      hideToast();
    }, 4000);
  };

  const hideToast = () => {
    // Slide out
    Animated.spring(translateY, {
      toValue: -100,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start(() => {
      setToast(null);
    });
  };

  const handleToastPress = () => {
    hideToast();
    if (toast?.relatedTaskId) {
      router.push(`/task/${toast.relatedTaskId}`);
    } else if (toast?.relatedGroupId) {
      router.push(`/group/${toast.relatedGroupId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "task_delegated":
      case "task_assigned":
        return "📋";
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

  return (
    <NotificationContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Notification */}
      {toast && (
        <Animated.View
          style={{
            transform: [{ translateY }],
            position: "absolute",
            top: 50,
            left: 16,
            right: 16,
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            onPress={handleToastPress}
            activeOpacity={0.9}
            className="bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 rounded-2xl shadow-2xl"
          >
            <View className="p-4 flex-row items-center gap-3">
              <Text className="text-3xl">
                {getNotificationIcon(toast.type)}
              </Text>
              <View className="flex-1">
                <Text className="text-foreground font-bold text-base mb-1">
                  {toast.title}
                </Text>
                <Text
                  className="text-muted-foreground text-sm"
                  numberOfLines={2}
                >
                  {toast.message}
                </Text>
              </View>
              <TouchableOpacity onPress={hideToast} className="p-2">
                <Text className="text-muted-foreground text-lg">✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
}
