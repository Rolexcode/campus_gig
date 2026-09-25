import { describe, expect, it } from "vitest";
import { calculateRegistrationMetrics } from "./admin-analytics";

describe("calculateRegistrationMetrics", () => {
  it("uses UTC day, Monday-week, and month boundaries", () => {
    const now = new Date("2026-08-30T15:00:00.000Z");
    const result = calculateRegistrationMetrics(
      [
        { createdAt: "2026-08-30T01:00:00.000Z", emailVerified: true, disabled: false },
        { createdAt: "2026-08-24T00:00:00.000Z", emailVerified: true, disabled: true },
        { createdAt: "2026-08-01T00:00:00.000Z", emailVerified: false, disabled: false },
        { createdAt: "2026-07-31T23:59:59.000Z", emailVerified: false, disabled: false },
      ],
      now,
    );

    expect(result).toMatchObject({
      totalUsers: 4,
      registeredToday: 1,
      registeredThisWeek: 2,
      registeredThisMonth: 3,
      emailVerifiedUsers: 2,
      disabledUsers: 1,
    });
    expect(result.dailyRegistrations).toHaveLength(14);
    expect(result.dailyRegistrations.at(-1)).toEqual({
      date: "2026-08-30",
      count: 1,
    });
  });

  it("ignores invalid and future timestamps for period counts", () => {
    const result = calculateRegistrationMetrics(
      [
        { createdAt: null, emailVerified: false, disabled: false },
        { createdAt: "invalid", emailVerified: false, disabled: false },
        { createdAt: "2026-09-01T00:00:00.000Z", emailVerified: false, disabled: false },
      ],
      new Date("2026-08-30T15:00:00.000Z"),
    );

    expect(result.totalUsers).toBe(3);
    expect(result.registeredToday).toBe(0);
    expect(result.registeredThisWeek).toBe(0);
    expect(result.registeredThisMonth).toBe(0);
    expect(result.dailyRegistrations.every((point) => point.count === 0)).toBe(true);
  });
});
