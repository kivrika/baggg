// ─── Agent Wallet Management ────────────────────────────────────
import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import * as crypto from "crypto";
import * as bs58 from "bs58";

// Encryption algorithm
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): string {
  const key = process.env.AGENT_WALLET_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error("AGENT_WALLET_ENCRYPTION_KEY environment variable is not set");
  }
  if (key.length !== 64) {
    throw new Error("AGENT_WALLET_ENCRYPTION_KEY must be 64 hex characters (256 bits)");
  }
  return key;
}

/**
 * Derive encryption key from master key using salt
 */
function deriveKey(salt: Buffer): Buffer {
  const masterKey = Buffer.from(getEncryptionKey(), "hex");
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, "sha256");
}

/**
 * Encrypt private key with AES-256-GCM
 */
export function encryptPrivateKey(secretKey: Uint8Array): string {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive encryption key
    const key = deriveKey(salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the secret key
    const secretKeyBuffer = Buffer.from(secretKey);
    const encrypted = Buffer.concat([
      cipher.update(secretKeyBuffer),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine salt + iv + authTag + encrypted data
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);

    // Return as base64
    return combined.toString("base64");
  } catch (error) {
    console.error("Failed to encrypt private key:", error);
    throw new Error("Private key encryption failed");
  }
}

/**
 * Decrypt private key
 */
export function decryptPrivateKey(encryptedData: string): Uint8Array {
  try {
    const combined = Buffer.from(encryptedData, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive decryption key
    const key = deriveKey(salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return new Uint8Array(decrypted);
  } catch (error) {
    console.error("Failed to decrypt private key:", error);
    throw new Error("Private key decryption failed");
  }
}

/**
 * Generate new Solana keypair for agent
 */
export function generateAgentKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Create encrypted wallet for agent
 * Returns public key and encrypted private key for database storage
 */
export function createEncryptedWallet(): {
  publicKey: string;
  encryptedPrivateKey: string;
} {
  const keypair = generateAgentKeypair();

  return {
    publicKey: keypair.publicKey.toBase58(),
    encryptedPrivateKey: encryptPrivateKey(keypair.secretKey),
  };
}

/**
 * Get Keypair from encrypted private key
 */
export function getKeypairFromEncrypted(encryptedPrivateKey: string): Keypair {
  const secretKey = decryptPrivateKey(encryptedPrivateKey);
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Sign transaction with encrypted private key
 */
export async function signTransactionWithEncryptedKey(
  transaction: Transaction | VersionedTransaction,
  encryptedPrivateKey: string
): Promise<Transaction | VersionedTransaction> {
  try {
    const keypair = getKeypairFromEncrypted(encryptedPrivateKey);

    if (transaction instanceof VersionedTransaction) {
      transaction.sign([keypair]);
    } else {
      transaction.sign(keypair);
    }

    return transaction;
  } catch (error) {
    console.error("Failed to sign transaction:", error);
    throw new Error("Transaction signing failed");
  }
}

/**
 * Verify wallet ownership (for security checks)
 */
export function verifyWalletOwnership(
  publicKey: string,
  encryptedPrivateKey: string
): boolean {
  try {
    const keypair = getKeypairFromEncrypted(encryptedPrivateKey);
    return keypair.publicKey.toBase58() === publicKey;
  } catch {
    return false;
  }
}

/**
 * Get public key from encrypted private key (without full decryption)
 */
export function getPublicKeyFromEncrypted(encryptedPrivateKey: string): string {
  const keypair = getKeypairFromEncrypted(encryptedPrivateKey);
  return keypair.publicKey.toBase58();
}

// ─── Security Utilities ──────────────────────────────────────────

/**
 * Generate random encryption key (for initial setup)
 * DO NOT use this in production - generate once and store securely
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Rotate encryption key (advanced feature for future)
 * Re-encrypts all private keys with new master key
 */
export async function rotateEncryptionKey(
  oldKey: string,
  newKey: string,
  encryptedPrivateKeys: string[]
): Promise<string[]> {
  // Temporarily store old key
  const originalKey = process.env.AGENT_WALLET_ENCRYPTION_KEY;

  try {
    // Decrypt with old key
    process.env.AGENT_WALLET_ENCRYPTION_KEY = oldKey;
    const decryptedKeys = encryptedPrivateKeys.map(decryptPrivateKey);

    // Re-encrypt with new key
    process.env.AGENT_WALLET_ENCRYPTION_KEY = newKey;
    const reencryptedKeys = decryptedKeys.map(encryptPrivateKey);

    return reencryptedKeys;
  } finally {
    // Restore original key
    process.env.AGENT_WALLET_ENCRYPTION_KEY = originalKey;
  }
}

/**
 * Audit log for wallet operations (security monitoring)
 */
export function logWalletOperation(
  operation: "create" | "decrypt" | "sign",
  agentId: number,
  publicKey: string,
  success: boolean
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    agentId,
    publicKey,
    success,
  };

  // In production, send to security monitoring system
  console.log("[WALLET_AUDIT]", JSON.stringify(logEntry));
}
