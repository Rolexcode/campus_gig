import { describe, expect, it } from "vitest";
import { presenceState } from "./conversation-presence";

describe("conversation presence", () => {
  it("expires online and typing indicators independently", () => {
    const now = 100_000;
    expect(
      presenceState({ lastSeenAtMs: now - 10_000, typingUntilMs: now + 2_000 }, now),
    ).toMatchObject({ online: true, typing: true });
    expect(
      presenceState({ lastSeenAtMs: now - 70_000, typingUntilMs: now - 1 }, now),
    ).toMatchObject({ online: false, typing: false });
  });
});
