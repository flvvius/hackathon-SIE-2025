import { Container } from "@/components/container";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Id } from "@coTask/backend/convex/_generated/dataModel";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id as Id<"groups">;
  
  const tasks = useQuery(api.tasks.listByGroup, { groupId });
  const statuses = useQuery(api.tasks.getStatuses, { groupId });
  const group = useQuery(api.groups.getGroup, { groupId });
  
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  
  const createTask = useMutation(api.tasks.createSimple);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !statuses || statuses.length === 0) return;
    
    const defaultStatus = statuses.find((s) => s.name === "To Do");
    if (!defaultStatus) return;
    
    try {
      await createTask({
        groupId,
        statusId: defaultStatus._id,
        title: newTaskTitle,
        description: newTaskDescription,
        priority: newTaskPriority,
      });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setShowCreateTask(false);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const tasksByStatus = statuses?.map((status) => ({
    status,
    tasks: tasks?.filter((t) => t.statusId === status._id) || [],
  })) || [];

  const priorityColors = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#f59e0b",
    urgent: "#ef4444",
  };

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          {/* Header */}
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="#6b7280" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-3xl font-bold text-foreground">
                {group?.name || "Loading..."}
              </Text>
              {group?.description && (
                <Text className="text-muted-foreground mt-1">{group.description}</Text>
              )}
            </View>
          </View>

          {/* Create Task Button */}
          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-lg mb-6"
            onPress={() => setShowCreateTask(true)}
          >
            <View className="flex-row items-center justify-center gap-2">
              <Ionicons name="add-circle-outline" size={20} color="white" />
              <Text className="text-primary-foreground font-semibold">New Task</Text>
            </View>
          </TouchableOpacity>

          {/* Tasks by Status */}
          {tasksByStatus.map(({ status, tasks: statusTasks }) => (
            <View key={status._id} className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <View
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <Text className="text-foreground text-lg font-semibold">
                  {status.name}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  ({statusTasks.length})
                </Text>
              </View>

              <View className="gap-2">
                {statusTasks.length === 0 && (
                  <Text className="text-muted-foreground text-sm italic ml-5">
                    No tasks
                  </Text>
                )}
                {statusTasks.map((task) => (
                  <View
                    key={task._id}
                    className="bg-card border border-border rounded-lg p-4 ml-5"
                  >
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-card-foreground font-semibold flex-1">
                        {(task as any).title || task.encryptedTitle}
                      </Text>
                      <View
                        className="px-2 py-1 rounded"
                        style={{ backgroundColor: (priorityColors as any)[task.priority] + "20" }}
                      >
                        <Text
                          className="text-xs font-medium uppercase"
                          style={{ color: (priorityColors as any)[task.priority] }}
                        >
                          {task.priority}
                        </Text>
                      </View>
                    </View>
                    {(task.encryptedDescription || (task as any).description) && (
                      <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                        {(task as any).description || task.encryptedDescription}
                      </Text>
                    )}
                    <View className="flex-row items-center gap-4 mt-3">
                      {task.isCompleted && (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          <Text className="text-green-500 text-xs">Completed</Text>
                        </View>
                      )}
                      {task.deadline && (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
                          <Text className="text-muted-foreground text-xs">
                            {new Date(task.deadline).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {task.assignments.length > 0 && (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="people-outline" size={14} color="#9ca3af" />
                          <Text className="text-muted-foreground text-xs">
                            {task.assignments.length}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Create Task Modal */}
      <Modal visible={showCreateTask} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 pb-8">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-foreground text-xl font-bold">New Task</Text>
              <TouchableOpacity onPress={() => setShowCreateTask(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-foreground font-medium mb-2">Title *</Text>
                <TextInput
                  className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Task title"
                  placeholderTextColor="#9ca3af"
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                />
              </View>

              <View>
                <Text className="text-foreground font-medium mb-2">Description</Text>
                <TextInput
                  className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Task description"
                  placeholderTextColor="#9ca3af"
                  value={newTaskDescription}
                  onChangeText={setNewTaskDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View>
                <Text className="text-foreground font-medium mb-2">Priority</Text>
                <View className="flex-row gap-2">
                  {(["low", "medium", "high", "urgent"] as const).map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      className={`flex-1 py-2 rounded-lg border ${
                        newTaskPriority === priority
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                      onPress={() => setNewTaskPriority(priority)}
                    >
                      <Text
                        className={`text-center text-sm font-medium uppercase ${
                          newTaskPriority === priority
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        {priority}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                className="bg-primary py-3 rounded-lg mt-2"
                onPress={handleCreateTask}
                disabled={!newTaskTitle.trim()}
              >
                <Text className="text-primary-foreground text-center font-semibold">
                  Create Task
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}
