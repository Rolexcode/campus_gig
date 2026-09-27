import { describe, expect, it } from "vitest";
import {
  parseSafetyAdminAction,
  parseSafetyReportInput,
  safetyReportPriority,
} from "./safety-reports";

describe("safety reports", () => {
  it("validates user report categories and contextual details", () => {
    expect(
      parseSafetyReportInput({ category: "harassment", details: "" }),
    ).toEqual({ category: "harassment", details: "" });
    expect(() =>
      parseSafetyReportInput({ category: "other", details: "Too short" }),
    ).toThrow(/at least 10/);
    expect(() =>
      parseSafetyReportInput({ category: "unknown", details: "Details" }),
    ).toThrow(/reason/);
  });

  it("escalates money and unsafe-content categories", () => {
    expect(safetyReportPriority("fraud_or_scam")).toBe("high");
    expect(safetyReportPriority("unsafe_file_or_link")).toBe("high");
    expect(safetyReportPriority("harassment")).toBe("medium");
    expect(safetyReportPriority("spam")).toBe("normal");
  });

  it("requires a durable note for terminal administrator decisions", () => {
    expect(parseSafetyAdminAction({ action: "review" })).toEqual({
      action: "review",
      resolutionNote: "",
    });
    expect(() =>
      parseSafetyAdminAction({ action: "resolve", resolutionNote: "Done" }),
    ).toThrow(/20/);
    expect(
      parseSafetyAdminAction({
        action: "suspend",
        resolutionNote:
          "Confirmed credential theft attempt in the reported message.",
      }),
    ).toMatchObject({ action: "suspend" });
  });
});
