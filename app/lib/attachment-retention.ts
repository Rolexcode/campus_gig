import { timingSafeEqual } from "node:crypto";
import { ATTACHMENT_QUARANTINE_PREFIX } from "./attachment-malware";

export const DEFAULT_ATTACHMENT_QUARANTINE_TTL_HOURS = 24;
export const MAX_ATTACHMENT_QUARANTINE_TTL_HOURS = 168;

export function attachmentQuarantineTtlHours(value?: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    return DEFAULT_ATTACHMENT_QUARANTINE_TTL_HOURS;
  return Math.min(parsed, MAX_ATTACHMENT_QUARANTINE_TTL_HOURS);
}

export function validCronAuthorization(
  authorization: string | null,
  secret: string | undefined,
) {
  const expected = secret?.trim() ?? "";
  if (expected.length < 32 || !authorization?.startsWith("Bearer "))
    return false;
  const received = authorization.slice("Bearer ".length).trim();
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export function expiredQuarantineObject(
  object: { name?: string; timeCreated?: string },
  now: Date,
  ttlHours: number,
) {
  const name = object.name ?? "";
  if (!name.startsWith(`${ATTACHMENT_QUARANTINE_PREFIX}/`)) return false;
  const createdAt = new Date(object.timeCreated ?? "");
  if (Number.isNaN(createdAt.getTime())) return false;
  return now.getTime() - createdAt.getTime() >= ttlHours * 60 * 60 * 1_000;
}
