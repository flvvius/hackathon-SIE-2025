import React from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { router } from "expo-router";

interface SwipeableTaskProps {
  task: any;
  priorityColor: string;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPress?: () => void;
}

export function SwipeableTask({
  task,
  priorityColor,
  canSwipeLeft,
  canSwipeRight,
  onSwipeLeft,
  onSwipeRight,
  onPress,
}: SwipeableTaskProps) {
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!canSwipeLeft) return null;

    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        className="justify-center items-start px-4"
        style={{ transform: [{ scale }] }}
      >
        <View className="bg-blue-500 rounded-lg px-4 py-2 flex-row items-center gap-2">
          <Ionicons name="arrow-back" size={20} color="white" />
          <Text className="text-white font-semibold">Previous</Text>
        </View>
      </Animated.View>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!canSwipeRight) return null;

    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        className="justify-center items-end px-4"
        style={{ transform: [{ scale }] }}
      >
        <View className="bg-green-500 rounded-lg px-4 py-2 flex-row items-center gap-2">
          <Text className="text-white font-semibold">Next</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </View>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      renderLeftActions={canSwipeLeft ? renderLeftActions : undefined}
      renderRightActions={canSwipeRight ? renderRightActions : undefined}
      onSwipeableLeftOpen={onSwipeLeft}
      onSwipeableRightOpen={onSwipeRight}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={80}
      rightThreshold={80}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="bg-card border border-border rounded-lg p-4 mb-2 ml-5"
      >
        <View className="flex-row items-start justify-between mb-2">
          <Text className="text-card-foreground font-semibold flex-1">
            {(task as any).title || task.encryptedTitle}
          </Text>
          <View
            className="px-2 py-1 rounded"
            style={{
              backgroundColor: priorityColor + "20",
            }}
          >
            <Text
              className="text-xs font-medium uppercase"
              style={{
                color: priorityColor,
              }}
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
          {(task as any).subtaskCount > 0 && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="list-outline" size={14} color="#9ca3af" />
              <Text className="text-muted-foreground text-xs">
                {(task as any).completedSubtaskCount}/
                {(task as any).subtaskCount}
              </Text>
            </View>
          )}
          {task.deadline && (
            <View className="flex-row items-center gap-1">
              <Ionicons
                name="calendar-outline"
                size={14}
                color={
                  new Date(task.deadline) < new Date() ? "#ef4444" : "#9ca3af"
                }
              />
              <Text
                className={`text-xs ${
                  new Date(task.deadline) < new Date()
                    ? "text-red-500 font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {new Date(task.deadline).toLocaleDateString()}
              </Text>
            </View>
          )}
          {task.assignments.length > 0 && (
            <View className="flex-row items-center gap-1">
              <View className="flex-row -space-x-2">
                {task.assignments
                  .slice(0, 3)
                  .map((assignment: any, index: number) => (
                    <View
                      key={index}
                      className="h-6 w-6 rounded-full bg-primary/20 border-2 border-card items-center justify-center"
                    >
                      <Text className="text-primary text-xs font-semibold">
                        {assignment.user?.name?.charAt(0).toUpperCase() || "?"}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}
