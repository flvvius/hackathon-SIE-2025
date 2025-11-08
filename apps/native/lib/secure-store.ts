import * as SecureStore from "expo-secure-store";

export const SECURE_KEYS = {
  privateKey: "cotask.privateKey.box.v1",
  publicKey: "cotask.publicKey.box.v1",
} as const;

export async function saveItem(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function getItem(key: string) {
  return await SecureStore.getItemAsync(key);
}

export async function deleteItem(key: string) {
  await SecureStore.deleteItemAsync(key);
}
