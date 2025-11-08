import { Container } from "@/components/container";
import { SwipeableTask } from "@/components/swipeable-task";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Id } from "@coTask/backend/convex/_generated/dataModel";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUser } from "@clerk/clerk-expo";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id as Id<"groups">;
  const { user: clerkUser } = useUser();

  const tasks = useQuery(api.tasks.listByGroup, { groupId });
  const statuses = useQuery(api.tasks.getStatuses, { groupId });
  const group = useQuery(api.groups.getGroup, { groupId });
  const currentUser = useQuery(api.users.getCurrentUser);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");

  const createTask = useMutation(api.tasks.createSimple);
  const updateTaskStatus = useMutation(api.tasks.updateStatus);

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

  const tasksByStatus =
    statuses?.map((status) => ({
      status,
      tasks: tasks?.filter((t) => t.statusId === status._id) || [],
    })) || [];

  const priorityColors = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#f59e0b",
    urgent: "#ef4444",
  };

  const handleMoveTask = async (
    taskId: Id<"tasks">,
    currentStatusIndex: number,
    direction: "left" | "right"
  ) => {
    if (!statuses) return;

    const newIndex =
      direction === "left" ? currentStatusIndex - 1 : currentStatusIndex + 1;

    if (newIndex < 0 || newIndex >= statuses.length) return;

    const newStatus = statuses[newIndex];

    // Check if moving to "Done" status
    if (newStatus.name === "Done") {
      // Find the task to check its subtasks
      const task = tasks?.find((t) => t._id === taskId);

      if (task && (task as any).subtaskCount > 0) {
        const incompleteCount =
          (task as any).subtaskCount - (task as any).completedSubtaskCount;

        if (incompleteCount > 0) {
          Alert.alert(
            "Not So Fast!",
            `This task still has ${incompleteCount} incomplete subtask${
              incompleteCount > 1 ? "s" : ""
            }. Complete ${incompleteCount > 1 ? "them" : "it"} first.`,
            [{ text: "Got it", style: "default" }]
          );
          return;
        }
      }
    }

    try {
      await updateTaskStatus({ taskId, statusId: newStatus._id });
    } catch (error: any) {
      console.error("Error moving task:", error);
      // Show error if backend validation fails
      Alert.alert(
        "Oops!",
        error?.message || "Failed to move task. Please try again.",
        [{ text: "OK" }]
      );
    }
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
                <Text className="text-muted-foreground mt-1">
                  {group.description}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => router.push(`/group/${groupId}/settings`)}
              className="ml-2"
            >
              <Ionicons name="settings-outline" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Create Task Button */}
          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-lg mb-4"
            onPress={() => setShowCreateTask(true)}
          >
            <View className="flex-row items-center justify-center gap-2">
              <Ionicons name="add-circle-outline" size={20} color="white" />
              <Text className="text-primary-foreground font-semibold">
                New Task
              </Text>
            </View>
          </TouchableOpacity>

          {/* Swipe Hint */}
          <View className="bg-card border border-border rounded-lg p-3 mb-6 flex-row items-center gap-2">
            <Ionicons name="information-circle" size={20} color="#6366f1" />
            <Text className="text-muted-foreground text-sm flex-1">
              Swipe tasks left or right to move between statuses
            </Text>
          </View>

          {/* Tasks by Status */}
          <GestureHandlerRootView>
            {tasksByStatus.map(
              ({ status, tasks: statusTasks }, statusIndex) => (
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
                      <SwipeableTask
                        key={task._id}
                        task={task}
                        priorityColor={(priorityColors as any)[task.priority]}
                        canSwipeLeft={statusIndex > 0}
                        canSwipeRight={statusIndex < tasksByStatus.length - 1}
                        onSwipeLeft={() =>
                          handleMoveTask(task._id, statusIndex, "left")
                        }
                        onSwipeRight={() =>
                          handleMoveTask(task._id, statusIndex, "right")
                        }
                        onPress={() => {
                          router.push(`/task/${task._id}?groupId=${groupId}`);
                        }}
                      />
                    ))}
                  </View>
                </View>
              )
            )}
          </GestureHandlerRootView>
        </View>
      </ScrollView>

      {/* Create Task Modal */}
      <Modal
        visible={showCreateTask}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateTask(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => {
              setShowCreateTask(false);
              setNewTaskTitle("");
              setNewTaskDescription("");
              setNewTaskPriority("medium");
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                className="bg-background rounded-t-3xl pt-6 px-6 pb-8"
                keyboardShouldPersistTaps="handled"
              >
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-foreground text-xl font-bold">
                    New Task
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCreateTask(false);
                      setNewTaskTitle("");
                      setNewTaskDescription("");
                      setNewTaskPriority("medium");
                    }}
                  >
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <View className="gap-4">
                  <View>
                    <Text className="text-foreground font-medium mb-2">
                      Title *
                    </Text>
                    <TextInput
                      className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
                      placeholder="Task title"
                      placeholderTextColor="#9ca3af"
                      value={newTaskTitle}
                      onChangeText={setNewTaskTitle}
                    />
                  </View>

                  <View>
                    <Text className="text-foreground font-medium mb-2">
                      Description
                    </Text>
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
                    <Text className="text-foreground font-medium mb-2">
                      Priority
                    </Text>
                    <View className="flex-row gap-2">
                      {(["low", "medium", "high", "urgent"] as const).map(
                        (priority) => (
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
                        )
                      )}
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
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
}
