import { describe, expect, it } from "vitest";
import { releaseAllocation } from "./release-allocation";

describe("USDC release allocation", () => {
  it("preserves every base unit across the student and fee transfers", () => {
    expect(
      releaseAllocation({
        amountBaseUnits: "100000000",
        studentAmountBaseUnits: "95000000",
        platformFeeBaseUnits: "5000000",
      }),
    ).toEqual({
      amountBaseUnits: 100000000n,
      studentAmountBaseUnits: 95000000n,
      platformFeeBaseUnits: 5000000n,
    });
  });

  it("rejects a distribution that can mint or lose value", () => {
    expect(() =>
      releaseAllocation({
        amountBaseUnits: "100",
        studentAmountBaseUnits: "96",
        platformFeeBaseUnits: "5",
      }),
    ).toThrow("invalid");
  });
});
