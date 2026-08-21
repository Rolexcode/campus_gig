import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
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
      if (String(gig.status ?? "open") !== "open") {
        if (String(gig.selectedApplicantId ?? "") === applicantId) return;
        throw new ApiAuthError(
          "A student has already been selected for this gig.",
          409,
        );
      }
      const selected = selectedSnapshot.data() ?? {};
      transaction.update(gigReference, {
        status: "awaiting_funding",
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
        transaction.update(document.ref, {
          status:
            document.id === selectedReference.id ? "accepted" : "rejected",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return Response.json({
      ok: true,
      status: "awaiting_funding",
      selectedApplicantId: applicantId,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
