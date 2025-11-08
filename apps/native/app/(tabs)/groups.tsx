import { Container } from "@/components/container";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { router } from "expo-router";

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

export default function GroupsScreen() {
  const groups = useQuery(api.groups.myGroups);
  const createGroup = useMutation(api.groups.createGroup);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);

  const onCreate = async () => {
    if (creating || !groupName.trim()) return;
    setCreating(true);
    try {
      await createGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        color: selectedColor,
      });
      setGroupName("");
      setGroupDescription("");
      setSelectedColor(COLORS[0].value);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-3xl font-bold text-foreground">Groups</Text>
            <TouchableOpacity
              className="bg-primary px-4 py-2 rounded-lg"
              onPress={() => setShowCreateModal(true)}
            >
              <Text className="text-primary-foreground font-semibold">New</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-lg text-muted-foreground mb-4">
            Manage your task groups
          </Text>

          <View className="gap-3">
            {groups?.map((g) => (
              <TouchableOpacity
                key={g._id}
                className="bg-card border border-border rounded-xl p-4 flex-row items-center gap-3"
                onPress={() => router.push(`/group/${g._id}`)}
              >
                <View
                  className="h-8 w-1.5 rounded-full"
                  style={{ backgroundColor: g.color || "#94a3b8" }}
                />
                <View className="flex-1">
                  <Text className="text-card-foreground font-semibold">
                    {g.name}
                  </Text>
                  <Text
                    className="text-muted-foreground text-sm"
                    numberOfLines={1}
                  >
                    {g.description || "No description"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ))}
            {groups && groups.length === 0 && (
              <Text className="text-muted-foreground">
                No groups yet. Create one.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
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
                  New Group
                </Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
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
                    placeholder="e.g., Product Development"
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
                    placeholder="What is this group for?"
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
                        <Text className="text-muted-foreground text-xs mt-1">
                          {color.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  className={`py-3 rounded-lg mt-2 ${
                    groupName.trim() ? "bg-primary" : "bg-muted"
                  }`}
                  onPress={onCreate}
                  disabled={!groupName.trim() || creating}
                >
                  <Text className="text-primary-foreground text-center font-semibold">
                    {creating ? "Creating..." : "Create Group"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
}
