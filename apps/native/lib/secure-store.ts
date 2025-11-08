import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const SECURE_KEYS = {
  privateKey: "cotask.privateKey.box.v1",
  publicKey: "cotask.publicKey.box.v1",
} as const;

// Check if we're on a platform that supports SecureStore
const isSecureStoreAvailable =
  Platform.OS === "ios" || Platform.OS === "android";

// Fallback to AsyncStorage or localStorage for web
const webStorage = {
  async setItem(key: string, value: string) {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  async getItem(key: string): Promise<string | null> {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  async removeItem(key: string) {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

export async function saveItem(key: string, value: string) {
  if (isSecureStoreAvailable) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } else {
    // Fallback for web
    await webStorage.setItem(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (isSecureStoreAvailable) {
    return await SecureStore.getItemAsync(key);
  } else {
    // Fallback for web
    return await webStorage.getItem(key);
  }
}

export async function deleteItem(key: string) {
  if (isSecureStoreAvailable) {
    await SecureStore.deleteItemAsync(key);
  } else {
    // Fallback for web
    await webStorage.removeItem(key);
  }
}
