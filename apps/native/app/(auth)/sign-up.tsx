import { useSignUp, useOAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import React from "react";
import { Container } from "@/components/container";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpPage() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");

  // Handle Google OAuth
  const onGoogleSignUp = async () => {
    try {
      const { createdSessionId, setActive: oauthSetActive } =
        await startOAuthFlow();

      if (createdSessionId) {
        await oauthSetActive!({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      console.error("OAuth error:", JSON.stringify(err, null, 2));
      Alert.alert("Error", "Failed to sign up with Google");
    }
  };

  // Handle email sign up
  const onEmailSignUp = async () => {
    if (!isLoaded || !emailAddress.trim()) return;

    setIsLoading(true);
    try {
      await signUp.create({
        emailAddress,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setPendingVerification(true);
      Alert.alert(
        "Check your email",
        `We sent a verification code to ${emailAddress}`
      );
    } catch (err: any) {
      console.error("Sign up error:", JSON.stringify(err, null, 2));
      Alert.alert("Error", err.errors?.[0]?.message || "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  // Verify email code
  const onVerifyPress = async () => {
    if (!isLoaded || !code.trim()) return;

    setIsLoading(true);
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace("/(tabs)");
      } else {
        Alert.alert("Error", "Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      console.error("Verification error:", JSON.stringify(err, null, 2));
      Alert.alert("Error", err.errors?.[0]?.message || "Invalid code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <View className="flex-1 justify-center px-6">
        <View className="bg-card border border-border rounded-2xl p-8">
          <Text className="text-3xl font-bold text-foreground mb-2">
            {!pendingVerification ? "Create Account" : "Verify Email"}
          </Text>
          <Text className="text-muted-foreground mb-8">
            {!pendingVerification
              ? "Join CoTask to manage your tasks"
              : "Enter the code sent to your email"}
          </Text>

          {!pendingVerification ? (
            <>
              {/* Google Sign Up Button */}
              <TouchableOpacity
                onPress={onGoogleSignUp}
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

              {/* Email Input */}
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
                onPress={onEmailSignUp}
                disabled={!emailAddress.trim() || isLoading}
                className={`rounded-lg py-4 ${
                  !emailAddress.trim() || isLoading ? "bg-muted" : "bg-primary"
                }`}
              >
                <Text className="text-center text-white font-semibold text-base">
                  {isLoading ? "Sending..." : "Sign Up with Email"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Verification Code Input */}
              <View className="mb-6">
                <Text className="text-sm font-medium text-foreground mb-2">
                  Verification Code
                </Text>
                <TextInput
                  value={code}
                  placeholder="123456"
                  placeholderTextColor="#737378"
                  onChangeText={setCode}
                  className="border border-border rounded-lg px-4 py-3 text-foreground bg-background text-center text-2xl tracking-widest"
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                onPress={onVerifyPress}
                disabled={!code.trim() || isLoading}
                className={`rounded-lg py-4 mb-4 ${
                  !code.trim() || isLoading ? "bg-muted" : "bg-primary"
                }`}
              >
                <Text className="text-center text-white font-semibold text-base">
                  {isLoading ? "Verifying..." : "Verify Email"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setPendingVerification(false);
                  setCode("");
                }}
                disabled={isLoading}
              >
                <Text className="text-center text-muted-foreground">
                  Use a different email
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Container>
  );
}
