import type { MarketplaceGigStatus } from "./gigs";

export const GIG_TRANSITIONS: Readonly<
  Record<MarketplaceGigStatus, readonly MarketplaceGigStatus[]>
> = {
  draft: ["open", "cancelled"],
  open: ["hired", "cancelled"],
  hired: ["terms_pending", "cancelled"],
  terms_pending: ["terms_pending", "awaiting_funding", "cancelled"],
  awaiting_funding: ["terms_pending", "in_progress", "cancelled"],
  in_progress: ["submitted", "disputed", "cancelled"],
  submitted: ["in_progress", "completed", "disputed"],
  completed: [],
  disputed: ["in_progress", "submitted", "completed", "cancelled"],
  cancelled: [],
};

export type GigActorRole = "client" | "student" | "admin" | "system";

export type GigEventType =
  | "gig_created"
  | "application_submitted"
  | "student_selected"
  | "terms_proposed"
  | "terms_accepted"
  | "funding_started"
  | "payment_secured"
  | "work_submitted"
  | "work_changes_requested"
  | "work_approved"
  | "dispute_opened"
  | "dispute_resolved"
  | "gig_cancelled";

export class InvalidGigTransitionError extends Error {
  constructor(from: MarketplaceGigStatus, to: MarketplaceGigStatus) {
    super(`Gig cannot move from ${from} to ${to}.`);
    this.name = "InvalidGigTransitionError";
  }
}

export function isMarketplaceGigStatus(
  value: unknown,
): value is MarketplaceGigStatus {
  return typeof value === "string" && value in GIG_TRANSITIONS;
}

export function gigStatus(value: unknown): MarketplaceGigStatus {
  // `closed` was used by the pre-contract prototype. Treat it as completed
  // when an older document is read instead of leaking a second state model.
  if (value === "closed") return "completed";
  return isMarketplaceGigStatus(value) ? value : "draft";
}

export function canTransitionGig(
  from: MarketplaceGigStatus,
  to: MarketplaceGigStatus,
) {
  return from === to || GIG_TRANSITIONS[from].includes(to);
}

export function assertGigTransition(
  fromValue: unknown,
  to: MarketplaceGigStatus,
) {
  const from = gigStatus(fromValue);
  if (!canTransitionGig(from, to)) {
    throw new InvalidGigTransitionError(from, to);
  }
  return from;
}
