import { Container } from "@/components/container";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { router } from "expo-router";

export default function GroupsScreen() {
	const groups = useQuery(api.groups.myGroups);
	const createGroup = useMutation(api.groups.createGroup);
	const [creating, setCreating] = useState(false);

	const onCreate = async () => {
		if (creating) return;
		setCreating(true);
		try {
			await createGroup({ name: "My Group", description: "", color: "#6366f1" });
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
							onPress={onCreate}
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
								<View className="h-8 w-1.5 rounded-full" style={{ backgroundColor: g.color || "#94a3b8" }} />
								<View className="flex-1">
									<Text className="text-card-foreground font-semibold">{g.name}</Text>
									<Text className="text-muted-foreground text-sm" numberOfLines={1}>
										{g.description || "No description"}
									</Text>
								</View>
								<Ionicons name="chevron-forward" size={18} color="#9ca3af" />
							</TouchableOpacity>
						))}
						{groups && groups.length === 0 && (
							<Text className="text-muted-foreground">No groups yet. Create one.</Text>
						)}
					</View>
				</View>
			</ScrollView>
		</Container>
	);
}
