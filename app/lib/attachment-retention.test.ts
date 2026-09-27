import { describe, expect, it } from "vitest";
import {
  attachmentQuarantineTtlHours,
  expiredQuarantineObject,
  validCronAuthorization,
} from "./attachment-retention";

describe("attachment quarantine retention", () => {
  it("bounds the retention window", () => {
    expect(attachmentQuarantineTtlHours()).toBe(24);
    expect(attachmentQuarantineTtlHours("0")).toBe(24);
    expect(attachmentQuarantineTtlHours("48")).toBe(48);
    expect(attachmentQuarantineTtlHours("999")).toBe(168);
  });

  it("authenticates cron calls with a high-entropy secret", () => {
    const secret = "s".repeat(32);
    expect(validCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(validCronAuthorization("Bearer wrong", secret)).toBe(false);
    expect(validCronAuthorization(`Bearer ${secret}`, "short")).toBe(false);
  });

  it("deletes only expired objects from the quarantine namespace", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    expect(
      expiredQuarantineObject(
        {
          name: "chatAttachmentQuarantine/gig/message/file.pdf",
          timeCreated: "2026-09-26T11:59:59.000Z",
        },
        now,
        24,
      ),
    ).toBe(true);
    expect(
      expiredQuarantineObject(
        {
          name: "chatAttachmentQuarantine/gig/message/file.pdf",
          timeCreated: "2026-09-27T11:59:59.000Z",
        },
        now,
        24,
      ),
    ).toBe(false);
    expect(
      expiredQuarantineObject(
        {
          name: "chatAttachments/gig/message/file.pdf",
          timeCreated: "2020-01-01T00:00:00.000Z",
        },
        now,
        24,
      ),
    ).toBe(false);
  });
});
