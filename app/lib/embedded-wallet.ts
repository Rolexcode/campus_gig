import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { Keypair } from "@solana/web3.js";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const configured = process.env.WALLET_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error("Embedded wallet encryption is not configured. Set WALLET_ENCRYPTION_KEY.");
  }

  const decoded = Buffer.from(configured, "base64");
  const canonical = decoded.toString("base64");
  if (decoded.length !== 32 || canonical !== configured.replace(/\s+/g, "")) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be a cryptographically random 32-byte base64 value.",
    );
  }
  return decoded;
}

export function createEmbeddedWallet() {
  const wallet = Keypair.generate();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const plaintext = Buffer.from(wallet.secretKey);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    publicKey: wallet.publicKey.toBase58(),
    encryptedSecretKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    algorithm: ALGORITHM,
    version: 1,
  };
}

type EncryptedWalletRecord = {
  publicKey?: unknown;
  encryptedSecretKey?: unknown;
  iv?: unknown;
  authTag?: unknown;
  algorithm?: unknown;
  version?: unknown;
};

export function decryptEmbeddedWallet(record: EncryptedWalletRecord) {
  if (
    record.algorithm !== ALGORITHM ||
    record.version !== 1 ||
    typeof record.publicKey !== "string" ||
    typeof record.encryptedSecretKey !== "string" ||
    typeof record.iv !== "string" ||
    typeof record.authTag !== "string"
  ) {
    throw new Error("The embedded wallet record is invalid.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(record.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedSecretKey, "base64")),
    decipher.final(),
  ]);

  if (plaintext.length !== 64) {
    throw new Error("The embedded wallet secret has an invalid length.");
  }

  const wallet = Keypair.fromSecretKey(new Uint8Array(plaintext));
  if (wallet.publicKey.toBase58() !== record.publicKey) {
    throw new Error("The embedded wallet public key does not match its secret.");
  }
  return wallet;
}
