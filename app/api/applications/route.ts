import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import type {
  GigCategory,
  MarketplaceApplication,
  MarketplaceGig,
  SettlementPreference,
} from "@/app/lib/gigs";
import { gigStatus } from "@/app/lib/gig-contracts";
import {
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

function gigValue(id: string, data: Record<string, unknown>): MarketplaceGig {
  return {
    id,
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
    posterUniversity: String(data.posterUniversity ?? "Institution not added"),
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
}

export async function GET(request: Request) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb
      .collection("applications")
      .where("applicantId", "==", decoded.uid)
      .get();
    const rows = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        gigId: String(data.gigId ?? ""),
        applicantId: decoded.uid,
        applicantName: String(data.applicantName ?? "CampusGig student"),
        applicantUniversity: String(
          data.applicantUniversity ?? "Institution not added",
        ),
        note: String(data.note ?? ""),
        status: String(
          data.status ?? "pending",
        ) as MarketplaceApplication["status"],
        createdAt: dateValue(data.createdAt),
        updatedAt: dateValue(data.updatedAt),
      };
    });
    const gigSnapshots = rows.length
      ? await adminDb.getAll(
          ...rows.map((item) => adminDb.collection("gigs").doc(item.gigId)),
        )
      : [];
    const gigs = new Map(
      gigSnapshots.map((gig) => [
        gig.id,
        gig.exists ? gigValue(gig.id, gig.data() ?? {}) : undefined,
      ]),
    );
    const applications = rows
      .map((application) => ({
        ...application,
        gig: gigs.get(application.gigId),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return Response.json({ applications });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
