import { describe, expect, it } from "vitest";
import {
  configuredSchoolDomains,
  schoolEmailDomain,
  verifiedInstitutionForEmail,
} from "./school-email";

const configured = JSON.stringify({
  "st.lasu.edu.ng": "Lagos State University",
});

describe("school email verification", () => {
  it("extracts normalized domains", () => {
    expect(schoolEmailDomain(" Student@ST.LASU.EDU.NG ")).toBe("st.lasu.edu.ng");
  });

  it("requires an approved domain bound to the selected institution", () => {
    expect(
      verifiedInstitutionForEmail(
        "student@st.lasu.edu.ng",
        "Lagos State University",
        configured,
      ),
    ).toBe("Lagos State University");
    expect(
      verifiedInstitutionForEmail(
        "student@st.lasu.edu.ng",
        "University of Lagos",
        configured,
      ),
    ).toBeNull();
    expect(
      verifiedInstitutionForEmail("student@attacker.example", "Lagos State University", configured),
    ).toBeNull();
  });

  it("rejects malformed configuration", () => {
    expect(() => configuredSchoolDomains("[]")).toThrow();
  });
});
