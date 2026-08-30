import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { paymentsArePaused } from "./payment-controls";

describe("paymentsArePaused", () => {
  it("fails closed when production configuration is missing", () => {
    expect(paymentsArePaused(undefined, "production")).toBe(true);
  });

  it("allows an explicit false value", () => {
    expect(paymentsArePaused("false", "production")).toBe(false);
  });

  it("pauses on true or malformed values", () => {
    expect(paymentsArePaused("true", "production")).toBe(true);
    expect(paymentsArePaused("not-a-boolean", "production")).toBe(true);
  });

  it("keeps local development usable when unset", () => {
    expect(paymentsArePaused(undefined, "development")).toBe(false);
  });
});
