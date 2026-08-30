import { describe, expect, it } from "vitest";
import {
  parseClientFeedback,
  parseWorkSubmissionInput,
} from "./work-submissions";

describe("work submission validation", () => {
  it("accepts a secure deliverable link", () => {
    expect(
      parseWorkSubmissionInput({
        summary: "I completed the agreed landing page and documented the handoff.",
        deliverableUrl: "https://example.com/deliverable",
      }),
    ).toEqual({
      summary: "I completed the agreed landing page and documented the handoff.",
      deliverableUrl: "https://example.com/deliverable",
    });
  });

  it("allows a note-only submission", () => {
    expect(
      parseWorkSubmissionInput({
        summary: "The final files were delivered directly in the agreed repository.",
      }).deliverableUrl,
    ).toBe("");
  });

  it("rejects insecure links and vague feedback", () => {
    expect(() =>
      parseWorkSubmissionInput({
        summary: "The work is complete and ready for the client's review.",
        deliverableUrl: "http://example.com/file",
      }),
    ).toThrow("https://");
    expect(() => parseClientFeedback({ feedback: "redo" })).toThrow();
  });
});
