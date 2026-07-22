import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function encryptionKey(): Buffer {
  const secret = process.env.AI_KEY_SECRET;
  if (!secret) {
    throw new Error("AI_KEY_SECRET is not configured.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function isAiKeyEncryptionConfigured(): boolean {
  return Boolean(process.env.AI_KEY_SECRET);
}

export function encryptAiApiKey(plaintext: string): string {
  if (!plaintext) throw new Error("API key cannot be empty.");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptAiApiKey(encoded: string): string {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded] =
    encoded.split(".");
  if (
    version !== "v1" ||
    !ivEncoded ||
    !authTagEncoded ||
    !ciphertextEncoded
  ) {
    throw new Error("Invalid encrypted AI API key.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
