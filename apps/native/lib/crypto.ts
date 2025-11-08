// Libsodium bindings for React Native
import { Platform } from "react-native";
import { getItem, saveItem, SECURE_KEYS } from "./secure-store";

// Conditional import based on platform
let sodium: any = null;

// Only import sodium on native platforms
if (Platform.OS === "ios" || Platform.OS === "android") {
  // Dynamic import for native platforms only
  sodium = require("react-native-libsodium").default;
}

export interface KeyPair {
  publicKey: string; // base64
  privateKey: string; // base64 (stored locally only)
}

async function ensureSodium() {
  if (!sodium) {
    // For web, we'll use a mock implementation that just stores/retrieves plain text
    // In production, you'd want to use libsodium-wrappers for web
    console.warn(
      "Crypto not available on web platform. Using mock implementation for development."
    );
    return null;
  }

  // Initialize sodium if not yet
  // @ts-ignore
  if (sodium.ready) {
    // @ts-ignore
    await sodium.ready;
  }
  return sodium;
}

export async function generateAndPersistKeyPair(): Promise<KeyPair> {
  const s = await ensureSodium();

  if (!s) {
    // Mock implementation for web
    const mockKeyPair = {
      publicKey: btoa("mock-public-key-" + Date.now()),
      privateKey: btoa("mock-private-key-" + Date.now()),
    };
    await saveItem(SECURE_KEYS.publicKey, mockKeyPair.publicKey);
    await saveItem(SECURE_KEYS.privateKey, mockKeyPair.privateKey);
    return mockKeyPair;
  }

  const { publicKey, privateKey } = s.crypto_box_keypair();
  const pub64 = s.to_base64(publicKey);
  const priv64 = s.to_base64(privateKey);
  await saveItem(SECURE_KEYS.publicKey, pub64);
  await saveItem(SECURE_KEYS.privateKey, priv64);
  return { publicKey: pub64, privateKey: priv64 };
}

export async function loadKeyPair(): Promise<KeyPair | null> {
  const pub = await getItem(SECURE_KEYS.publicKey);
  const priv = await getItem(SECURE_KEYS.privateKey);
  if (!pub || !priv) return null;
  return { publicKey: pub, privateKey: priv };
}

export async function encryptForRecipients(
  plaintext: string,
  recipientPublicKeys: string[],
  senderPrivateKey: string
): Promise<{ cipherTexts: string[]; nonce: string }> {
  const s = await ensureSodium();

  if (!s) {
    // Mock implementation for web - just return base64 encoded plaintext
    const mockCipherTexts = recipientPublicKeys.map(() => btoa(plaintext));
    return {
      cipherTexts: mockCipherTexts,
      nonce: btoa("mock-nonce"),
    };
  }

  const nonce = s.randombytes_buf(s.crypto_box_NONCEBYTES);
  const nonceB64 = s.to_base64(nonce);
  const senderPrivUint8 = s.from_base64(senderPrivateKey);
  const results: string[] = [];
  for (const pub of recipientPublicKeys) {
    const recipientPub = s.from_base64(pub);
    const cipher = s.crypto_box_easy(
      s.from_string(plaintext),
      nonce,
      recipientPub,
      senderPrivUint8
    );
    results.push(s.to_base64(cipher));
  }
  return { cipherTexts: results, nonce: nonceB64 };
}

export async function decryptFromSender(
  cipherTextB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  recipientPrivateKeyB64: string
): Promise<string> {
  const s = await ensureSodium();

  if (!s) {
    // Mock implementation for web - just decode base64
    try {
      return atob(cipherTextB64);
    } catch {
      return cipherTextB64;
    }
  }

  const cipher = s.from_base64(cipherTextB64);
  const nonce = s.from_base64(nonceB64);
  const senderPub = s.from_base64(senderPublicKeyB64);
  const recipientPriv = s.from_base64(recipientPrivateKeyB64);
  const plain = s.crypto_box_open_easy(cipher, nonce, senderPub, recipientPriv);
  return s.to_string(plain);
}

// Simple symmetric encryption for task/group data (to be wrapped per user)
export async function generateSymmetricKey(): Promise<string> {
  const s = await ensureSodium();

  if (!s) {
    // Mock implementation for web
    return btoa("mock-symmetric-key-" + Date.now());
  }

  const key = s.randombytes_buf(s.crypto_secretbox_KEYBYTES);
  return s.to_base64(key);
}

export async function symmetricEncrypt(
  plaintext: string,
  keyB64: string
): Promise<{ cipher: string; nonce: string }> {
  const s = await ensureSodium();

  if (!s) {
    // Mock implementation for web
    return {
      cipher: btoa(plaintext),
      nonce: btoa("mock-nonce"),
    };
  }

  const key = s.from_base64(keyB64);
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const cipher = s.crypto_secretbox_easy(s.from_string(plaintext), nonce, key);
  return { cipher: s.to_base64(cipher), nonce: s.to_base64(nonce) };
}

export async function symmetricDecrypt(
  cipherB64: string,
  nonceB64: string,
  keyB64: string
): Promise<string> {
  const s = await ensureSodium();

  if (!s) {
    // Mock implementation for web
    try {
      return atob(cipherB64);
    } catch {
      return cipherB64;
    }
  }

  const key = s.from_base64(keyB64);
  const cipher = s.from_base64(cipherB64);
  const nonce = s.from_base64(nonceB64);
  const plain = s.crypto_secretbox_open_easy(cipher, nonce, key);
  return s.to_string(plain);
}
