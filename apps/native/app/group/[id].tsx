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
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");

  // Subtask states
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("");

  console.log("showAddSubtask:", showAddSubtask);
  console.log("showTaskDetail:", showTaskDetail);

  const subtasks = useQuery(
    api.subtasks.list,
    selectedTask ? { parentTaskId: selectedTask._id } : "skip"
  );

  const createTask = useMutation(api.tasks.createSimple);
  const updateTaskStatus = useMutation(api.tasks.updateStatus);
  const createSubtask = useMutation(api.subtasks.create);
  const toggleSubtaskComplete = useMutation(api.subtasks.toggleComplete);

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
    try {
      await updateTaskStatus({ taskId, statusId: newStatus._id });
    } catch (error) {
      console.error("Error moving task:", error);
    }
  };

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim() || !selectedTask) return;

    try {
      await createSubtask({
        parentTaskId: selectedTask._id,
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

  const completedSubtasks = subtasks?.filter((s) => s.isCompleted).length || 0;
  const totalSubtasks = subtasks?.length || 0;
  const progress =
    totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

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
                          setSelectedTask(task);
                          setShowTaskDetail(true);
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

      {/* Task Detail Modal with Subtasks */}
      <Modal
        visible={showTaskDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTaskDetail(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => setShowTaskDetail(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                className="bg-background rounded-t-3xl pt-6 px-6 pb-8"
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: "90%" }}
              >
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-foreground text-2xl font-bold flex-1">
                    Task Details
                  </Text>
                  <TouchableOpacity onPress={() => setShowTaskDetail(false)}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {selectedTask && (
                  <>
                    {/* Task Info */}
                    <View className="bg-card border border-border rounded-lg p-4 mb-4">
                      <View className="flex-row items-start justify-between mb-3">
                        <Text className="text-card-foreground font-bold text-lg flex-1">
                          {(selectedTask as any).title ||
                            selectedTask.encryptedTitle}
                        </Text>
                        <View
                          className="px-3 py-1 rounded-lg"
                          style={{
                            backgroundColor:
                              (priorityColors as any)[selectedTask.priority] +
                              "20",
                          }}
                        >
                          <Text
                            className="text-xs font-semibold uppercase"
                            style={{
                              color: (priorityColors as any)[
                                selectedTask.priority
                              ],
                            }}
                          >
                            {selectedTask.priority}
                          </Text>
                        </View>
                      </View>

                      {(selectedTask.encryptedDescription ||
                        (selectedTask as any).description) && (
                        <Text className="text-muted-foreground mb-4">
                          {(selectedTask as any).description ||
                            selectedTask.encryptedDescription}
                        </Text>
                      )}

                      <View className="flex-row items-center gap-4">
                        {selectedTask.deadline && (
                          <View className="flex-row items-center gap-2">
                            <Ionicons
                              name="calendar-outline"
                              size={16}
                              color="#9ca3af"
                            />
                            <Text className="text-muted-foreground text-sm">
                              {new Date(
                                selectedTask.deadline
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                        {selectedTask.assignments.length > 0 && (
                          <View className="flex-row items-center gap-2">
                            <Ionicons
                              name="people-outline"
                              size={16}
                              color="#9ca3af"
                            />
                            <Text className="text-muted-foreground text-sm">
                              {selectedTask.assignments.length} assigned
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Progress Bar */}
                    {totalSubtasks > 0 && (
                      <View className="bg-card border border-border rounded-lg p-4 mb-4">
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-foreground font-semibold">
                            Progress
                          </Text>
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
                    <View>
                      <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-foreground text-xl font-bold">
                          Subtasks
                        </Text>
                        <TouchableOpacity
                          onPressIn={() => {
                            console.log("Add button pressed!");
                            setShowAddSubtask(true);
                          }}
                          className="bg-primary px-4 py-2 rounded-lg"
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="add" size={20} color="white" />
                            <Text className="text-white font-semibold">
                              Add
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {subtasks && subtasks.length > 0 ? (
                        <View className="gap-2">
                          {subtasks.map((subtask) => (
                            <TouchableOpacity
                              key={subtask._id}
                              onPress={() =>
                                handleToggleSubtask(
                                  subtask._id,
                                  subtask.isCompleted
                                )
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
                                  color={
                                    subtask.isCompleted ? "#10b981" : "#9ca3af"
                                  }
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
                                  {(subtask as any).title ||
                                    subtask.encryptedTitle}
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
                                    {new Date(
                                      subtask.completedAt
                                    ).toLocaleDateString()}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <View className="bg-card border border-border rounded-lg p-8 items-center">
                          <Ionicons
                            name="list-outline"
                            size={48}
                            color="#9ca3af"
                          />
                          <Text className="text-muted-foreground mt-2">
                            No subtasks yet
                          </Text>
                          <Text className="text-muted-foreground text-sm text-center mt-1">
                            Break down this task into smaller steps
                          </Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Subtask Modal */}
      {showAddSubtask && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          justifyContent: 'flex-end',
        }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowAddSubtask(false)}
            >
              <View style={{ flex: 1 }} />
            </TouchableOpacity>
            
            <View className="bg-background rounded-t-3xl pt-6 px-6 pb-8" style={{ maxHeight: '80%' }}>
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

              <ScrollView keyboardShouldPersistTaps="handled">
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
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </Container>
  );
}
