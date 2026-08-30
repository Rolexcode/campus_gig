import { describe, expect, it } from "vitest";
import {
  assertGigTransition,
  canTransitionGig,
  gigStatus,
  InvalidGigTransitionError,
} from "./gig-contracts";

describe("CampusGig contract lifecycle", () => {
  it("allows the successful marketplace path", () => {
    const path = [
      "open",
      "hired",
      "terms_pending",
      "awaiting_funding",
      "in_progress",
      "submitted",
      "completed",
    ] as const;

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionGig(path[index], path[index + 1])).toBe(true);
    }
  });

  it("allows terms to be revised before funding", () => {
    expect(canTransitionGig("terms_pending", "terms_pending")).toBe(true);
    expect(canTransitionGig("awaiting_funding", "terms_pending")).toBe(true);
  });

  it("blocks funding before the selected student accepts terms", () => {
    expect(() => assertGigTransition("hired", "in_progress")).toThrow(
      InvalidGigTransitionError,
    );
    expect(() => assertGigTransition("terms_pending", "in_progress")).toThrow(
      InvalidGigTransitionError,
    );
  });

  it("blocks reopening terminal contracts", () => {
    expect(canTransitionGig("completed", "open")).toBe(false);
    expect(canTransitionGig("cancelled", "open")).toBe(false);
  });

  it("normalizes pre-contract prototype records", () => {
    expect(gigStatus("closed")).toBe("completed");
    expect(gigStatus("unexpected-value")).toBe("draft");
  });
});
