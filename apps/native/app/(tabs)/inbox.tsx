import { Container } from "@/components/container";
import { api } from "@coTask/backend/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { ScrollView, Text, View, TouchableOpacity } from "react-native";

export default function InboxScreen() {
	const notifications = useQuery(api.notifications.myNotifications, {
		onlyUnread: false,
	});
	const markRead = useMutation(api.notifications.markRead);

	return (
		<Container>
			<ScrollView className="flex-1">
				<View className="px-4 py-6">
					<Text className="text-3xl font-bold text-foreground mb-2">Inbox</Text>
					<Text className="text-lg text-muted-foreground mb-4">
						Your notifications and updates
					</Text>

					<View className="gap-3">
						{notifications?.map((n) => (
							<View key={n._id} className="bg-card border border-border rounded-xl p-4">
								<View className="flex-row items-center justify-between mb-1">
									<Text className="text-card-foreground font-semibold">
										Encrypted notification
									</Text>
									{!n.isRead && (
										<TouchableOpacity onPress={() => markRead({ notificationId: n._id })}>
											<Text className="text-primary font-medium">Mark as read</Text>
										</TouchableOpacity>
									)}
								</View>
								<Text className="text-muted-foreground text-sm">
									Encrypted content (client will decrypt)
								</Text>
							</View>
						))}
						{notifications && notifications.length === 0 && (
							<Text className="text-muted-foreground">No notifications</Text>
						)}
					</View>
				</View>
			</ScrollView>
		</Container>
	);
}
