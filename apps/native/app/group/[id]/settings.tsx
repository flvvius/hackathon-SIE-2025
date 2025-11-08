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
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Id } from "@coTask/backend/convex/_generated/dataModel";
import { useUser } from "@clerk/clerk-expo";

const COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Orange", value: "#f59e0b" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Slate", value: "#64748b" },
];

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id as Id<"groups">;
  const { user: clerkUser } = useUser();

  const group = useQuery(api.groups.getGroup, { groupId });
  const members = useQuery(api.groups.getMembersWithUserInfo, { groupId });
  const groupsWithStats = useQuery(api.groups.myGroupsWithStats);
  const availableUsers = useQuery(api.groups.getAvailableUsers, { groupId });

  const updateGroup = useMutation(api.groups.updateGroup);
  const addMemberById = useMutation(api.groups.addMemberById);
  const removeMember = useMutation(api.groups.removeMember);
  const updateMemberRole = useMutation(api.groups.updateMemberRole);

  const [showEditModal, setShowEditModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(
    null
  );
  const [newMemberRole, setNewMemberRole] = useState<
    "attendee" | "scrum_master"
  >("attendee");
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);

  // Find current user's role in this group
  const myRole = groupsWithStats?.find((g) => g._id === groupId)?.role;
  const canManageMembers = myRole === "owner" || myRole === "scrum_master";
  const canEditGroup = myRole === "owner";

  const handleEditGroup = () => {
    if (!group) return;
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setSelectedColor(group.color || COLORS[0].value);
    setShowEditModal(true);
  };

  const handleUpdateGroup = async () => {
    if (!groupName.trim() || updating) return;
    setUpdating(true);
    try {
      await updateGroup({
        groupId,
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        color: selectedColor,
      });
      setShowEditModal(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update group");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || adding) return;
    setAdding(true);
    try {
      await addMemberById({
        groupId,
        userId: selectedUserId,
        role: newMemberRole,
      });
      setSelectedUserId(null);
      setNewMemberRole("attendee");
      setUserSearchQuery("");
      setShowAddMemberModal(false);
      Alert.alert("Success", "Member added successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: Id<"users">, userName: string) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${userName} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember({ groupId, userId });
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to remove member");
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = async (
    userId: Id<"users">,
    currentRole: string,
    userName: string
  ) => {
    const roles = [
      { label: "Attendee", value: "attendee" as const },
      { label: "Scrum Master", value: "scrum_master" as const },
      { label: "Owner", value: "owner" as const },
    ];

    Alert.alert("Change Role", `Select new role for ${userName}`, [
      ...roles.map((role) => ({
        text: role.label,
        onPress: async () => {
          if (role.value === currentRole) return;
          try {
            await updateMemberRole({ groupId, userId, newRole: role.value });
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update role");
          }
        },
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "#ef4444";
      case "scrum_master":
        return "#f59e0b";
      default:
        return "#3b82f6";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Owner";
      case "scrum_master":
        return "Scrum Master";
      default:
        return "Attendee";
    }
  };

  // Filter available users based on search query
  const filteredUsers =
    availableUsers?.filter(
      (user) =>
        user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    ) || [];

  const selectedUser = availableUsers?.find((u) => u._id === selectedUserId);

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          {/* Header */}
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground flex-1">
              Group Settings
            </Text>
          </View>

          {/* Group Info Section */}
          <View className="bg-card border border-border rounded-xl p-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground text-lg font-semibold">
                Group Details
              </Text>
              {canEditGroup && (
                <TouchableOpacity onPress={handleEditGroup}>
                  <Ionicons name="pencil" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row items-start gap-3">
              <View
                className="h-12 w-1.5 rounded-full"
                style={{ backgroundColor: group?.color || "#94a3b8" }}
              />
              <View className="flex-1">
                <Text className="text-card-foreground font-semibold text-lg">
                  {group?.name}
                </Text>
                {group?.description && (
                  <Text className="text-muted-foreground mt-1">
                    {group.description}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Members Section */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground text-lg font-semibold">
                Members ({members?.length || 0})
              </Text>
              {canManageMembers && (
                <TouchableOpacity
                  className="bg-primary px-4 py-2 rounded-lg"
                  onPress={() => setShowAddMemberModal(true)}
                >
                  <Text className="text-primary-foreground font-semibold text-sm">
                    Add Member
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="gap-3">
              {members?.map((member) => (
                <View
                  key={member._id}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-card-foreground font-semibold">
                        {member.user.name}
                        {member.user.email ===
                          clerkUser?.emailAddresses[0].emailAddress && " (You)"}
                      </Text>
                      <Text className="text-muted-foreground text-sm">
                        {member.user.email}
                      </Text>
                      <View className="mt-2">
                        <View
                          className="px-2 py-1 rounded self-start"
                          style={{
                            backgroundColor:
                              getRoleBadgeColor(member.role) + "20",
                          }}
                        >
                          <Text
                            className="text-xs font-medium uppercase"
                            style={{ color: getRoleBadgeColor(member.role) }}
                          >
                            {getRoleLabel(member.role)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {canManageMembers && myRole === "owner" && (
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          className="p-2"
                          onPress={() =>
                            handleChangeRole(
                              member.userId,
                              member.role,
                              member.user.name
                            )
                          }
                        >
                          <Ionicons
                            name="swap-horizontal"
                            size={20}
                            color="#6b7280"
                          />
                        </TouchableOpacity>
                        {member.user.email !==
                          clerkUser?.emailAddresses[0].emailAddress && (
                          <TouchableOpacity
                            className="p-2"
                            onPress={() =>
                              handleRemoveMember(
                                member.userId,
                                member.user.name
                              )
                            }
                          >
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color="#ef4444"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    {myRole === "scrum_master" &&
                      member.role === "attendee" &&
                      member.user.email !==
                        clerkUser?.emailAddresses[0].emailAddress && (
                        <TouchableOpacity
                          className="p-2"
                          onPress={() =>
                            handleRemoveMember(member.userId, member.user.name)
                          }
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {!canManageMembers && (
            <View className="bg-card border border-border rounded-xl p-4">
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#9ca3af"
                />
                <Text className="text-muted-foreground text-sm flex-1">
                  You need to be an owner or scrum master to manage members
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Group Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <ScrollView
              className="bg-background rounded-t-3xl p-6 pb-8"
              keyboardShouldPersistTaps="handled"
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-foreground text-xl font-bold">
                  Edit Group
                </Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View className="gap-4">
                <View>
                  <Text className="text-foreground font-medium mb-2">
                    Group Name *
                  </Text>
                  <TextInput
                    className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Group name"
                    placeholderTextColor="#9ca3af"
                    value={groupName}
                    onChangeText={setGroupName}
                  />
                </View>

                <View>
                  <Text className="text-foreground font-medium mb-2">
                    Description
                  </Text>
                  <TextInput
                    className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Group description"
                    placeholderTextColor="#9ca3af"
                    value={groupDescription}
                    onChangeText={setGroupDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View>
                  <Text className="text-foreground font-medium mb-2">
                    Color
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    {COLORS.map((color) => (
                      <TouchableOpacity
                        key={color.value}
                        className="items-center"
                        onPress={() => setSelectedColor(color.value)}
                      >
                        <View
                          className="h-12 w-12 rounded-full items-center justify-center"
                          style={{ backgroundColor: color.value }}
                        >
                          {selectedColor === color.value && (
                            <Ionicons
                              name="checkmark"
                              size={24}
                              color="white"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  className={`py-3 rounded-lg mt-2 ${
                    groupName.trim() ? "bg-primary" : "bg-muted"
                  }`}
                  onPress={handleUpdateGroup}
                  disabled={!groupName.trim() || updating}
                >
                  <Text className="text-primary-foreground text-center font-semibold">
                    {updating ? "Updating..." : "Update Group"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddMemberModal(false);
          setSelectedUserId(null);
          setUserSearchQuery("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => {
              setShowAddMemberModal(false);
              setSelectedUserId(null);
              setUserSearchQuery("");
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View className="bg-background rounded-t-3xl p-6 pb-8">
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-foreground text-xl font-bold">
                    Add Member
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddMemberModal(false);
                      setSelectedUserId(null);
                      setUserSearchQuery("");
                    }}
                  >
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {/* User Search and List */}
                <View className="mb-4">
                  <Text className="text-foreground font-medium mb-2">
                    Select User *
                  </Text>

                  <View className="mb-3">
                    <TextInput
                      className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
                      placeholder="Search by name or email..."
                      placeholderTextColor="#9ca3af"
                      value={userSearchQuery}
                      onChangeText={setUserSearchQuery}
                    />
                  </View>

                  <FlatList
                    data={filteredUsers}
                    keyExtractor={(item) => item._id}
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 250 }}
                    contentContainerStyle={{ paddingBottom: 10 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        className={`border rounded-lg p-4 mb-2 ${
                          selectedUserId === item._id
                            ? "bg-primary/10 border-primary"
                            : "bg-card border-border"
                        }`}
                        onPress={() => {
                          setSelectedUserId(item._id);
                        }}
                      >
                        <View className="flex-row items-center gap-3">
                          <View className="h-10 w-10 rounded-full bg-primary/20 items-center justify-center">
                            <Text className="text-primary font-semibold">
                              {item.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-card-foreground font-semibold">
                              {item.name}
                            </Text>
                            <Text className="text-muted-foreground text-sm">
                              {item.email}
                            </Text>
                          </View>
                          {selectedUserId === item._id && (
                            <Ionicons
                              name="checkmark-circle"
                              size={24}
                              color="#6366f1"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View className="py-8 items-center">
                        <Ionicons
                          name="people-outline"
                          size={48}
                          color="#9ca3af"
                        />
                        <Text className="text-muted-foreground mt-2">
                          {availableUsers?.length === 0
                            ? "All users are already members"
                            : "No users found"}
                        </Text>
                      </View>
                    }
                  />
                </View>

                {/* Role Selection */}
                <View className="mb-4">
                  <Text className="text-foreground font-medium mb-2">Role</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-lg border ${
                        newMemberRole === "attendee"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                      onPress={() => setNewMemberRole("attendee")}
                    >
                      <Text
                        className={`text-center text-sm font-medium ${
                          newMemberRole === "attendee"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        Attendee
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-lg border ${
                        newMemberRole === "scrum_master"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                      onPress={() => setNewMemberRole("scrum_master")}
                    >
                      <Text
                        className={`text-center text-sm font-medium ${
                          newMemberRole === "scrum_master"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        Scrum Master
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Add Button */}
                <TouchableOpacity
                  className={`py-3 rounded-lg ${
                    selectedUserId ? "bg-primary" : "bg-muted"
                  }`}
                  onPress={handleAddMember}
                  disabled={!selectedUserId || adding}
                >
                  <Text className="text-primary-foreground text-center font-semibold">
                    {adding ? "Adding..." : "Add Member"}
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
