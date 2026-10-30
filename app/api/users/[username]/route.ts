import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireMarketplaceUser } from "@/app/lib/server-auth";
import { normalizePortfolioLinks } from "@/app/lib/profile-details";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  try {
    await requireMarketplaceUser(request);
    const username = decodeURIComponent((await context.params).username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return Response.json({ error: "That username is not valid." }, { status: 400 });
    }
    const { adminDb } = getFirebaseAdminServices();
    const usernameSnapshot = await adminDb.collection("usernames").doc(username).get();
    if (!usernameSnapshot.exists) return Response.json({ error: "Profile not found." }, { status: 404 });
    const uid = String(usernameSnapshot.data()?.uid ?? "");
    const profileSnapshot = await adminDb.collection("users").doc(uid).get();
    if (!profileSnapshot.exists || profileSnapshot.data()?.onboardingComplete !== true) {
      return Response.json({ error: "Profile not found." }, { status: 404 });
    }
    const profile = profileSnapshot.data() ?? {};
    const reviewsSnapshot = await adminDb.collection("gigReviews").where("studentId", "==", uid).limit(50).get();
    const reviews = reviewsSnapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        clientName: String(data.clientName ?? "CampusGig client"),
        rating: Number(data.rating ?? 0),
        review: String(data.review ?? ""),
        createdAt: isoDate(data.createdAt),
      };
    }).filter((item) => Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5 && item.review).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

    return Response.json({
      profile: {
        username: String(profile.username ?? username),
        fullName: String(profile.fullName ?? "CampusGig member"),
        country: String(profile.country ?? ""),
        university: String(profile.university ?? ""),
        course: String(profile.course ?? ""),
        headline: String(profile.headline ?? ""),
        bio: String(profile.bio ?? ""),
        skills: String(profile.skills ?? ""),
        availability: String(profile.availability ?? ""),
        yearsExperience: Number(profile.yearsExperience ?? 0),
        languages: String(profile.languages ?? ""),
        photoDataUrl: String(profile.photoDataUrl ?? ""),
        portfolioLinks: normalizePortfolioLinks(profile.portfolioLinks),
        studentVerified: profile.studentVerified === true || profile.verificationStatus === "approved",
        completedGigCount: Number(profile.completedGigCount ?? 0),
        averageRating: Number(profile.averageRating ?? 0),
        ratingCount: Number(profile.ratingCount ?? 0),
      },
      reviews,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
