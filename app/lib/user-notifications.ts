import "server-only";

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";

export type UserNotificationInput = {
  userId: string;
  eventId: string;
  type:
    | "application"
    | "hiring"
    | "agreement"
    | "payment"
    | "work"
    | "review"
    | "system";
  title: string;
  body: string;
  href: string;
  gigId?: string;
  actorId?: string;
};

function safeDocumentId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 220);
}

function safeInternalHref(value: string) {
  return value.startsWith("/") && !value.startsWith("//")
    ? value.slice(0, 500)
    : "/notifications";
}

export function writeUserNotification(
  transaction: Transaction,
  adminDb: Firestore,
  input: UserNotificationInput,
) {
  if (!input.userId || !input.eventId) return;
  const reference = adminDb
    .collection("users")
    .doc(input.userId)
    .collection("notifications")
    .doc(safeDocumentId(input.eventId));
  transaction.set(
    reference,
    {
      type: input.type,
      title: input.title.slice(0, 140),
      body: input.body.slice(0, 500),
      href: safeInternalHref(input.href),
      gigId: input.gigId ?? "",
      actorId: input.actorId ?? "",
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
}
