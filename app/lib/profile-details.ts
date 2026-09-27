export const PORTFOLIO_LINK_TYPES = [
  "website",
  "github",
  "linkedin",
  "behance",
  "dribbble",
  "youtube",
  "other",
] as const;

export type PortfolioLinkType = (typeof PORTFOLIO_LINK_TYPES)[number];

export type PortfolioLink = {
  label: string;
  url: string;
  type: PortfolioLinkType;
};

const linkHosts: Array<{
  hosts: string[];
  type: PortfolioLinkType;
  label: string;
}> = [
  { hosts: ["github.com"], type: "github", label: "GitHub" },
  { hosts: ["linkedin.com"], type: "linkedin", label: "LinkedIn" },
  { hosts: ["behance.net"], type: "behance", label: "Behance" },
  { hosts: ["dribbble.com"], type: "dribbble", label: "Dribbble" },
  {
    hosts: ["youtube.com", "youtu.be"],
    type: "youtube",
    label: "YouTube",
  },
];

function cleanHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function portfolioLinkDetails(value: string) {
  const candidate = value.trim();
  if (!candidate) return null;
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) return null;
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  const host = cleanHost(parsed.hostname);
  const match = linkHosts.find((item) =>
    item.hosts.some((known) => host === known || host.endsWith(`.${known}`)),
  );
  return {
    url: parsed.toString(),
    type: match?.type ?? "website",
    label: match?.label ?? "Portfolio",
  } satisfies PortfolioLink;
}

export function normalizePortfolioLinks(value: unknown): PortfolioLink[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  const result: PortfolioLink[] = [];
  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const details = portfolioLinkDetails(String(row.url ?? ""));
    if (!details || unique.has(details.url)) continue;
    const customLabel = String(row.label ?? "").trim().slice(0, 40);
    unique.add(details.url);
    result.push({
      ...details,
      label: customLabel || details.label,
    });
  }
  return result;
}

export function portfolioLinksFromProfile(data: Record<string, unknown>) {
  const structured = normalizePortfolioLinks(data.portfolioLinks);
  if (structured.length) return structured;
  return normalizePortfolioLinks(
    [
      { label: "Portfolio", url: data.portfolio },
      { label: "LinkedIn", url: data.linkedIn },
      { label: "GitHub", url: data.gitHub },
    ].filter((item) => String(item.url ?? "").trim()),
  );
}

export function normalizeYearsExperience(value: unknown) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 50) return null;
  return numeric;
}

export function profileCompleteness(input: {
  photoDataUrl?: string;
  headline?: string;
  bio?: string;
  skills?: string;
  yearsExperience?: number;
  languages?: string;
  portfolioLinks?: PortfolioLink[];
}) {
  const checks = [
    Boolean(input.photoDataUrl),
    Boolean(input.headline),
    Boolean(input.bio && input.bio.length >= 80),
    Boolean(input.skills),
    typeof input.yearsExperience === "number",
    Boolean(input.languages),
    Boolean(input.portfolioLinks?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
