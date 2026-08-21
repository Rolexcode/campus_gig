import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireFirebaseUser } from "@/app/lib/server-auth";

export const runtime = "nodejs";

const fieldLimits: Record<string, number> = {
  fullName: 100,
  country: 80,
  university: 180,
  course: 140,
  headline: 160,
  bio: 400,
  skills: 500,
  portfolio: 500,
  linkedIn: 500,
  gitHub: 500,
  availability: 120,
  photoName: 160,
};

export async function POST(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const profile: Record<string, string> = {};

    for (const [field, limit] of Object.entries(fieldLimits)) {
      const value = String(body[field] ?? "").trim();
      if (value.length > limit) return Response.json({ error: `${field} is too long.` }, { status: 400 });
      profile[field] = value;
    }

    if (!profile.fullName) return Response.json({ error: "Add your display name." }, { status: 400 });
    const photoDataUrl = String(body.photoDataUrl ?? "");
    if (photoDataUrl && !/^data:image\/jpeg;base64,/.test(photoDataUrl)) {
      return Response.json({ error: "The profile photo format is not supported." }, { status: 400 });
    }
    if (photoDataUrl.length > 260_000) {
      return Response.json({ error: "The profile photo is too large." }, { status: 413 });
    }

    const { adminAuth, adminDb } = getFirebaseAdminServices();
    await Promise.all([
      adminAuth.updateUser(decoded.uid, { displayName: profile.fullName }),
      adminDb.collection("users").doc(decoded.uid).set({
        ...profile,
        photoDataUrl,
        onboardingComplete: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);

    return Response.json({ saved: true, profile: { ...profile, photoDataUrl, onboardingComplete: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
