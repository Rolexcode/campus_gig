import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createEmbeddedWallet, decryptEmbeddedWallet } from "./embedded-wallet";

const previousKey = process.env.WALLET_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.WALLET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
  else process.env.WALLET_ENCRYPTION_KEY = previousKey;
});

describe("embedded wallet context binding", () => {
  it("decrypts only in the user context that created the record", () => {
    const encrypted = createEmbeddedWallet("user:user_123");
    const wallet = decryptEmbeddedWallet(encrypted, "user:user_123");

    expect(wallet.publicKey.toBase58()).toBe(encrypted.publicKey);
    expect(() => decryptEmbeddedWallet(encrypted, "user:attacker")).toThrow(
      "bound to a different account",
    );
  });

  it("rejects malformed encryption contexts", () => {
    expect(() => createEmbeddedWallet("../wallet")).toThrow("context is invalid");
  });
});
