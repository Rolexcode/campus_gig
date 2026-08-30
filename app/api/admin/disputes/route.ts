import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import {
  ApiAuthError,
  apiErrorResponse,
  requireAdmin,
} from "@/app/lib/server-auth";
import { writeUserNotification } from "@/app/lib/user-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function cleanId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    throw new ApiAuthError("Choose a valid dispute.", 400);
  }
  return id;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb
      .collection("gigDisputes")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    const gigSnapshots = snapshot.empty
      ? []
      : await adminDb.getAll(
          ...snapshot.docs.map((document) =>
            adminDb.collection("gigs").doc(document.id),
          ),
        );
    const gigs = new Map(
      gigSnapshots.map((document) => [
        document.id,
        document.exists ? document.data() ?? {} : {},
      ]),
    );
    const disputes = snapshot.docs.map((document) => {
      const data = document.data();
      const gig = gigs.get(document.id) ?? {};
      return {
        gigId: document.id,
        gigTitle: String(gig.title ?? "Unknown gig"),
        clientName: String(gig.posterName ?? "CampusGig client"),
        studentName: String(gig.selectedApplicantName ?? "CampusGig student"),
        status: String(data.status ?? "open"),
        category: String(data.category ?? "other"),
        description: String(data.description ?? ""),
        openedByRole: String(data.openedByRole ?? ""),
        resolutionNote: String(data.resolutionNote ?? ""),
        createdAt: dateValue(data.createdAt),
        resolvedAt: dateValue(data.resolvedAt),
      };
    });
    return Response.json({ disputes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const gigId = cleanId(body.gigId);
    const action = String(body.action ?? "");
    const resolutionNote = String(body.resolutionNote ?? "").trim();
    if (action !== "resume") {
      throw new ApiAuthError(
        "Only safe contract resumption is available here. Refunds require a confirmed on-chain transfer.",
        400,
      );
    }
    if (resolutionNote.length < 20 || resolutionNote.length > 1_000) {
      throw new ApiAuthError("Add a resolution note between 20 and 1,000 characters.", 400);
    }

    const { adminDb } = getFirebaseAdminServices();
    const disputeReference = adminDb.collection("gigDisputes").doc(gigId);
    const gigReference = adminDb.collection("gigs").doc(gigId);
    const paymentReference = adminDb.collection("gigPayments").doc(gigId);
    await adminDb.runTransaction(async (transaction) => {
      const [disputeSnapshot, gigSnapshot, paymentSnapshot] = await Promise.all([
        transaction.get(disputeReference),
        transaction.get(gigReference),
        transaction.get(paymentReference),
      ]);
      if (!disputeSnapshot.exists || !gigSnapshot.exists || !paymentSnapshot.exists) {
        throw new ApiAuthError("The dispute records could not be found.", 404);
      }
      const dispute = disputeSnapshot.data() ?? {};
      const gig = gigSnapshot.data() ?? {};
      const payment = paymentSnapshot.data() ?? {};
      if (dispute.status !== "open" || gigStatus(gig.status) !== "disputed") {
        throw new ApiAuthError("This dispute is no longer open.", 409);
      }
      if (payment.status !== "disputed") {
        throw new ApiAuthError("The payment freeze is not in the expected state.", 409);
      }
      const nextGigStatus = String(dispute.priorGigStatus ?? "") as
        | "in_progress"
        | "submitted";
      const nextPaymentStatus = String(dispute.priorPaymentStatus ?? "");
      if (!["in_progress", "submitted"].includes(nextGigStatus)) {
        throw new ApiAuthError("The previous gig state cannot be restored safely.", 409);
      }
      if (!["funded", "submitted"].includes(nextPaymentStatus)) {
        throw new ApiAuthError("The previous payment state cannot be restored safely.", 409);
      }
      assertGigTransition("disputed", nextGigStatus);
      transaction.update(disputeReference, {
        status: "resolved",
        resolution: "resumed",
        resolutionNote,
        resolvedBy: admin.email ?? admin.uid,
        resolvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(gigReference, {
        status: nextGigStatus,
        disputeStatus: "resolved",
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(paymentReference, {
        status: nextPaymentStatus,
        disputeStatus: "resolved",
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, gigReference, {
        id: "dispute_resolved_resumed",
        type: "dispute_resolved",
        actorId: admin.uid,
        actorRole: "admin",
        fromStatus: "disputed",
        toStatus: nextGigStatus,
        metadata: { resolution: "resumed" },
      });
      for (const userId of [String(dispute.clientId ?? ""), String(dispute.studentId ?? "")]) {
        writeUserNotification(transaction, adminDb, {
          userId,
          eventId: `dispute_resolved_${gigId}`,
          type: "system",
          title: "Contract dispute resolved",
          body: "CampusGig reviewed the case and resumed the contract. Open the workspace to continue from the preserved state.",
          href: `/gigs/${gigId}/conversation`,
          gigId,
          actorId: admin.uid,
        });
      }
    });
    return Response.json({ updated: true, status: "resolved" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
