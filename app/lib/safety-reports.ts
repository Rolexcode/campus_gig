export const SAFETY_REPORT_CATEGORIES = [
  "harassment",
  "fraud_or_scam",
  "payment_evasion",
  "unsafe_file_or_link",
  "spam",
  "other",
] as const;

export type SafetyReportCategory =
  (typeof SAFETY_REPORT_CATEGORIES)[number];

export type SafetyReportStatus =
  | "open"
  | "reviewing"
  | "resolved"
  | "dismissed";

export function parseSafetyReportInput(value: unknown) {
  const source = (value ?? {}) as Record<string, unknown>;
  const category = String(source.category ?? "") as SafetyReportCategory;
  const details = String(source.details ?? "").trim();
  if (!SAFETY_REPORT_CATEGORIES.includes(category)) {
    throw new Error("Choose the reason that best describes the problem.");
  }
  if (details.length > 1_000) {
    throw new Error("Keep the additional details within 1,000 characters.");
  }
  if (category === "other" && details.length < 10) {
    throw new Error("Add at least 10 characters explaining the concern.");
  }
  return { category, details };
}

export function safetyReportPriority(category: SafetyReportCategory) {
  if (
    category === "fraud_or_scam" ||
    category === "unsafe_file_or_link" ||
    category === "payment_evasion"
  ) {
    return "high" as const;
  }
  return category === "harassment" ? ("medium" as const) : ("normal" as const);
}

export function parseSafetyAdminAction(value: unknown) {
  const source = (value ?? {}) as Record<string, unknown>;
  const action = String(source.action ?? "");
  const resolutionNote = String(source.resolutionNote ?? "").trim();
  if (!["review", "resolve", "dismiss", "suspend"].includes(action)) {
    throw new Error("Choose a valid safety action.");
  }
  if (
    action !== "review" &&
    (resolutionNote.length < 20 || resolutionNote.length > 1_000)
  ) {
    throw new Error(
      "Add a resolution note between 20 and 1,000 characters.",
    );
  }
  return {
    action: action as "review" | "resolve" | "dismiss" | "suspend",
    resolutionNote,
  };
}
