import { describe, expect, it } from "vitest";
import {
  normalizePortfolioLinks,
  normalizeYearsExperience,
  portfolioLinkDetails,
  portfolioLinksFromProfile,
  profileCompleteness,
} from "./profile-details";

describe("professional profile details", () => {
  it("normalizes safe links and detects known portfolio providers", () => {
    expect(portfolioLinkDetails("github.com/Ada/example")).toMatchObject({
      label: "GitHub",
      type: "github",
      url: "https://github.com/Ada/example",
    });
    expect(portfolioLinkDetails("https://youtu.be/example#comments")).toMatchObject(
      { label: "YouTube", type: "youtube", url: "https://youtu.be/example" },
    );
  });

  it("rejects unsafe and malformed links", () => {
    expect(portfolioLinkDetails("javascript:alert(1)")).toBeNull();
    expect(portfolioLinkDetails("http://example.com")).toBeNull();
  });

  it("deduplicates links and preserves a bounded custom label", () => {
    expect(
      normalizePortfolioLinks([
        { label: "My code", url: "https://github.com/example" },
        { label: "Duplicate", url: "https://github.com/example" },
      ]),
    ).toEqual([
      {
        label: "My code",
        type: "github",
        url: "https://github.com/example",
      },
    ]);
  });

  it("migrates the legacy fixed profile links", () => {
    expect(
      portfolioLinksFromProfile({ linkedIn: "https://linkedin.com/in/ada" }),
    ).toHaveLength(1);
  });

  it("validates years and calculates progressive completion", () => {
    expect(normalizeYearsExperience("4")).toBe(4);
    expect(normalizeYearsExperience(51)).toBeNull();
    expect(
      profileCompleteness({
        headline: "Designer",
        yearsExperience: 4,
        portfolioLinks: [{ label: "Work", url: "https://ada.dev/", type: "website" }],
      }),
    ).toBe(43);
  });
});
