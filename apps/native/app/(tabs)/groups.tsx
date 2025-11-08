import { Container } from "@/components/container";
import { ScrollView, Text, View } from "react-native";

export default function GroupsScreen() {
	return (
		<Container>
			<ScrollView className="flex-1">
				<View className="px-4 py-6">
					<Text className="text-3xl font-bold text-foreground mb-2">
						Groups
					</Text>
					<Text className="text-lg text-muted-foreground">
						Manage your task groups
					</Text>
				</View>
			</ScrollView>
		</Container>
	);
}
