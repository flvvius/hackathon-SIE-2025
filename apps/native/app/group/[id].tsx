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
import DateTimePicker from "@react-native-community/datetimepicker";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id as Id<"groups">;
  const { user: clerkUser } = useUser();

  const tasks = useQuery(api.tasks.listByGroup, { groupId });
  const statuses = useQuery(api.tasks.getStatuses, { groupId });
  const group = useQuery(api.groups.getGroup, { groupId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const groupMembers = useQuery(api.groups.getMembersWithUserInfo, { groupId });

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [newTaskDeadline, setNewTaskDeadline] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Search and pagination states per column
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>(
    {}
  );
  const [tasksPerPage] = useState(5); // Show 5 tasks per page per column
  const [currentPages, setCurrentPages] = useState<Record<string, number>>({});

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
        deadline: newTaskDeadline ? newTaskDeadline.getTime() : undefined,
      });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setNewTaskDeadline(undefined);
      setShowCreateTask(false);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const filterTasks = (statusTasks: any[], statusId: string) => {
    const query = searchQueries[statusId]?.toLowerCase() || "";
    if (!query) return statusTasks;

    return statusTasks.filter((task) => {
      const title = ((task as any).title || task.encryptedTitle).toLowerCase();
      const description = (
        (task as any).description ||
        task.encryptedDescription ||
        ""
      ).toLowerCase();
      const assigneeNames = task.assignments
        .map((a: any) => a.user?.name?.toLowerCase() || "")
        .join(" ");

      return (
        title.includes(query) ||
        description.includes(query) ||
        assigneeNames.includes(query)
      );
    });
  };

  const paginateTasks = (filteredTasks: any[], statusId: string) => {
    const page = currentPages[statusId] || 1;
    const startIndex = (page - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    return filteredTasks.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalTasks: number) => {
    return Math.ceil(totalTasks / tasksPerPage);
  };

  const setSearchQuery = (statusId: string, query: string) => {
    setSearchQueries((prev) => ({ ...prev, [statusId]: query }));
    // Reset to page 1 when searching
    setCurrentPages((prev) => ({ ...prev, [statusId]: 1 }));
  };

  const setCurrentPage = (statusId: string, page: number) => {
    setCurrentPages((prev) => ({ ...prev, [statusId]: page }));
  };

  // Get current user's role in the group
  const myMembership = groupMembers?.find((m) => m.userId === currentUser?._id);
  const myRole = myMembership?.role;

  // Filter tasks based on user role
  const getVisibleTasks = () => {
    if (!tasks) return [];

    // Owners and Scrum Masters can see all tasks
    if (myRole === "owner" || myRole === "scrum_master") {
      return tasks;
    }

    // Attendees can only see tasks delegated to them
    if (myRole === "attendee" && currentUser) {
      return tasks.filter((task) => task.currentAssignee === currentUser._id);
    }

    // Default: show no tasks if role is not determined
    return [];
  };

  const visibleTasks = getVisibleTasks();

  const tasksByStatus =
    statuses?.map((status) => ({
      status,
      tasks: visibleTasks?.filter((t) => t.statusId === status._id) || [],
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

          {/* Create Task Button - Only for Owners and Scrum Masters */}
          {(myRole === "owner" || myRole === "scrum_master") && (
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
          )}

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
              ({ status, tasks: statusTasks }, statusIndex) => {
                const filteredTasks = filterTasks(statusTasks, status._id);
                const paginatedTasks = paginateTasks(filteredTasks, status._id);
                const totalPages = getTotalPages(filteredTasks.length);
                const currentPage = currentPages[status._id] || 1;
                const hasSearch = statusTasks.length > tasksPerPage;

                return (
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
                        ({filteredTasks.length}
                        {searchQueries[status._id] &&
                          ` of ${statusTasks.length}`}
                        )
                      </Text>
                    </View>

                    {/* Search Bar */}
                    {hasSearch && (
                      <View className="mb-3 ml-5">
                        <View className="bg-card border border-border rounded-lg px-4 py-2 flex-row items-center gap-2">
                          <Ionicons name="search" size={16} color="#9ca3af" />
                          <TextInput
                            className="flex-1 text-foreground"
                            placeholder="Search tasks..."
                            placeholderTextColor="#9ca3af"
                            value={searchQueries[status._id] || ""}
                            onChangeText={(text) =>
                              setSearchQuery(status._id, text)
                            }
                          />
                          {searchQueries[status._id] && (
                            <TouchableOpacity
                              onPress={() => setSearchQuery(status._id, "")}
                            >
                              <Ionicons
                                name="close-circle"
                                size={16}
                                color="#9ca3af"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}

                    <View className="gap-2">
                      {filteredTasks.length === 0 &&
                        !searchQueries[status._id] && (
                          <Text className="text-muted-foreground text-sm italic ml-5">
                            No tasks
                          </Text>
                        )}
                      {filteredTasks.length === 0 &&
                        searchQueries[status._id] && (
                          <Text className="text-muted-foreground text-sm italic ml-5">
                            No tasks match your search
                          </Text>
                        )}
                      {paginatedTasks.map((task) => (
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

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <View className="flex-row items-center justify-center gap-2 mt-3 ml-5">
                        <TouchableOpacity
                          className={`px-3 py-1 rounded-lg ${
                            currentPage === 1 ? "bg-muted" : "bg-primary"
                          }`}
                          onPress={() =>
                            setCurrentPage(status._id, currentPage - 1)
                          }
                          disabled={currentPage === 1}
                        >
                          <Ionicons
                            name="chevron-back"
                            size={16}
                            color={currentPage === 1 ? "#9ca3af" : "white"}
                          />
                        </TouchableOpacity>

                        <Text className="text-muted-foreground text-sm">
                          Page {currentPage} of {totalPages}
                        </Text>

                        <TouchableOpacity
                          className={`px-3 py-1 rounded-lg ${
                            currentPage === totalPages
                              ? "bg-muted"
                              : "bg-primary"
                          }`}
                          onPress={() =>
                            setCurrentPage(status._id, currentPage + 1)
                          }
                          disabled={currentPage === totalPages}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={
                              currentPage === totalPages ? "#9ca3af" : "white"
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }
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
              setNewTaskDeadline(undefined);
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
                      setNewTaskDeadline(undefined);
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

                  <View>
                    <Text className="text-foreground font-medium mb-2">
                      Deadline
                    </Text>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className="flex-1 bg-card border border-border rounded-lg px-4 py-3 flex-row items-center justify-between"
                        onPress={() => {
                          if (!newTaskDeadline) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            setNewTaskDeadline(tomorrow);
                          }
                          setShowDatePicker(true);
                        }}
                      >
                        <Text className="text-foreground">
                          {newTaskDeadline
                            ? newTaskDeadline.toLocaleDateString()
                            : "No deadline"}
                        </Text>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                      {newTaskDeadline && (
                        <TouchableOpacity
                          className="bg-red-500/10 border border-red-500 rounded-lg px-4 py-3"
                          onPress={() => setNewTaskDeadline(undefined)}
                        >
                          <Ionicons name="close" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View className="flex-row gap-2 mt-2">
                      <TouchableOpacity
                        className="flex-1 bg-muted rounded-lg px-3 py-2"
                        onPress={() => {
                          const today = new Date();
                          today.setHours(23, 59, 59, 999);
                          setNewTaskDeadline(today);
                        }}
                      >
                        <Text className="text-foreground text-center text-xs">
                          Today
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-muted rounded-lg px-3 py-2"
                        onPress={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          tomorrow.setHours(23, 59, 59, 999);
                          setNewTaskDeadline(tomorrow);
                        }}
                      >
                        <Text className="text-foreground text-center text-xs">
                          Tomorrow
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-muted rounded-lg px-3 py-2"
                        onPress={() => {
                          const nextWeek = new Date();
                          nextWeek.setDate(nextWeek.getDate() + 7);
                          nextWeek.setHours(23, 59, 59, 999);
                          setNewTaskDeadline(nextWeek);
                        }}
                      >
                        <Text className="text-foreground text-center text-xs">
                          Next Week
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Date Picker */}
                    {showDatePicker && (
                      <DateTimePicker
                        value={newTaskDeadline || new Date()}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={(event, selectedDate) => {
                          if (Platform.OS === "android") {
                            setShowDatePicker(false);
                          }
                          if (event.type === "set" && selectedDate) {
                            selectedDate.setHours(23, 59, 59, 999);
                            setNewTaskDeadline(selectedDate);
                            if (Platform.OS === "ios") {
                              setShowDatePicker(false);
                            }
                          } else if (event.type === "dismissed") {
                            setShowDatePicker(false);
                          }
                        }}
                        minimumDate={new Date()}
                      />
                    )}
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
