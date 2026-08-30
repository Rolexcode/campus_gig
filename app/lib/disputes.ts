export const DISPUTE_CATEGORIES = [
  "scope",
  "quality",
  "non_delivery",
  "conduct",
  "payment",
  "other",
] as const;

export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

export function parseDisputeInput(body: Record<string, unknown>) {
  const category = String(body.category ?? "") as DisputeCategory;
  const description = String(body.description ?? "")
    .trim()
    .replace(/\r\n/g, "\n");
  if (!DISPUTE_CATEGORIES.includes(category)) {
    throw new Error("Choose a valid dispute category.");
  }
  if (description.length < 50 || description.length > 2_000) {
    throw new Error("Describe the issue in 50 to 2,000 characters.");
  }
  return { category, description };
}
