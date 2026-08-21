import "server-only";

import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import type { MarketplaceConversation, MarketplaceMessage } from "./gigs";
import { ApiAuthError } from "./server-auth";

export function cleanConversationId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(value))
    throw new ApiAuthError("That gig identifier is invalid.", 400);
  return value;
}

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

export function conversationValue(
  data: Record<string, unknown>,
): MarketplaceConversation {
  const agreement = (data.agreement ?? {}) as Record<string, unknown>;
  return {
    gigId: String(data.gigId ?? ""),
    ownerId: String(data.ownerId ?? ""),
    studentId: String(data.studentId ?? ""),
    ownerName: String(data.ownerName ?? "CampusGig client"),
    studentName: String(data.studentName ?? "CampusGig student"),
    agreement: {
      scope: String(agreement.scope ?? ""),
      deliverables: String(agreement.deliverables ?? ""),
      deadline: String(agreement.deadline ?? ""),
      amount: Number(agreement.amount ?? 0),
      currency: String(agreement.currency ?? ""),
      revisions: Number(agreement.revisions ?? 0),
    },
    agreementStatus:
      data.agreementStatus === "accepted"
        ? "accepted"
        : data.agreementStatus === "proposed"
          ? "proposed"
          : "draft",
    agreementVersion: Number(data.agreementVersion ?? 0),
    acceptedVersion: Number(data.acceptedVersion ?? 0),
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
  };
}

export function messageValue(
  id: string,
  data: Record<string, unknown>,
): MarketplaceMessage {
  const role =
    data.senderRole === "client" || data.senderRole === "student"
      ? data.senderRole
      : "system";
  return {
    id,
    senderId: String(data.senderId ?? ""),
    senderName: String(data.senderName ?? "CampusGig"),
    senderRole: role,
    text: String(data.text ?? ""),
    createdAt: dateValue(data.createdAt),
  };
}

export async function requireConversationAccess(
  adminDb: Firestore,
  gigId: string,
  userId: string,
) {
  const gigReference = adminDb.collection("gigs").doc(gigId);
  const conversationReference = adminDb
    .collection("gigConversations")
    .doc(gigId);

  await adminDb.runTransaction(async (transaction) => {
    const [gigSnapshot, conversationSnapshot] = await Promise.all([
      transaction.get(gigReference),
      transaction.get(conversationReference),
    ]);
    if (!gigSnapshot.exists)
      throw new ApiAuthError("This gig could not be found.", 404);
    const gig = gigSnapshot.data() ?? {};
    const ownerId = String(gig.ownerId ?? "");
    const studentId = String(gig.selectedApplicantId ?? "");
    if (!studentId)
      throw new ApiAuthError(
        "Select a student before opening a conversation.",
        409,
      );
    if (userId !== ownerId && userId !== studentId)
      throw new ApiAuthError(
        "Only the selected client and student can open this conversation.",
        403,
      );

    if (!conversationSnapshot.exists) {
      transaction.create(conversationReference, {
        gigId,
        ownerId,
        studentId,
        ownerName: String(gig.posterName ?? "CampusGig client"),
        studentName: String(gig.selectedApplicantName ?? "CampusGig student"),
        agreement: {
          scope: String(gig.description ?? ""),
          deliverables: String(gig.summary ?? ""),
          deadline: String(gig.deadline ?? ""),
          amount: Number(gig.budget ?? 0),
          currency: String(gig.currency ?? ""),
          revisions: 1,
        },
        agreementStatus: "draft",
        agreementVersion: 0,
        acceptedVersion: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  const [gigSnapshot, conversationSnapshot] = await Promise.all([
    gigReference.get(),
    conversationReference.get(),
  ]);
  return {
    gigReference,
    gig: gigSnapshot.data() ?? {},
    conversationReference,
    conversation: conversationValue(conversationSnapshot.data() ?? {}),
  };
}
