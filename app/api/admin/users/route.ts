import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireAdmin } from "@/app/lib/server-auth";
import { listMarketplaceAuthUsers, loadUserProfiles } from "@/app/lib/admin-users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const authUsers = await listMarketplaceAuthUsers(adminAuth);
    const profiles = await loadUserProfiles(adminDb, authUsers.map((record) => record.uid));
    const users = authUsers
      .sort((left, right) => Date.parse(right.metadata.creationTime) - Date.parse(left.metadata.creationTime))
      .map((authUser) => {
      const data = profiles.get(authUser.uid) ?? {};
      return {
        uid: authUser.uid,
        fullName: String(data.fullName ?? authUser.displayName ?? "CampusGig member"),
        email: String(data.email ?? authUser.email ?? ""),
        university: String(data.university ?? "Not added"),
        onboardingComplete: data.onboardingComplete === true,
        studentVerified: data.studentVerified === true,
        verificationStatus: String(data.verificationStatus ?? "unsubmitted"),
        emailVerified: authUser.emailVerified,
        disabled: authUser.disabled,
        createdAt: authUser.metadata.creationTime ?? null,
        lastSignInAt: authUser.metadata.lastSignInTime ?? null,
      };
    });

    return Response.json({ users });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
