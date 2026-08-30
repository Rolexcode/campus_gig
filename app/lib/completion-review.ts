export type CompletionReviewInput = {
  rating: number;
  review: string;
};

export function parseCompletionReview(value: unknown): CompletionReviewInput {
  const body = (value ?? {}) as Record<string, unknown>;
  const rating = Number(body.rating);
  const review = String(body.review ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Choose a rating from 1 to 5.");
  }
  if (review.length > 1_000) {
    throw new Error("The review must be 1,000 characters or fewer.");
  }
  return { rating, review };
}

export function nextReputation(
  current: Record<string, unknown>,
  rating: number,
  earnedBaseUnits: string,
) {
  const completedGigCount = Number(current.completedGigCount ?? 0) + 1;
  const ratingCount = Number(current.ratingCount ?? 0) + 1;
  const ratingTotal = Number(current.ratingTotal ?? 0) + rating;
  let previousEarnings = BigInt(0);
  try {
    previousEarnings = BigInt(String(current.totalEarnedUsdcBaseUnits ?? "0"));
  } catch {
    previousEarnings = BigInt(0);
  }
  const earned = BigInt(earnedBaseUnits);
  if (earned <= BigInt(0)) throw new Error("Completed-job earnings must be positive.");
  return {
    completedGigCount,
    ratingCount,
    ratingTotal,
    averageRating: Math.round((ratingTotal / ratingCount) * 100) / 100,
    totalEarnedUsdcBaseUnits: (previousEarnings + earned).toString(),
  };
}
