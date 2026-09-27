import { describe, expect, it } from "vitest";
import {
  attachmentValidationMessage,
  hasExpectedFileSignature,
  safeAttachmentName,
} from "./chat-attachments";

describe("chat attachments", () => {
  it("sanitizes user-controlled filenames", () => {
    expect(safeAttachmentName("../../client:brief?.pdf")).toBe("..-..-client-brief-.pdf");
  });

  it("rejects executable and oversized uploads", () => {
    expect(
      attachmentValidationMessage({ name: "malware.exe", type: "application/x-msdownload", size: 10 }),
    ).toMatch(/PDF/);
    expect(
      attachmentValidationMessage({ name: "large.pdf", type: "application/pdf", size: 9 * 1024 * 1024 }),
    ).toMatch(/4 MB/);
  });

  it("checks declared content against a file signature", () => {
    expect(hasExpectedFileSignature("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasExpectedFileSignature("image/png", new TextEncoder().encode("not a png"))).toBe(false);
  });
});
