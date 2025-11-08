import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import React from "react";
import { Container } from "@/components/container";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Handle Google OAuth
  const onGoogleSignIn = async () => {
    try {
      const { createdSessionId, setActive: oauthSetActive } =
        await startOAuthFlow();

      if (createdSessionId) {
        await oauthSetActive!({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      console.error("OAuth error:", JSON.stringify(err, null, 2));
      Alert.alert("Error", "Failed to sign in with Google");
    }
  };

  // Handle email magic link
  const onEmailSignIn = async () => {
    if (!isLoaded || !emailAddress.trim()) return;

    setIsLoading(true);
    try {
      const { supportedFirstFactors } = await signIn.create({
        identifier: emailAddress,
      });

      // Check if email link is supported
      const emailLinkFactor = supportedFirstFactors?.find(
        (factor: any) => factor.strategy === "email_link"
      );

      if (emailLinkFactor) {
        // Send magic link
        await signIn.prepareFirstFactor({
          strategy: "email_link",
          emailAddressId: (emailLinkFactor as any).emailAddressId,
          redirectUrl: "exp://", // This will be handled by Clerk
        });

        Alert.alert(
          "Check your email",
          `We sent a magic link to ${emailAddress}. Click the link to sign in.`,
          [{ text: "OK" }]
        );
      }
    } catch (err: any) {
      console.error("Email sign in error:", JSON.stringify(err, null, 2));
      Alert.alert(
        "Error",
        err.errors?.[0]?.message || "Failed to send magic link"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <View className="flex-1 justify-center px-6">
        <View className="bg-card border border-border rounded-2xl p-8">
          <Text className="text-3xl font-bold text-foreground mb-2">
            Welcome to CoTask
          </Text>
          <Text className="text-muted-foreground mb-8">
            Sign in to manage your tasks
          </Text>

          {/* Google Sign In Button */}
          <TouchableOpacity
            onPress={onGoogleSignIn}
            className="flex-row items-center justify-center bg-background border border-border rounded-lg py-4 mb-4"
          >
            <Ionicons
              name="logo-google"
              size={20}
              color="#EA4335"
              style={{ marginRight: 8 }}
            />
            <Text className="text-foreground font-semibold">
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-border" />
            <Text className="px-4 text-muted-foreground text-sm">or</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Email Magic Link */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-foreground mb-2">
              Email
            </Text>
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="your@email.com"
              placeholderTextColor="#737378"
              onChangeText={setEmailAddress}
              className="border border-border rounded-lg px-4 py-3 text-foreground bg-background"
              keyboardType="email-address"
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            onPress={onEmailSignIn}
            disabled={!emailAddress.trim() || isLoading}
            className={`rounded-lg py-4 ${
              !emailAddress.trim() || isLoading ? "bg-muted" : "bg-primary"
            }`}
          >
            <Text className="text-center text-white font-semibold text-base">
              {isLoading ? "Sending..." : "Send Magic Link"}
            </Text>
          </TouchableOpacity>

          <Text className="text-center text-muted-foreground text-sm mt-6">
            We'll send you a link to sign in without a password
          </Text>
        </View>
      </View>
    </Container>
  );
}
