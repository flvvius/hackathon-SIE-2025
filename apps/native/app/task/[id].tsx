import { Container } from "@/components/container";
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
import { useUser } from "@clerk/clerk-expo";

export default function TaskDetailScreen() {
  const { id, groupId } = useLocalSearchParams<{
    id: string;
    groupId: string;
  }>();
  const taskId = id as Id<"tasks">;
  const { user: clerkUser } = useUser();

  const tasks = useQuery(api.tasks.listByGroup, {
    groupId: groupId as Id<"groups">,
  });
  const task = tasks?.find((t) => t._id === taskId);
  const subtasks = useQuery(api.subtasks.list, { parentTaskId: taskId });
  const currentUser = useQuery(api.users.getCurrentUser);

  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("");

  const createSubtask = useMutation(api.subtasks.create);
  const toggleSubtaskComplete = useMutation(api.subtasks.toggleComplete);
  const toggleSelfAssignment = useMutation(api.tasks.toggleSelfAssignment);

  const isAssigned =
    currentUser &&
    task?.assignments.some((a: any) => a.userId === currentUser._id);

  const handleToggleSelfAssignment = async () => {
    try {
      const result = await toggleSelfAssignment({ taskId });
      // Success feedback could be added here if needed
    } catch (error: any) {
      console.error("Error toggling assignment:", error);
      Alert.alert("Error", error?.message || "Failed to update assignment");
    }
  };

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim() || !currentUser) return;

    try {
      await createSubtask({
        parentTaskId: taskId,
        encryptedTitle: newSubtaskTitle,
        encryptedDescription: newSubtaskDescription || undefined,
      });
      setNewSubtaskTitle("");
      setNewSubtaskDescription("");
      setShowAddSubtask(false);
    } catch (error) {
      console.error("Error creating subtask:", error);
      Alert.alert("Error", "Failed to create subtask");
    }
  };

  const handleToggleSubtask = async (
    subtaskId: Id<"subtasks">,
    isCompleted: boolean
  ) => {
    if (!currentUser) return;

    try {
      await toggleSubtaskComplete({
        subtaskId,
        completed: !isCompleted,
        userId: currentUser._id,
      });
    } catch (error) {
      console.error("Error toggling subtask:", error);
      Alert.alert("Error", "Failed to update subtask");
    }
  };

  const priorityColors = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#f59e0b",
    urgent: "#ef4444",
  };

  const completedSubtasks = subtasks?.filter((s) => s.isCompleted).length || 0;
  const totalSubtasks = subtasks?.length || 0;
  const progress =
    totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  if (!task) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Loading...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          {/* Header */}
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground flex-1">
              Task Details
            </Text>
          </View>

          {/* Task Info Card */}
          <View className="bg-card border border-border rounded-lg p-4 mb-6">
            <View className="flex-row items-start justify-between mb-3">
              <Text className="text-card-foreground font-bold text-lg flex-1">
                {(task as any).title || task.encryptedTitle}
              </Text>
              <View
                className="px-3 py-1 rounded-lg"
                style={{
                  backgroundColor:
                    (priorityColors as any)[task.priority] + "20",
                }}
              >
                <Text
                  className="text-xs font-semibold uppercase"
                  style={{
                    color: (priorityColors as any)[task.priority],
                  }}
                >
                  {task.priority}
                </Text>
              </View>
            </View>

            {(task.encryptedDescription || (task as any).description) && (
              <Text className="text-muted-foreground mb-4">
                {(task as any).description || task.encryptedDescription}
              </Text>
            )}

            <View className="flex-row items-center gap-4">
              {task.deadline && (
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={
                      new Date(task.deadline) < new Date()
                        ? "#ef4444"
                        : "#9ca3af"
                    }
                  />
                  <Text
                    className={`text-sm ${
                      new Date(task.deadline) < new Date()
                        ? "text-red-500 font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {new Date(task.deadline).toLocaleDateString()}
                    {new Date(task.deadline) < new Date() && " (Overdue)"}
                  </Text>
                </View>
              )}
              {task.assignments.length > 0 && (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="people-outline" size={16} color="#9ca3af" />
                  <Text className="text-muted-foreground text-sm">
                    {task.assignments.length} assigned
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Assigned Users Section */}
          <View className="bg-card border border-border rounded-lg p-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground font-semibold">Assigned To</Text>
              <TouchableOpacity
                onPress={handleToggleSelfAssignment}
                className={`px-4 py-2 rounded-lg ${
                  isAssigned
                    ? "bg-red-500/10 border border-red-500"
                    : "bg-primary"
                }`}
                disabled={
                  !currentUser || (task.assignments.length >= 3 && !isAssigned)
                }
              >
                <Text
                  className={`font-semibold ${
                    isAssigned ? "text-red-500" : "text-white"
                  }`}
                >
                  {isAssigned ? "Unassign Me" : "Assign Me"}
                </Text>
              </TouchableOpacity>
            </View>

            {task.assignments.length > 0 ? (
              <View className="gap-2">
                {task.assignments.map((assignment: any, index: number) => (
                  <View
                    key={index}
                    className="flex-row items-center gap-3 bg-muted/50 rounded-lg p-3"
                  >
                    <View className="h-10 w-10 rounded-full bg-primary/20 items-center justify-center">
                      <Text className="text-primary font-bold">
                        {assignment.user?.name?.charAt(0).toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-medium">
                        {assignment.user?.name || "Unknown User"}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {assignment.user?.email || ""}
                      </Text>
                    </View>
                    <View className="bg-primary/10 px-2 py-1 rounded">
                      <Text className="text-primary text-xs font-medium uppercase">
                        {assignment.taskRole}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center py-6">
                <Ionicons name="person-outline" size={32} color="#9ca3af" />
                <Text className="text-muted-foreground text-sm mt-2">
                  No one assigned yet
                </Text>
              </View>
            )}

            {task.assignments.length >= 3 && !isAssigned && (
              <Text className="text-orange-500 text-xs mt-2">
                Maximum 3 users can be assigned to a task
              </Text>
            )}
          </View>

          {/* Progress Bar */}
          {totalSubtasks > 0 && (
            <View className="bg-card border border-border rounded-lg p-4 mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-foreground font-semibold">Progress</Text>
                <Text className="text-muted-foreground text-sm">
                  {completedSubtasks}/{totalSubtasks} completed
                </Text>
              </View>
              <View className="h-2 bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full bg-green-500"
                  style={{ width: `${progress}%` }}
                />
              </View>
            </View>
          )}

          {/* Subtasks Section */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-xl font-bold">
                Subtasks
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddSubtask(true)}
                className="bg-primary px-4 py-2 rounded-lg"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="add" size={20} color="white" />
                  <Text className="text-white font-semibold">Add</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Subtasks List */}
            {subtasks && subtasks.length > 0 ? (
              <View className="gap-2">
                {subtasks.map((subtask) => (
                  <TouchableOpacity
                    key={subtask._id}
                    onPress={() =>
                      handleToggleSubtask(subtask._id, subtask.isCompleted)
                    }
                    className="bg-card border border-border rounded-lg p-4 flex-row items-start gap-3"
                  >
                    <View className="mt-1">
                      <Ionicons
                        name={
                          subtask.isCompleted
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={24}
                        color={subtask.isCompleted ? "#10b981" : "#9ca3af"}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`font-semibold ${
                          subtask.isCompleted
                            ? "text-muted-foreground line-through"
                            : "text-card-foreground"
                        }`}
                      >
                        {(subtask as any).title || subtask.encryptedTitle}
                      </Text>
                      {(subtask.encryptedDescription ||
                        (subtask as any).description) && (
                        <Text className="text-muted-foreground text-sm mt-1">
                          {(subtask as any).description ||
                            subtask.encryptedDescription}
                        </Text>
                      )}
                      {subtask.completedAt && (
                        <Text className="text-green-500 text-xs mt-2">
                          Completed{" "}
                          {new Date(subtask.completedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View className="bg-card border border-border rounded-lg p-8 items-center">
                <Ionicons name="list-outline" size={48} color="#9ca3af" />
                <Text className="text-muted-foreground mt-2">
                  No subtasks yet
                </Text>
                <Text className="text-muted-foreground text-sm text-center mt-1">
                  Break down this task into smaller steps
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Subtask Modal */}
      <Modal
        visible={showAddSubtask}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddSubtask(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => setShowAddSubtask(false)}
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
                    New Subtask
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddSubtask(false);
                      setNewSubtaskTitle("");
                      setNewSubtaskDescription("");
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
                      placeholder="Subtask title"
                      placeholderTextColor="#9ca3af"
                      value={newSubtaskTitle}
                      onChangeText={setNewSubtaskTitle}
                    />
                  </View>

                  <View>
                    <Text className="text-foreground font-medium mb-2">
                      Description
                    </Text>
                    <TextInput
                      className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
                      placeholder="Subtask description"
                      placeholderTextColor="#9ca3af"
                      value={newSubtaskDescription}
                      onChangeText={setNewSubtaskDescription}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <TouchableOpacity
                    className={`py-3 rounded-lg ${
                      newSubtaskTitle.trim() ? "bg-primary" : "bg-muted"
                    }`}
                    onPress={handleCreateSubtask}
                    disabled={!newSubtaskTitle.trim()}
                  >
                    <Text className="text-primary-foreground text-center font-semibold">
                      Create Subtask
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
