import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { nextRateLimitState } from "./server-rate-limit";

describe("nextRateLimitState", () => {
  it("starts and resets a fixed window", () => {
    expect(
      nextRateLimitState({
        count: 9,
        windowStartedAtMs: 1_000,
        nowMs: 62_000,
        windowMs: 60_000,
        limit: 10,
      }),
    ).toEqual({ allowed: true, count: 1, windowStartedAtMs: 62_000 });
  });

  it("increments within the limit and blocks at the limit", () => {
    expect(
      nextRateLimitState({
        count: 9,
        windowStartedAtMs: 1_000,
        nowMs: 2_000,
        windowMs: 60_000,
        limit: 10,
      }).allowed,
    ).toBe(true);
    expect(
      nextRateLimitState({
        count: 10,
        windowStartedAtMs: 1_000,
        nowMs: 2_000,
        windowMs: 60_000,
        limit: 10,
      }).allowed,
    ).toBe(false);
  });
});
