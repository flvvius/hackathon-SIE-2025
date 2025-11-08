import { Container } from "@/components/container";
import { ScrollView, Text, View } from "react-native";
import React from "react";

export default function TasksScreen() {
	return (
		<Container>
			<ScrollView className="flex-1">
				<View className="px-4 py-6">
					<Text className="text-3xl font-bold text-foreground mb-2">Tasks</Text>
					<Text className="text-lg text-muted-foreground mb-4">
						Your task management hub
					</Text>
					<Text className="text-muted-foreground">Select a group to view tasks.</Text>
				</View>
			</ScrollView>
		</Container>
	);
}
