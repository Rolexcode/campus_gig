import { describe, expect, it } from "vitest";
import { nextReputation, parseCompletionReview } from "./completion-review";

describe("completion review and reputation", () => {
  it("validates client ratings", () => {
    expect(parseCompletionReview({ rating: 5, review: "Excellent work." })).toEqual({
      rating: 5,
      review: "Excellent work.",
    });
    expect(() => parseCompletionReview({ rating: 6 })).toThrow();
  });

  it("updates aggregate reputation without losing USDC precision", () => {
    expect(
      nextReputation(
        {
          completedGigCount: 2,
          ratingCount: 2,
          ratingTotal: 9,
          totalEarnedUsdcBaseUnits: "9007199254740993000",
        },
        4,
        "95000000",
      ),
    ).toEqual({
      completedGigCount: 3,
      ratingCount: 3,
      ratingTotal: 13,
      averageRating: 4.33,
      totalEarnedUsdcBaseUnits: "9007199254835993000",
    });
  });
});
