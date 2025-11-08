import { Container } from "@/components/container";
import { ScrollView, Text, View } from "react-native";

export default function ProfileScreen() {
	return (
		<Container>
			<ScrollView className="flex-1">
				<View className="px-4 py-6">
					<Text className="text-3xl font-bold text-foreground mb-2">
						Profile
					</Text>
					<Text className="text-lg text-muted-foreground">
						Your profile and settings
					</Text>
				</View>
			</ScrollView>
		</Container>
	);
}
