import { Container } from "@/components/container";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { ScrollView, Text, View, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

export default function AuditScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const auditLogs = useQuery(api.auditLogs.listAll, { limit: 100 });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    // The query will auto-refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Only owners can see audit logs
  if (currentUser && currentUser.defaultRole !== "owner") {
    return (
      <Container>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
          <Text className="text-muted-foreground text-lg font-semibold mt-4">
            Access Denied
          </Text>
          <Text className="text-muted-foreground text-sm text-center mt-2">
            Only users with Owner role can view audit logs.
          </Text>
        </View>
      </Container>
    );
  }

  const getActionIcon = (action: string, entityType: string) => {
    if (action === "create") {
      if (entityType === "group") return "folder-outline";
      if (entityType === "task") return "clipboard-outline";
      if (entityType === "subtask") return "list-outline";
      return "add-circle-outline";
    }
    if (action === "update") return "create-outline";
    if (action === "delete") return "trash-outline";
    if (action === "assign" || action === "delegate")
      return "person-add-outline";
    if (action === "complete") return "checkmark-circle-outline";
    if (action === "join") return "enter-outline";
    return "information-circle-outline";
  };

  const getActionColor = (action: string) => {
    if (action === "create") return "#10b981"; // green
    if (action === "update") return "#3b82f6"; // blue
    if (action === "delete") return "#ef4444"; // red
    if (action === "assign" || action === "delegate") return "#f59e0b"; // orange
    if (action === "complete") return "#8b5cf6"; // purple
    if (action === "join") return "#06b6d4"; // cyan
    return "#6b7280"; // gray
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  return (
    <Container>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-4 py-6">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-3xl font-bold text-foreground">
              Audit Logs
            </Text>
            <Text className="text-muted-foreground mt-1">
              System-wide activity and changes
            </Text>
          </View>

          {/* Stats */}
          {auditLogs && auditLogs.length > 0 && (
            <View className="bg-card border border-border rounded-lg p-4 mb-6">
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name="stats-chart-outline"
                  size={20}
                  color="#6366f1"
                />
                <Text className="text-card-foreground font-semibold">
                  {auditLogs.length} events logged
                </Text>
              </View>
            </View>
          )}

          {/* Audit Logs List */}
          {!auditLogs ? (
            <View className="bg-card border border-border rounded-lg p-8 items-center">
              <Text className="text-muted-foreground">Loading...</Text>
            </View>
          ) : auditLogs.length === 0 ? (
            <View className="bg-card border border-border rounded-lg p-8 items-center">
              <Ionicons
                name="document-text-outline"
                size={48}
                color="#9ca3af"
              />
              <Text className="text-muted-foreground mt-2">
                No activity yet
              </Text>
              <Text className="text-muted-foreground text-sm text-center mt-1">
                Audit logs will appear here as actions are performed
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {auditLogs.map((log) => (
                <View
                  key={log._id}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <View className="flex-row items-start gap-3">
                    {/* Icon */}
                    <View
                      className="h-10 w-10 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: getActionColor(log.action) + "20",
                      }}
                    >
                      <Ionicons
                        name={getActionIcon(log.action, log.entityType) as any}
                        size={20}
                        color={getActionColor(log.action)}
                      />
                    </View>

                    {/* Content */}
                    <View className="flex-1">
                      <Text className="text-card-foreground font-semibold">
                        {log.description}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Text className="text-muted-foreground text-xs">
                          by {log.userName}
                        </Text>
                        <Text className="text-muted-foreground text-xs">•</Text>
                        <Text className="text-muted-foreground text-xs">
                          {formatTimeAgo(log.timestamp)}
                        </Text>
                      </View>
                      {log.entityName && (
                        <View className="mt-2 flex-row items-center gap-1">
                          <View className="bg-muted px-2 py-1 rounded">
                            <Text className="text-foreground text-xs">
                              {log.entityType}: {log.entityName}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Container>
  );
}
