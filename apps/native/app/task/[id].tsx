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

  const taskWithFlow = useQuery(api.tasks.getTaskWithFlow, { taskId });

  // Get groupId from taskWithFlow if not provided in params
  const actualGroupId = groupId || taskWithFlow?.groupId;

  const tasks = useQuery(
    api.tasks.listByGroup,
    actualGroupId ? { groupId: actualGroupId as Id<"groups"> } : "skip"
  );
  const task = tasks?.find((t) => t._id === taskId);
  const subtasks = useQuery(api.subtasks.list, { parentTaskId: taskId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const groupMembers = useQuery(
    api.groups.getMembersWithUserInfo,
    actualGroupId ? { groupId: actualGroupId as Id<"groups"> } : "skip"
  );

  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("");
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [selectedDelegateUser, setSelectedDelegateUser] =
    useState<Id<"users"> | null>(null);

  const createSubtask = useMutation(api.subtasks.create);
  const toggleSubtaskComplete = useMutation(api.subtasks.toggleComplete);
  const toggleSelfAssignment = useMutation(api.tasks.toggleSelfAssignment);
  const delegateTask = useMutation(api.tasks.delegateTask);

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

  const handleDelegateTask = async () => {
    if (!selectedDelegateUser) {
      Alert.alert(
        "No User Selected",
        "Please select a user to delegate this task to."
      );
      return;
    }

    try {
      await delegateTask({
        taskId,
        assignToUserId: selectedDelegateUser,
      });
      setShowDelegateModal(false);
      setSelectedDelegateUser(null);
      Alert.alert(
        "Task Delegated",
        "The task has been successfully delegated."
      );
    } catch (error: any) {
      console.error("Error delegating task:", error);

      // Close modal first to show alert properly
      setShowDelegateModal(false);
      setSelectedDelegateUser(null);

      // Parse error message and show user-friendly alerts
      const errorMessage = error?.message || error?.data?.message || "";

      if (
        errorMessage.includes("already assigned to this user") ||
        errorMessage.includes("Task is already assigned")
      ) {
        Alert.alert(
          "Already Assigned",
          "This task is currently assigned to the selected user. Please choose a different user."
        );
      } else if (
        errorMessage.includes("already been assigned this task") ||
        errorMessage.includes("has already been assigned")
      ) {
        Alert.alert(
          "Duplicate Delegation",
          "This user has already been assigned this task previously in the delegation chain. Please choose a different user."
        );
      } else if (
        errorMessage.includes("Maximum delegation limit") ||
        errorMessage.includes("maximum number of delegations")
      ) {
        Alert.alert(
          "Delegation Limit Reached",
          "This task has reached the maximum number of delegations (3). No further delegations are allowed."
        );
      } else if (errorMessage.includes("not a member of this group")) {
        Alert.alert(
          "Invalid User",
          "The selected user is not a member of this group."
        );
      } else if (errorMessage.includes("Attendees cannot delegate")) {
        Alert.alert(
          "Permission Denied",
          "Attendees do not have permission to delegate tasks."
        );
      } else if (
        errorMessage.includes("currently assigned to them") ||
        errorMessage.includes("only delegate tasks that are")
      ) {
        Alert.alert(
          "Not Assigned to You",
          "As a Scrum Master, you can only delegate tasks that are currently assigned to you."
        );
      } else if (errorMessage.includes("only delegate to attendees")) {
        Alert.alert(
          "Invalid Delegation",
          "Scrum Masters can only delegate tasks to Attendees."
        );
      } else if (errorMessage.includes("Cannot delegate to another owner")) {
        Alert.alert(
          "Invalid Delegation",
          "Tasks cannot be delegated to another Owner."
        );
      } else if (errorMessage.includes("Not authenticated")) {
        Alert.alert(
          "Authentication Error",
          "You must be signed in to delegate tasks. Please sign in and try again."
        );
      } else if (errorMessage.includes("Task not found")) {
        Alert.alert(
          "Task Not Found",
          "This task no longer exists or has been deleted."
        );
      } else {
        // Generic error for unexpected cases
        // Clean up the error message by removing technical details
        let cleanMessage = errorMessage;

        // Remove Convex error prefix if present
        if (cleanMessage.includes("Uncaught Error:")) {
          cleanMessage =
            cleanMessage.split("Uncaught Error:")[1]?.trim() || cleanMessage;
        }

        // Remove "at handler" and everything after
        if (cleanMessage.includes("at handler")) {
          cleanMessage =
            cleanMessage.split("at handler")[0]?.trim() || cleanMessage;
        }

        Alert.alert(
          "Delegation Failed",
          cleanMessage ||
            "An unexpected error occurred while delegating the task. Please try again."
        );
      }
    }
  };

  const handleOpenDelegateModal = () => {
    // Validate before opening modal
    if (delegationLimitReached) {
      Alert.alert(
        "Delegation Limit Reached",
        "This task has reached the maximum number of delegations (3). No further delegations are allowed."
      );
      return;
    }

    if (myRole === "scrum_master" && !isCurrentAssignee) {
      Alert.alert(
        "Not Assigned to You",
        "As a Scrum Master, you can only delegate tasks that are currently assigned to you."
      );
      return;
    }

    if (!availableForDelegation || availableForDelegation.length === 0) {
      Alert.alert(
        "No Available Users",
        "There are no users available to delegate this task to. All eligible members have already been assigned this task."
      );
      return;
    }

    setShowDelegateModal(true);
  };

  // Get current user's role in the group
  const myMembership = groupMembers?.find((m) => m.userId === currentUser?._id);
  const myRole = myMembership?.role;

  // Check if task is currently assigned to the current user
  const isCurrentAssignee = taskWithFlow?.currentAssignee === currentUser?._id;

  // Determine if user can delegate:
  // - Owners can always delegate (unless limit reached)
  // - Scrum Masters can only delegate if task is currently assigned to them
  const canDelegate =
    myRole === "owner" || (myRole === "scrum_master" && isCurrentAssignee);

  // Check if delegation limit reached (max 3 delegations)
  const delegationCount = taskWithFlow?.assignmentChain?.length || 0;
  const delegationLimitReached = delegationCount >= 3;

  // Get list of users who already received this task
  const usersInChain = new Set([
    taskWithFlow?.creatorId, // Creator
    ...(taskWithFlow?.assignmentChain?.map((entry: any) => entry.assignedTo) ||
      []),
  ]);

  // Filter users for delegation based on current user's role
  const availableForDelegation = groupMembers?.filter((member) => {
    if (member.userId === currentUser?._id) return false; // Can't delegate to self
    if (usersInChain.has(member.userId)) return false; // Can't delegate to someone already in chain

    if (myRole === "owner") {
      // Owners can delegate to scrum masters or attendees
      return member.role === "scrum_master" || member.role === "attendee";
    }
    if (myRole === "scrum_master") {
      // Scrum masters can only delegate to attendees
      return member.role === "attendee";
    }
    return false;
  });

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

          {/* Assignment Flow Section */}
          {taskWithFlow && (
            <View className="bg-card border border-border rounded-lg p-4 mb-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-foreground font-semibold text-lg">
                  Assignment Flow
                </Text>
                {/* Debug: Show role info */}
                <View className="flex-row items-center gap-2">
                  {myRole && (
                    <View className="bg-muted px-2 py-1 rounded">
                      <Text className="text-xs text-foreground">
                        Role: {myRole}
                      </Text>
                    </View>
                  )}
                  {canDelegate && !delegationLimitReached && (
                    <TouchableOpacity
                      onPress={handleOpenDelegateModal}
                      className="bg-primary px-3 py-1.5 rounded-lg"
                    >
                      <Text className="text-white text-xs font-semibold">
                        Delegate
                      </Text>
                    </TouchableOpacity>
                  )}
                  {canDelegate && delegationLimitReached && (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Delegation Limit Reached",
                          "This task has reached the maximum number of delegations (3). No further delegations are allowed."
                        );
                      }}
                    >
                      <View className="bg-muted px-3 py-1.5 rounded-lg">
                        <Text className="text-muted-foreground text-xs font-semibold">
                          Max Delegations
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {myRole === "scrum_master" && !isCurrentAssignee && (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Not Assigned to You",
                          "As a Scrum Master, you can only delegate tasks that are currently assigned to you. This task must be delegated to you first before you can delegate it further."
                        );
                      }}
                    >
                      <View className="bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/30">
                        <Text className="text-orange-600 text-xs font-semibold">
                          Not Assigned to You
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Creator */}
              <View className="flex-row items-start gap-3 mb-3">
                <View className="items-center">
                  <View className="h-12 w-12 rounded-full bg-green-500/20 items-center justify-center">
                    <Ionicons name="person-add" size={20} color="#10b981" />
                  </View>
                  {(taskWithFlow.assignmentChainWithUsers?.length ?? 0) > 0 && (
                    <View className="h-8 w-0.5 bg-border my-1" />
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-green-600 font-semibold text-xs uppercase">
                      Created by
                    </Text>
                    <View className="px-2 py-0.5 bg-red-500/20 rounded">
                      <Text className="text-red-600 text-xs font-semibold">
                        Owner
                      </Text>
                    </View>
                  </View>
                  <Text className="text-foreground font-medium">
                    {taskWithFlow.creator?.name || "Unknown"}
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    {taskWithFlow.creator?.email || ""}
                  </Text>
                  <Text className="text-muted-foreground text-xs mt-1">
                    {new Date(taskWithFlow.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Assignment Chain */}
              {taskWithFlow.assignmentChainWithUsers &&
                taskWithFlow.assignmentChainWithUsers.map(
                  (entry: any, index: number) => (
                    <View
                      key={index}
                      className="flex-row items-start gap-3 mb-3"
                    >
                      <View className="items-center">
                        <View className="h-12 w-12 rounded-full bg-blue-500/20 items-center justify-center">
                          <Ionicons
                            name="arrow-forward"
                            size={20}
                            color="#3b82f6"
                          />
                        </View>
                        {index <
                          (taskWithFlow.assignmentChainWithUsers?.length ?? 0) -
                            1 && <View className="h-8 w-0.5 bg-border my-1" />}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="text-blue-600 font-semibold text-xs uppercase">
                            Delegated to
                          </Text>
                          <View
                            className={`px-2 py-0.5 rounded ${
                              entry.assigneeRole === "scrum_master"
                                ? "bg-orange-500/20"
                                : "bg-blue-500/20"
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                entry.assigneeRole === "scrum_master"
                                  ? "text-orange-600"
                                  : "text-blue-600"
                              }`}
                            >
                              {entry.assigneeRole === "scrum_master"
                                ? "Scrum Master"
                                : "Attendee"}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-foreground font-medium">
                          {entry.assignedToUser?.name || "Unknown"}
                        </Text>
                        <Text className="text-muted-foreground text-xs">
                          {entry.assignedToUser?.email || ""}
                        </Text>
                        <Text className="text-muted-foreground text-xs mt-1">
                          By {entry.assignedByUser?.name || "Unknown"} •{" "}
                          {new Date(entry.timestamp).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  )
                )}

              {/* Current Assignee Badge */}
              {taskWithFlow.currentAssigneeUser && (
                <View className="mt-2 p-3 bg-primary/10 border border-primary rounded-lg">
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#6366f1"
                    />
                    <Text className="text-primary font-semibold">
                      Currently assigned to:{" "}
                      {taskWithFlow.currentAssigneeUser.name}
                    </Text>
                  </View>
                </View>
              )}

              {(!taskWithFlow.assignmentChainWithUsers ||
                taskWithFlow.assignmentChainWithUsers.length === 0) && (
                <Text className="text-muted-foreground text-sm italic mt-2">
                  No delegation history yet. Task created by{" "}
                  {taskWithFlow.creator?.name || "Unknown"}.
                </Text>
              )}
            </View>
          )}

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

      {/* Delegate Task Modal */}
      <Modal
        visible={showDelegateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDelegateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => setShowDelegateModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View className="bg-background rounded-t-3xl pt-6 px-6 pb-8 max-h-[80%]">
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-foreground text-xl font-bold">
                    Delegate Task
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDelegateModal(false);
                      setSelectedDelegateUser(null);
                    }}
                  >
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <Text className="text-muted-foreground mb-4">
                  {myRole === "owner"
                    ? "Select a Scrum Master or Attendee to delegate this task to:"
                    : myRole === "scrum_master" && isCurrentAssignee
                      ? "Select an Attendee to delegate this task to:"
                      : "You can only delegate tasks that are assigned to you."}
                </Text>

                <ScrollView
                  className="mb-4"
                  showsVerticalScrollIndicator={false}
                >
                  <View className="gap-2">
                    {availableForDelegation?.map((member) => (
                      <TouchableOpacity
                        key={member.userId}
                        className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                          selectedDelegateUser === member.userId
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card"
                        }`}
                        onPress={() => setSelectedDelegateUser(member.userId)}
                      >
                        <View className="h-10 w-10 rounded-full bg-primary/20 items-center justify-center">
                          <Text className="text-primary font-bold">
                            {member.user.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-foreground font-medium">
                            {member.user.name}
                          </Text>
                          <Text className="text-muted-foreground text-xs">
                            {member.user.email}
                          </Text>
                          <View
                            className={`mt-1 px-2 py-0.5 rounded self-start ${
                              member.role === "scrum_master"
                                ? "bg-orange-500/20"
                                : "bg-blue-500/20"
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                member.role === "scrum_master"
                                  ? "text-orange-600"
                                  : "text-blue-600"
                              }`}
                            >
                              {member.role === "scrum_master"
                                ? "Scrum Master"
                                : "Attendee"}
                            </Text>
                          </View>
                        </View>
                        {selectedDelegateUser === member.userId && (
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color="#6366f1"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                    {(!availableForDelegation ||
                      availableForDelegation.length === 0) && (
                      <View className="bg-card border border-border rounded-lg p-4">
                        <Text className="text-muted-foreground text-center">
                          No members available for delegation
                        </Text>
                        <Text className="text-muted-foreground text-xs text-center mt-2">
                          {delegationLimitReached
                            ? "Maximum delegation limit reached (3 max)"
                            : "All eligible members have already been assigned this task"}
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  className={`py-3 rounded-lg ${
                    selectedDelegateUser ? "bg-primary" : "bg-muted"
                  }`}
                  onPress={handleDelegateTask}
                  disabled={!selectedDelegateUser}
                >
                  <Text className="text-primary-foreground text-center font-semibold">
                    Delegate Task
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
}
