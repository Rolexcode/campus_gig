import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import { writeUserNotification } from "@/app/lib/user-notifications";
import { cleanConversationId, requireConversationAccess } from "@/app/lib/conversations";
import type { MarketplaceWorkSubmission } from "@/app/lib/gigs";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";
import {
  parseClientFeedback,
  parseWorkSubmissionInput,
} from "@/app/lib/work-submissions";

export const runtime = "nodejs";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

function workValue(data: Record<string, unknown>): MarketplaceWorkSubmission {
  const rawStatus = String(data.status ?? "submitted");
  const status =
    rawStatus === "approved" || rawStatus === "changes_requested"
      ? rawStatus
      : "submitted";
  return {
    gigId: String(data.gigId ?? ""),
    clientId: String(data.clientId ?? ""),
    studentId: String(data.studentId ?? ""),
    summary: String(data.summary ?? ""),
    deliverableUrl: String(data.deliverableUrl ?? ""),
    status,
    revisionNumber: Number(data.revisionNumber ?? 1),
    clientFeedback: String(data.clientFeedback ?? ""),
    submittedAt: dateValue(data.submittedAt),
    reviewedAt: dateValue(data.reviewedAt),
    updatedAt: dateValue(data.updatedAt),
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    await requireConversationAccess(adminDb, id, decoded.uid);
    const snapshot = await adminDb.collection("gigSubmissions").doc(id).get();
    return Response.json({
      submission: snapshot.exists ? workValue(snapshot.data() ?? {}) : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const input = parseWorkSubmissionInput(await request.json().catch(() => ({})));
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    if (decoded.uid !== access.conversation.studentId) {
      throw new ApiAuthError("Only the selected student can submit this work.", 403);
    }

    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const submissionReference = adminDb.collection("gigSubmissions").doc(id);
    await adminDb.runTransaction(async (transaction) => {
      const [gigSnapshot, paymentSnapshot, submissionSnapshot] = await Promise.all([
        transaction.get(access.gigReference),
        transaction.get(paymentReference),
        transaction.get(submissionReference),
      ]);
      if (!gigSnapshot.exists || !paymentSnapshot.exists) {
        throw new ApiAuthError("The funded gig could not be found.", 404);
      }
      const gig = gigSnapshot.data() ?? {};
      const payment = paymentSnapshot.data() ?? {};
      if (String(gig.selectedApplicantId ?? "") !== decoded.uid) {
        throw new ApiAuthError("You are not the selected student for this gig.", 403);
      }
      const fundingEvidence =
        String(payment.fundingSignature ?? "") ||
        String(payment.providerTransactionId ?? "");
      if (!fundingEvidence || String(payment.status ?? "") !== "funded") {
        throw new ApiAuthError("Work can only be submitted after payment is secured.", 409);
      }
      const currentStatus = gigStatus(gig.status);
      assertGigTransition(currentStatus, "submitted");
      const previous = submissionSnapshot.data() ?? {};
      if (submissionSnapshot.exists && String(previous.status ?? "") !== "changes_requested") {
        throw new ApiAuthError("This work is already awaiting client review.", 409);
      }
      const revisionNumber = Number(previous.revisionNumber ?? 0) + 1;
      transaction.set(
        submissionReference,
        {
          gigId: id,
          clientId: access.conversation.ownerId,
          studentId: decoded.uid,
          ...input,
          status: "submitted",
          revisionNumber,
          clientFeedback: "",
          submittedAt: FieldValue.serverTimestamp(),
          reviewedAt: FieldValue.delete(),
          createdAt: previous.createdAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.update(paymentReference, {
        status: "submitted",
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(access.gigReference, {
        status: "submitted",
        paymentStatus: "submitted",
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, access.gigReference, {
        id: `work_submitted_r${revisionNumber}`,
        type: "work_submitted",
        actorId: decoded.uid,
        actorRole: "student",
        fromStatus: currentStatus,
        toStatus: "submitted",
        metadata: { revisionNumber, hasDeliverableUrl: Boolean(input.deliverableUrl) },
      });
      writeUserNotification(transaction, adminDb, {
        userId: access.conversation.ownerId,
        eventId: `work_submitted_${id}_r${revisionNumber}`,
        type: "work",
        title: "Work submitted for review",
        body: `${access.conversation.studentName} submitted revision ${revisionNumber}. Review the deliverables before approving payment.`,
        href: `/gigs/${id}/conversation`,
        gigId: id,
        actorId: decoded.uid,
      });
    });

    const snapshot = await submissionReference.get();
    return Response.json({ submission: workValue(snapshot.data() ?? {}) });
  } catch (error) {
    if (error instanceof Error && !(error instanceof ApiAuthError)) {
      const validationError = [
        "Describe the completed work",
        "The deliverable link is too long",
        "Add a valid deliverable link",
        "Deliverable links must use",
      ].some((prefix) => error.message.startsWith(prefix));
      if (validationError) {
        return apiErrorResponse(new ApiAuthError(error.message, 400));
      }
    }
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const feedback = parseClientFeedback(await request.json().catch(() => ({})));
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    if (decoded.uid !== access.conversation.ownerId) {
      throw new ApiAuthError("Only the gig client can request changes.", 403);
    }

    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const submissionReference = adminDb.collection("gigSubmissions").doc(id);
    await adminDb.runTransaction(async (transaction) => {
      const [gigSnapshot, paymentSnapshot, submissionSnapshot] = await Promise.all([
        transaction.get(access.gigReference),
        transaction.get(paymentReference),
        transaction.get(submissionReference),
      ]);
      if (!gigSnapshot.exists || !paymentSnapshot.exists || !submissionSnapshot.exists) {
        throw new ApiAuthError("No submitted work is available for review.", 404);
      }
      const gig = gigSnapshot.data() ?? {};
      const payment = paymentSnapshot.data() ?? {};
      const submission = submissionSnapshot.data() ?? {};
      if (String(submission.status ?? "") !== "submitted" || String(payment.status ?? "") !== "submitted") {
        throw new ApiAuthError("This submission is not awaiting review.", 409);
      }
      const currentStatus = gigStatus(gig.status);
      assertGigTransition(currentStatus, "in_progress");
      transaction.update(submissionReference, {
        status: "changes_requested",
        clientFeedback: feedback,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(paymentReference, {
        status: "funded",
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(access.gigReference, {
        status: "in_progress",
        paymentStatus: "funded",
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, access.gigReference, {
        id: `work_changes_requested_r${Number(submission.revisionNumber ?? 1)}`,
        type: "work_changes_requested",
        actorId: decoded.uid,
        actorRole: "client",
        fromStatus: currentStatus,
        toStatus: "in_progress",
        metadata: { revisionNumber: Number(submission.revisionNumber ?? 1) },
      });
      writeUserNotification(transaction, adminDb, {
        userId: access.conversation.studentId,
        eventId: `work_changes_${id}_r${Number(submission.revisionNumber ?? 1)}`,
        type: "work",
        title: "Changes requested",
        body: `The client requested changes to revision ${Number(submission.revisionNumber ?? 1)}. Open the contract to read the feedback.`,
        href: `/gigs/${id}/conversation`,
        gigId: id,
        actorId: decoded.uid,
      });
    });

    const snapshot = await submissionReference.get();
    return Response.json({ submission: workValue(snapshot.data() ?? {}) });
  } catch (error) {
    if (error instanceof Error && !(error instanceof ApiAuthError)) {
      if (error.message.startsWith("Explain the requested changes")) {
        return apiErrorResponse(new ApiAuthError(error.message, 400));
      }
    }
    return apiErrorResponse(error);
  }
}
