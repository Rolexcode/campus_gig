import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { ApiAuthError, apiErrorResponse, requireMarketplaceUser } from "@/app/lib/server-auth";
import { usernameSearchPrefix } from "@/app/lib/usernames";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireMarketplaceUser(request);
    const requestUrl = new URL(request.url);
    let query: string;
    try {
      query = usernameSearchPrefix(requestUrl.searchParams.get("q"));
    } catch (error) {
      throw new ApiAuthError(error instanceof Error ? error.message : "Enter a valid username.", 400);
    }
    if (!query) return Response.json({ users: [] });

    const { adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb
      .collection("users")
      .orderBy("usernameNormalized")
      .startAt(query)
      .endAt(`${query}\uf8ff`)
      .limit(25)
      .get();

    const users = snapshot.docs
      .map((document) => ({ uid: document.id, ...document.data() }) as Record<string, unknown> & { uid: string })
      .filter((profile) => profile.onboardingComplete === true)
      .map((profile) => ({
        uid: String(profile.uid ?? ""),
        username: String(profile.username ?? ""),
        fullName: String(profile.fullName ?? "CampusGig member"),
        university: String(profile.university ?? ""),
        headline: String(profile.headline ?? ""),
        skills: String(profile.skills ?? ""),
        photoDataUrl: String(profile.photoDataUrl ?? ""),
        studentVerified: profile.studentVerified === true,
        averageRating: Number(profile.averageRating ?? 0),
        completedGigCount: Number(profile.completedGigCount ?? 0),
      }));

    return Response.json({ users });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
