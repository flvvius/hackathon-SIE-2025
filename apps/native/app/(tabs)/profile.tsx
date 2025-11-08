import { Container } from "@/components/container";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@coTask/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useColorScheme } from "@/lib/use-color-scheme";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SignOutButton } from "@/components/sign-out-button";

export default function ProfileScreen() {
  const { user } = useUser();
  const { isDarkColorScheme } = useColorScheme();
  const [isEditing, setIsEditing] = useState(false);

  // Ensure user exists in Convex
  const upsert = useMutation(api.users.upsertCurrentUser);
  React.useEffect(() => {
    upsert().catch(() => {});
  }, []);

  const me = useQuery(api.users.getCurrentUser) || undefined;
  const update = useMutation(api.users.updateProfile);

  const profileImage = user?.imageUrl || me?.profilePicture || "";
  const email = user?.emailAddresses[0]?.emailAddress || me?.email || "";
  const username = useMemo(() => {
    return (
      user?.username || user?.firstName || email.split("@")[0] || "User"
    );
  }, [user, email]);
  const fullName = me?.name || user?.fullName || username;

  const [description, setDescription] = useState(me?.description || "");
  const [contact, setContact] = useState(me?.contact || email);

  React.useEffect(() => {
    setDescription(me?.description || "");
    setContact(me?.contact || email);
  }, [me?.description, me?.contact, email]);

  const handleSave = async () => {
    try {
      await update({ description, contact, name: fullName });
      setIsEditing(false);
      Alert.alert("Saved", "Profile updated successfully");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update profile");
    }
  };

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4 pt-6 pb-4 flex-row items-center justify-between">
          <Text className="text-3xl font-bold text-foreground">Profile</Text>
          <TouchableOpacity
            onPress={() => (isEditing ? handleSave() : setIsEditing(true))}
            className="bg-primary px-4 py-2 rounded-lg"
          >
            <Text className="text-primary-foreground font-semibold">
              {isEditing ? "Save" : "Edit"}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="items-center px-4 py-6">
          <View className="relative">
            {profileImage ? (
              <Image source={{ uri: profileImage }} className="w-32 h-32 rounded-full" />
            ) : (
              <View className="w-32 h-32 rounded-full bg-primary items-center justify-center">
                <Text className="text-primary-foreground text-4xl font-bold">
                  {username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text className="text-2xl font-bold text-foreground mt-4">{fullName}</Text>
          <Text className="text-muted-foreground">@{username}</Text>
        </View>

        <View className="px-4 space-y-4">
          <View className="bg-card border border-border rounded-xl p-4">
            <View className="flex-row items-center gap-3 mb-2">
              <Ionicons
                name="mail-outline"
                size={20}
                color={isDarkColorScheme ? "#9ca3af" : "#6b7280"}
              />
              <Text className="text-sm font-semibold text-muted-foreground">Email</Text>
            </View>
            <Text className="text-foreground text-base">{email}</Text>
          </View>

          <View className="bg-card border border-border rounded-xl p-4">
            <View className="flex-row items-center gap-3 mb-2">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={isDarkColorScheme ? "#9ca3af" : "#6b7280"}
              />
              <Text className="text-sm font-semibold text-muted-foreground">Description</Text>
            </View>
            {isEditing ? (
              <TextInput
                value={description}
                onChangeText={setDescription}
                className="text-foreground text-base bg-background border border-border rounded-lg px-3 py-2"
                placeholder="Enter your description"
                placeholderTextColor={isDarkColorScheme ? "#6b7280" : "#9ca3af"}
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text className="text-foreground text-base">{description || "Add a short bio"}</Text>
            )}
          </View>

          <View className="bg-card border border-border rounded-xl p-4">
            <View className="flex-row items-center gap-3 mb-2">
              <Ionicons
                name="call-outline"
                size={20}
                color={isDarkColorScheme ? "#9ca3af" : "#6b7280"}
              />
              <Text className="text-sm font-semibold text-muted-foreground">Contact</Text>
            </View>
            {isEditing ? (
              <TextInput
                value={contact}
                onChangeText={setContact}
                className="text-foreground text-base bg-background border border-border rounded-lg px-3 py-2"
                placeholder="Enter contact info"
                placeholderTextColor={isDarkColorScheme ? "#6b7280" : "#9ca3af"}
                keyboardType="email-address"
              />
            ) : (
              <Text className="text-foreground text-base">{contact}</Text>
            )}
          </View>

          <View className="bg-card border border-border rounded-xl p-4">
            <View className="flex-row items-center gap-3 mb-2">
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={isDarkColorScheme ? "#9ca3af" : "#6b7280"}
              />
              <Text className="text-sm font-semibold text-muted-foreground">Account Type</Text>
            </View>
            <Text className="text-foreground text-base">
              {user?.externalAccounts?.find((acc) => acc.provider === "google")
                ? "Google Account"
                : "Email Account"}
            </Text>
          </View>

          <View className="mt-6 mb-8">
            <SignOutButton />
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
