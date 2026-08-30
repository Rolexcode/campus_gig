import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import { writeUserNotification } from "@/app/lib/user-notifications";
import {
  apiErrorResponse,
  ApiAuthError,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

function cleanId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(value))
    throw new ApiAuthError("That identifier is invalid.", 400);
  return value;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; applicantId: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const parameters = await context.params;
    const id = cleanId(parameters.id);
    const applicantId = cleanId(parameters.applicantId);
    const { adminDb } = getFirebaseAdminServices();
    const gigReference = adminDb.collection("gigs").doc(id);
    const selectedReference = adminDb
      .collection("applications")
      .doc(`${id}__${applicantId}`);
    const conversationReference = adminDb
      .collection("gigConversations")
      .doc(id);
    const applicationsQuery = adminDb
      .collection("applications")
      .where("gigId", "==", id);

    await adminDb.runTransaction(async (transaction) => {
      const [
        gigSnapshot,
        selectedSnapshot,
        allApplications,
        conversationSnapshot,
      ] = await Promise.all([
        transaction.get(gigReference),
        transaction.get(selectedReference),
        transaction.get(applicationsQuery),
        transaction.get(conversationReference),
      ]);
      if (!gigSnapshot.exists)
        throw new ApiAuthError("This gig could not be found.", 404);
      const gig = gigSnapshot.data() ?? {};
      if (String(gig.ownerId ?? "") !== decoded.uid)
        throw new ApiAuthError(
          "Only the gig poster can select an applicant.",
          403,
        );
      if (!selectedSnapshot.exists)
        throw new ApiAuthError("That application could not be found.", 404);
      const currentStatus = gigStatus(gig.status ?? "open");
      if (currentStatus !== "open") {
        if (
          String(gig.selectedApplicantId ?? "") === applicantId &&
          ["hired", "terms_pending", "awaiting_funding", "in_progress", "submitted", "completed"].includes(
            currentStatus,
          )
        )
          return;
        throw new ApiAuthError(
          "A student has already been selected for this gig.",
          409,
        );
      }
      assertGigTransition(currentStatus, "hired");
      const selected = selectedSnapshot.data() ?? {};
      transaction.update(gigReference, {
        status: "hired",
        version: FieldValue.increment(1),
        selectedApplicantId: applicantId,
        selectedApplicantName: String(
          selected.applicantName ?? "CampusGig student",
        ),
        selectedApplicationId: selectedReference.id,
        selectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (!conversationSnapshot.exists) {
        transaction.create(conversationReference, {
          gigId: id,
          ownerId: decoded.uid,
          studentId: applicantId,
          ownerName: String(gig.posterName ?? "CampusGig client"),
          studentName: String(selected.applicantName ?? "CampusGig student"),
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
      for (const document of allApplications.docs) {
        const application = document.data() ?? {};
        const applicationUserId = String(application.applicantId ?? "");
        const accepted = document.id === selectedReference.id;
        transaction.update(document.ref, {
          status: accepted ? "accepted" : "rejected",
          updatedAt: FieldValue.serverTimestamp(),
        });
        writeUserNotification(transaction, adminDb, {
          userId: applicationUserId,
          eventId: `application_decision_${id}`,
          type: accepted ? "hiring" : "application",
          title: accepted ? "You were selected" : "Application update",
          body: accepted
            ? `The client selected you for “${String(gig.title ?? "this gig")}”. Open the contract chat to agree final terms.`
            : `The client chose another applicant for “${String(gig.title ?? "this gig")}”.`,
          href: accepted ? `/gigs/${id}/conversation` : "/applications",
          gigId: id,
          actorId: decoded.uid,
        });
      }
      writeGigEvent(transaction, gigReference, {
        id: `student_selected_${applicantId}`,
        type: "student_selected",
        actorId: decoded.uid,
        actorRole: "client",
        fromStatus: currentStatus,
        toStatus: "hired",
        metadata: {
          applicantId,
          applicationId: selectedReference.id,
        },
      });
    });

    return Response.json({
      ok: true,
      status: "hired",
      selectedApplicantId: applicantId,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
