import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import type {
  GigCategory,
  MarketplaceGig,
  SettlementPreference,
} from "@/app/lib/gigs";
import { apiErrorResponse } from "@/app/lib/server-auth";
import { gigStatus } from "@/app/lib/gig-contracts";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb.collection("gigs").doc(id).get();
    if (!snapshot.exists)
      return Response.json(
        { error: "This gig could not be found." },
        { status: 404 },
      );
    const data = snapshot.data() ?? {};
    const gig: MarketplaceGig = {
      id: snapshot.id,
      ownerId: String(data.ownerId ?? ""),
      title: String(data.title ?? ""),
      summary: String(data.summary ?? ""),
      description: String(data.description ?? ""),
      category: String(data.category ?? "Other") as GigCategory,
      country: String(data.country ?? ""),
      currency: String(data.currency ?? ""),
      settlementPreference: String(
        data.settlementPreference ?? "local",
      ) as SettlementPreference,
      budget: Number(data.budget ?? 0),
      deadline: String(data.deadline ?? ""),
      status: gigStatus(data.status ?? "open"),
      version: Number(data.version ?? 1),
      applicantCount: Number(data.applicantCount ?? 0),
      posterName: String(data.posterName ?? "CampusGig member"),
      posterUniversity: String(
        data.posterUniversity ?? "Institution not added",
      ),
      selectedApplicantId: String(data.selectedApplicantId ?? ""),
      selectedApplicantName: String(data.selectedApplicantName ?? ""),
      agreementStatus:
        data.agreementStatus === "accepted"
          ? "accepted"
          : data.agreementStatus === "proposed"
            ? "proposed"
            : "draft",
      createdAt: dateValue(data.createdAt),
      updatedAt: dateValue(data.updatedAt),
    };
    return Response.json({ gig });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
