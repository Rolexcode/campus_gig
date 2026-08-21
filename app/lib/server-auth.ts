import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminServices } from "./firebase-admin";

export class ApiAuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function requireFirebaseUser(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiAuthError("Log in to continue.", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new ApiAuthError("Log in to continue.", 401);

  try {
    const { adminAuth } = getFirebaseAdminServices();
    return await adminAuth.verifyIdToken(token, true);
  } catch (error) {
    if (error instanceof ApiAuthError) throw error;
    if (error instanceof Error && error.message.includes("not configured")) throw error;
    throw new ApiAuthError("Your session is invalid or expired. Log in again.", 401);
  }
}

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function tokenHasAdminEmail(decoded: DecodedIdToken) {
  return isConfiguredAdminEmail(decoded.email);
}

export function isConfiguredAdminEmail(email: string | null | undefined) {
  return Boolean(email && configuredAdminEmails().includes(email.toLowerCase()));
}

export async function requireConfiguredAdminEmail(request: Request) {
  const decoded = await requireFirebaseUser(request);
  const adminEmails = configuredAdminEmails();

  if (adminEmails.length === 0) {
    throw new ApiAuthError("Admin access is not configured yet.", 503);
  }

  if (!tokenHasAdminEmail(decoded)) {
    throw new ApiAuthError("This email is not approved for the CampusGig admin console.", 403);
  }

  return decoded;
}

export async function requireAdmin(request: Request) {
  const decoded = await requireConfiguredAdminEmail(request);

  if (!decoded.email_verified) {
    throw new ApiAuthError("Verify your administrator email before opening the console.", 403);
  }

  return decoded;
}

export async function requireMarketplaceUser(request: Request) {
  const decoded = await requireFirebaseUser(request);

  if (tokenHasAdminEmail(decoded)) {
    throw new ApiAuthError("Administrator accounts cannot use the CampusGig marketplace.", 403);
  }

  if (!decoded.email_verified) {
    throw new ApiAuthError("Verify your email before using the CampusGig marketplace.", 403);
  }

  return decoded;
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "The request could not be completed.";
  const configurationError = message.includes("not configured");
  return Response.json(
    { error: configurationError ? message : "The request could not be completed. Please try again." },
    { status: configurationError ? 503 : 500 },
  );
}
