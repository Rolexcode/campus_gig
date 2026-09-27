import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireAdmin } from "@/app/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb
      .collection("gigs")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    const paymentSnapshots = snapshot.empty
      ? []
      : await adminDb.getAll(
          ...snapshot.docs.map((document) =>
            adminDb.collection("gigPayments").doc(document.id),
          ),
        );
    const payments = new Map(
      paymentSnapshots.map((document) => [
        document.id,
        document.exists ? document.data() ?? {} : {},
      ]),
    );
    const gigs = snapshot.docs.map((document) => {
      const data = document.data();
      const payment = payments.get(document.id) ?? {};
      return {
        id: document.id,
        title: String(data.title ?? "Untitled gig"),
        category: String(data.category ?? "Other"),
        clientId: String(data.ownerId ?? ""),
        clientName: String(data.posterName ?? "CampusGig client"),
        studentId: String(data.selectedApplicantId ?? ""),
        studentName: String(data.selectedApplicantName ?? ""),
        budget: Number(data.budget ?? 0),
        currency: String(data.currency ?? ""),
        settlementPreference: String(data.settlementPreference ?? ""),
        applicantCount: Number(data.applicantCount ?? 0),
        status: String(data.status ?? "draft"),
        paymentStatus: String(payment.status ?? data.paymentStatus ?? ""),
        fundingSignature: String(payment.fundingSignature ?? ""),
        releaseSignature: String(payment.releaseSignature ?? ""),
        paymentProvider: String(payment.provider ?? ""),
        providerTransactionId: String(payment.providerTransactionId ?? ""),
        providerReference: String(payment.providerReference ?? ""),
        createdAt: dateValue(data.createdAt),
        updatedAt: dateValue(data.updatedAt),
      };
    });
    return Response.json({ gigs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
