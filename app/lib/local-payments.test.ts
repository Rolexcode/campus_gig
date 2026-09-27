import { describe, expect, it } from "vitest";
import {
  flutterwaveTransactionReference,
  localPaymentAmounts,
  ngnToMinorUnits,
  providerAmountMatches,
} from "./local-payments";

describe("local payment arithmetic", () => {
  it("keeps NGN values in integer minor units", () => {
    expect(ngnToMinorUnits(35_000)).toBe(3_500_000n);
    expect(localPaymentAmounts(35_000, 500)).toEqual({
      amountMinorUnits: "3500000",
      platformFeeMinorUnits: "175000",
      studentAmountMinorUnits: "3325000",
    });
  });

  it("rejects fractional and invalid NGN values", () => {
    expect(() => ngnToMinorUnits(10.5)).toThrow("whole number");
    expect(() => ngnToMinorUnits(0)).toThrow("whole number");
  });

  it("generates a stable provider reference per agreement version", () => {
    expect(flutterwaveTransactionReference("gig-123", 2)).toBe(
      flutterwaveTransactionReference("gig-123", 2),
    );
    expect(flutterwaveTransactionReference("gig-123", 2)).not.toBe(
      flutterwaveTransactionReference("gig-123", 3),
    );
  });

  it("accepts exact or overpaid provider amounts but not underpayments", () => {
    expect(providerAmountMatches("10000", 100)).toBe(true);
    expect(providerAmountMatches("10000", 101)).toBe(true);
    expect(providerAmountMatches("10000", 99.99)).toBe(false);
  });
});
