import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  flutterwaveTransactionMatches,
  verifyFlutterwaveWebhookHash,
} from "./flutterwave";

describe("Flutterwave verification", () => {
  beforeEach(() => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = "a-long-random-webhook-secret";
  });

  it("compares webhook hashes without accepting missing or altered values", () => {
    expect(verifyFlutterwaveWebhookHash("a-long-random-webhook-secret")).toBe(true);
    expect(verifyFlutterwaveWebhookHash("wrong-secret")).toBe(false);
    expect(verifyFlutterwaveWebhookHash(null)).toBe(false);
  });

  it("requires a verified successful transaction with the expected identity and amount", () => {
    const expected = {
      transactionId: 42,
      txRef: "CG-reference-V1",
      currency: "NGN",
      amountMinorUnits: "3500000",
    };
    expect(
      flutterwaveTransactionMatches(
        { id: 42, tx_ref: expected.txRef, currency: "NGN", amount: 35_000, status: "successful", payment_type: "bank_transfer" },
        expected,
      ),
    ).toBe(true);
    expect(
      flutterwaveTransactionMatches(
        { id: 42, tx_ref: expected.txRef, currency: "NGN", amount: 34_999, status: "successful", payment_type: "bank_transfer" },
        expected,
      ),
    ).toBe(false);
    expect(
      flutterwaveTransactionMatches(
        { id: 42, tx_ref: "other", currency: "NGN", amount: 35_000, status: "successful", payment_type: "bank_transfer" },
        expected,
      ),
    ).toBe(false);
    expect(
      flutterwaveTransactionMatches(
        { id: 42, tx_ref: expected.txRef, currency: "NGN", amount: 35_000, status: "successful", payment_type: "card" },
        expected,
      ),
    ).toBe(false);
  });
});
