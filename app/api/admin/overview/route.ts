import { calculateRegistrationMetrics } from "@/app/lib/admin-analytics";
import { listMarketplaceAuthUsers } from "@/app/lib/admin-users";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireAdmin } from "@/app/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
}

async function countQuery(query: FirebaseFirestore.Query) {
  const result = await query.count().get();
  return result.data().count;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const authUsers = await listMarketplaceAuthUsers(adminAuth);
    const registration = calculateRegistrationMetrics(
      authUsers.map((record) => ({
        createdAt: record.metadata.creationTime ?? null,
        emailVerified: record.emailVerified,
        disabled: record.disabled,
      })),
    );

    const [
      verifiedUsers,
      onboardedUsers,
      pendingVerifications,
      openGigs,
      activeGigs,
      completedGigs,
      disputedGigs,
      openSafetyReports,
      fundingPendingPayments,
      fundedPayments,
      completedPayments,
      failedPayments,
      recentAuditSnapshot,
    ] =
      await Promise.all([
        countQuery(adminDb.collection("users").where("studentVerified", "==", true)),
        countQuery(adminDb.collection("users").where("onboardingComplete", "==", true)),
        countQuery(
          adminDb.collection("studentVerificationRequests").where("status", "==", "pending"),
        ),
        countQuery(adminDb.collection("gigs").where("status", "==", "open")),
        countQuery(adminDb.collection("gigs").where("status", "in", [
          "hired",
          "terms_pending",
          "awaiting_funding",
          "in_progress",
          "submitted",
        ])),
        countQuery(adminDb.collection("gigs").where("status", "==", "completed")),
        countQuery(adminDb.collection("gigs").where("status", "==", "disputed")),
        countQuery(
          adminDb.collection("safetyReports").where("status", "in", ["open", "reviewing"]),
        ),
        countQuery(adminDb.collection("gigPayments").where("status", "==", "funding_pending")),
        countQuery(adminDb.collection("gigPayments").where("status", "==", "funded")),
        countQuery(adminDb.collection("gigPayments").where("status", "==", "completed")),
        countQuery(adminDb.collection("gigPayments").where("status", "==", "failed")),
        adminDb.collection("adminAuditEvents").orderBy("createdAt", "desc").limit(8).get().catch(() => null),
      ]);

    const recentActivity = (recentAuditSnapshot?.docs ?? []).map((document) => {
      const data = document.data();
      return {
        id: document.id,
        action: String(data.action ?? data.type ?? "Admin action"),
        entity: String(data.entityType ?? data.resourceType ?? "account"),
        status: String(data.status ?? "recorded"),
        createdAt: dateValue(data.createdAt),
      };
    });

    return Response.json({
      metrics: {
        ...registration,
        verifiedUsers,
        onboardedUsers,
        pendingVerifications,
        openGigs,
        activeGigs,
        completedGigs,
        disputedGigs,
        openSafetyReports,
        fundingPendingPayments,
        fundedPayments,
        completedPayments,
        failedPayments,
        recentActivity,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
