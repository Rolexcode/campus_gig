import { describe, expect, it } from "vitest";
import { parseDisputeInput } from "./disputes";

describe("parseDisputeInput", () => {
  it("accepts a bounded categorized description", () => {
    expect(
      parseDisputeInput({
        category: "quality",
        description: "The submitted files do not match the agreed dimensions and require review.",
      }),
    ).toEqual({
      category: "quality",
      description: "The submitted files do not match the agreed dimensions and require review.",
    });
  });

  it("rejects unknown categories and short descriptions", () => {
    expect(() => parseDisputeInput({ category: "unknown", description: "x".repeat(60) })).toThrow();
    expect(() => parseDisputeInput({ category: "scope", description: "too short" })).toThrow();
  });
});
