import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Stack } from "expo-router";
import {
	DarkTheme,
	DefaultTheme,
	type Theme,
	ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { NAV_THEME } from "@/lib/constants";
import React, { useRef } from "react";
import { useColorScheme } from "@/lib/use-color-scheme";
import { Platform } from "react-native";
import { setAndroidNavigationBar } from "@/lib/android-navigation-bar";

const LIGHT_THEME: Theme = {
	...DefaultTheme,
	colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
	...DarkTheme,
	colors: NAV_THEME.dark,
};

export const unstable_settings = {
	initialRouteName: "(drawer)",
};

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
	unsavedChangesWarning: false,
});

export default function RootLayout() {
	const hasMounted = useRef(false);
	const { colorScheme, isDarkColorScheme } = useColorScheme();
	const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

	useIsomorphicLayoutEffect(() => {
		if (hasMounted.current) {
			return;
		}

		if (Platform.OS === "web") {
			document.documentElement.classList.add("bg-background");
		}
		setAndroidNavigationBar(colorScheme);
		setIsColorSchemeLoaded(true);
		hasMounted.current = true;
	}, []);

	if (!isColorSchemeLoaded) {
		return null;
	}
	return (
		<ClerkProvider
			tokenCache={tokenCache}
			publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
		>
			<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
				<ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
					<StatusBar style={isDarkColorScheme ? "light" : "dark"} />
					<GestureHandlerRootView style={{ flex: 1 }}>
						<Stack>
							<Stack.Screen name="(drawer)" options={{ headerShown: false }} />
							<Stack.Screen name="(auth)" options={{ headerShown: false }} />
							<Stack.Screen
								name="modal"
								options={{ title: "Modal", presentation: "modal" }}
							/>
						</Stack>
					</GestureHandlerRootView>
				</ThemeProvider>
			</ConvexProviderWithClerk>
		</ClerkProvider>
	);
}

const useIsomorphicLayoutEffect =
	Platform.OS === "web" && typeof window === "undefined"
		? React.useEffect
		: React.useLayoutEffect;
