// Libsodium bindings for React Native
import sodium from "react-native-libsodium";
import { getItem, saveItem, SECURE_KEYS } from "./secure-store";

export interface KeyPair {
  publicKey: string; // base64
  privateKey: string; // base64 (stored locally only)
}

async function ensureSodium() {
  // Initialize sodium if not yet
  // libsodium-wrappers exports a ready promise; but we can call init by accessing sodium.ready
  // react-native-libsodium exposes a ready promise
  // @ts-ignore
  if ((sodium as any).ready) {
    // @ts-ignore
    await (sodium as any).ready;
  }
  return sodium;
}

export async function generateAndPersistKeyPair(): Promise<KeyPair> {
  const s = await ensureSodium();
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
  const key = s.randombytes_buf(s.crypto_secretbox_KEYBYTES);
  return s.to_base64(key);
}

export async function symmetricEncrypt(
  plaintext: string,
  keyB64: string
): Promise<{ cipher: string; nonce: string }> {
  const s = await ensureSodium();
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
  const key = s.from_base64(keyB64);
  const cipher = s.from_base64(cipherB64);
  const nonce = s.from_base64(nonceB64);
  const plain = s.crypto_secretbox_open_easy(cipher, nonce, key);
  return s.to_string(plain);
}
