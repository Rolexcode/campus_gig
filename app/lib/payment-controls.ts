import "server-only";

import { ApiAuthError } from "./server-auth";

export function paymentsArePaused(
  configuredValue = process.env.PAYMENTS_PAUSED,
  environment = process.env.NODE_ENV,
) {
  const normalized = configuredValue?.trim().toLowerCase();

  // Financial mutations must fail closed in production when the switch is
  // absent or malformed. Development remains usable without extra setup.
  if (!normalized) return environment === "production";
  if (normalized === "false") return false;
  return true;
}

export function assertPaymentsActive() {
  if (paymentsArePaused()) {
    throw new ApiAuthError(
      "Payments are temporarily paused while CampusGig performs a safety check.",
      503,
    );
  }
}
