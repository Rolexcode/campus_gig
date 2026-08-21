import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, isConfiguredAdminEmail, requireAdmin } from "@/app/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb.collection("users").orderBy("createdAt", "desc").limit(100).get();
    const identifiers = snapshot.docs.map((document) => ({ uid: document.id }));
    const authUsers = identifiers.length ? await adminAuth.getUsers(identifiers) : { users: [], notFound: [] };
    const authByUid = new Map(authUsers.users.map((record) => [record.uid, record]));

    const users = snapshot.docs.flatMap((document) => {
      const data = document.data();
      const authUser = authByUid.get(document.id);
      if (!authUser || isConfiguredAdminEmail(authUser.email ?? String(data.email ?? ""))) return [];
      return [{
        uid: document.id,
        fullName: String(data.fullName ?? authUser?.displayName ?? "CampusGig member"),
        email: String(data.email ?? authUser?.email ?? ""),
        university: String(data.university ?? "Not added"),
        onboardingComplete: data.onboardingComplete === true,
        studentVerified: data.studentVerified === true,
        verificationStatus: String(data.verificationStatus ?? "unsubmitted"),
        emailVerified: authUser?.emailVerified ?? data.emailVerified === true,
        createdAt: authUser?.metadata.creationTime ?? null,
        lastSignInAt: authUser?.metadata.lastSignInTime ?? null,
      }];
    });

    return Response.json({ users });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
