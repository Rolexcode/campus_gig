import "server-only";

import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { getFirebaseAdminServices } from "./firebase-admin";
import { ApiAuthError } from "./server-auth";

type AdminDb = ReturnType<typeof getFirebaseAdminServices>["adminDb"];

export function nextRateLimitState({
  count,
  windowStartedAtMs,
  nowMs,
  windowMs,
  limit,
}: {
  count: number;
  windowStartedAtMs: number;
  nowMs: number;
  windowMs: number;
  limit: number;
}) {
  if (!windowStartedAtMs || nowMs - windowStartedAtMs >= windowMs) {
    return { allowed: true, count: 1, windowStartedAtMs: nowMs };
  }
  if (count >= limit) {
    return { allowed: false, count, windowStartedAtMs };
  }
  return { allowed: true, count: count + 1, windowStartedAtMs };
}

export async function enforceServerRateLimit({
  adminDb,
  bucket,
  key,
  limit,
  windowMs,
}: {
  adminDb: AdminDb;
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
}) {
  const id = createHash("sha256").update(`${bucket}:${key}`).digest("hex");
  const reference = adminDb.collection("serverRateLimits").doc(id);
  const nowMs = Date.now();

  const allowed = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data() ?? {};
    const next = nextRateLimitState({
      count: Number(data.count ?? 0),
      windowStartedAtMs: Number(data.windowStartedAtMs ?? 0),
      nowMs,
      windowMs,
      limit,
    });
    if (!next.allowed) return false;
    transaction.set(
      reference,
      {
        bucket,
        count: next.count,
        windowStartedAtMs: next.windowStartedAtMs,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });

  if (!allowed) {
    throw new ApiAuthError(
      "Too many payment requests. Wait a few minutes before trying again.",
      429,
    );
  }
}
