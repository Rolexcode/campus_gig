import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
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

function walletContext(value: string) {
  const normalized = value.trim();
  if (!/^(user|gig):[A-Za-z0-9_-]{1,180}$/.test(normalized)) {
    throw new Error("The embedded wallet encryption context is invalid.");
  }
  return Buffer.from(`campusgig-wallet:v2:${normalized}`, "utf8");
}

export function createEmbeddedWallet(context: string) {
  const wallet = Keypair.generate();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const aad = walletContext(context);
  cipher.setAAD(aad);
  const plaintext = Buffer.from(wallet.secretKey);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    publicKey: wallet.publicKey.toBase58(),
    encryptedSecretKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    algorithm: ALGORITHM,
    keyContextHash: createHash("sha256").update(aad).digest("hex"),
    version: 2,
  };
}

type EncryptedWalletRecord = {
  publicKey?: unknown;
  encryptedSecretKey?: unknown;
  iv?: unknown;
  authTag?: unknown;
  keyContextHash?: unknown;
  algorithm?: unknown;
  version?: unknown;
};

export function decryptEmbeddedWallet(record: EncryptedWalletRecord, context: string) {
  if (
    record.algorithm !== ALGORITHM ||
    ![1, 2].includes(Number(record.version)) ||
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
  if (record.version === 2) {
    const aad = walletContext(context);
    const expectedContextHash = createHash("sha256").update(aad).digest("hex");
    if (record.keyContextHash !== expectedContextHash) {
      throw new Error("The embedded wallet record is bound to a different account.");
    }
    decipher.setAAD(aad);
  }
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
