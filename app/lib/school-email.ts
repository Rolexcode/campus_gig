const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);

function normalizedInstitution(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function schoolEmailDomain(email: string) {
  const match = email.trim().toLowerCase().match(/^[^\s@]+@([^\s@]+)$/);
  return match?.[1] ?? null;
}

export function isPersonalEmailDomain(domain: string) {
  return PERSONAL_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

export function configuredSchoolDomains(
  configured = process.env.SCHOOL_EMAIL_DOMAINS_JSON,
) {
  if (!configured?.trim()) return new Map<string, string>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(configured);
  } catch {
    throw new Error("SCHOOL_EMAIL_DOMAINS_JSON must be a valid JSON object.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("SCHOOL_EMAIL_DOMAINS_JSON must map domains to institution names.");
  }

  const domains = new Map<string, string>();
  for (const [domain, institution] of Object.entries(parsed)) {
    const normalizedDomain = domain.trim().toLowerCase();
    const normalizedName = String(institution).trim();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedDomain) || !normalizedName) {
      throw new Error("SCHOOL_EMAIL_DOMAINS_JSON contains an invalid domain or institution.");
    }
    domains.set(normalizedDomain, normalizedName);
  }
  return domains;
}

export function verifiedInstitutionForEmail(
  email: string,
  profileInstitution: string,
  configured = process.env.SCHOOL_EMAIL_DOMAINS_JSON,
) {
  const domain = schoolEmailDomain(email);
  if (!domain || isPersonalEmailDomain(domain)) return null;
  const institution = configuredSchoolDomains(configured).get(domain);
  if (!institution) return null;
  if (normalizedInstitution(institution) !== normalizedInstitution(profileInstitution)) {
    return null;
  }
  return institution;
}
