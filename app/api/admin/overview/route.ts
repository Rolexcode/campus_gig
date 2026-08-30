import { calculateRegistrationMetrics } from "@/app/lib/admin-analytics";
import { listMarketplaceAuthUsers } from "@/app/lib/admin-users";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireAdmin } from "@/app/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const [verifiedUsers, pendingVerifications, openGigs, activeGigs, completedGigs, disputedGigs] =
      await Promise.all([
        countQuery(adminDb.collection("users").where("studentVerified", "==", true)),
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
      ]);

    return Response.json({
      metrics: {
        ...registration,
        verifiedUsers,
        pendingVerifications,
        openGigs,
        activeGigs,
        completedGigs,
        disputedGigs,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
