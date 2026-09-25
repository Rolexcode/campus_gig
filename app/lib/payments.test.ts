import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { paymentAmounts } from "./payments";

const originalFee = process.env.CAMPUSGIG_PLATFORM_FEE_BPS;

afterEach(() => {
  if (originalFee === undefined) delete process.env.CAMPUSGIG_PLATFORM_FEE_BPS;
  else process.env.CAMPUSGIG_PLATFORM_FEE_BPS = originalFee;
});

describe("program-compatible USDC fee math", () => {
  it("rounds the fee down and conserves every base unit", () => {
    process.env.CAMPUSGIG_PLATFORM_FEE_BPS = "333";
    const allocation = paymentAmounts("0.000101");
    expect(allocation).toEqual({
      amountBaseUnits: "101",
      platformFeeBaseUnits: "3",
      studentAmountBaseUnits: "98",
    });
    expect(
      BigInt(allocation.studentAmountBaseUnits) +
        BigInt(allocation.platformFeeBaseUnits),
    ).toBe(BigInt(allocation.amountBaseUnits));
  });

  it("rejects fees above the on-chain 25 percent safety cap", () => {
    process.env.CAMPUSGIG_PLATFORM_FEE_BPS = "2501";
    expect(() => paymentAmounts("1")).toThrow("0 to 2500");
  });
});
