import { describe, expect, it } from "vitest";
import {
  normalizeUsername,
  usernameSearchPrefix,
  usernameValidationMessage,
  validatedUsername,
} from "./usernames";

describe("usernames", () => {
  it("normalizes case, whitespace, and a leading @", () => {
    expect(normalizeUsername("  @Bode_425  ")).toBe("bode_425");
  });

  it("accepts a valid username", () => {
    expect(validatedUsername("bode_425")).toBe("bode_425");
  });

  it.each(["ab", "1bode", "bode-name", "bode name"])(
    "rejects invalid username %s",
    (username) => expect(usernameValidationMessage(username)).not.toBe(""),
  );

  it("rejects reserved usernames", () => {
    expect(() => validatedUsername("admin")).toThrow(/reserved/i);
  });

  it("accepts partial username search prefixes", () => {
    expect(usernameSearchPrefix("@bo")).toBe("bo");
  });
});
