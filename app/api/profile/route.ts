import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { ApiAuthError, apiErrorResponse, requireFirebaseUser } from "@/app/lib/server-auth";
import { validatedUsername } from "@/app/lib/usernames";

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

    let username: string;
    try {
      username = validatedUsername(body.username);
    } catch (error) {
      throw new ApiAuthError(error instanceof Error ? error.message : "Choose a valid username.", 400);
    }

    for (const [field, limit] of Object.entries(fieldLimits)) {
      const value = String(body[field] ?? "").trim();
      if (value.length > limit) return Response.json({ error: `${field} is too long.` }, { status: 400 });
      profile[field] = value;
    }

    if (!profile.fullName) return Response.json({ error: "Add your display name." }, { status: 400 });
    for (const field of ["portfolio", "linkedIn", "gitHub"] as const) {
      if (!profile[field]) continue;
      try {
        const url = new URL(profile[field]);
        if (url.protocol !== "https:") throw new Error("Unsupported URL protocol");
      } catch {
        return Response.json(
          { error: `${field} must be a complete https:// URL.` },
          { status: 400 },
        );
      }
    }
    const photoDataUrl = String(body.photoDataUrl ?? "");
    if (photoDataUrl && !/^data:image\/jpeg;base64,/.test(photoDataUrl)) {
      return Response.json({ error: "The profile photo format is not supported." }, { status: 400 });
    }
    if (photoDataUrl.length > 260_000) {
      return Response.json({ error: "The profile photo is too large." }, { status: 413 });
    }

    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const profileReference = adminDb.collection("users").doc(decoded.uid);
    await adminDb.runTransaction(async (transaction) => {
      const profileSnapshot = await transaction.get(profileReference);
      if (!profileSnapshot.exists) throw new ApiAuthError("Your profile could not be found.", 404);
      const previousUsername = String(profileSnapshot.data()?.usernameNormalized ?? "");
      const nextUsernameReference = adminDb.collection("usernames").doc(username);
      const nextUsernameSnapshot = await transaction.get(nextUsernameReference);
      if (nextUsernameSnapshot.exists && nextUsernameSnapshot.data()?.uid !== decoded.uid) {
        throw new ApiAuthError("That username is already taken. Choose another one.", 409);
      }

      if (previousUsername && previousUsername !== username) {
        transaction.delete(adminDb.collection("usernames").doc(previousUsername));
      }
      transaction.set(nextUsernameReference, {
        uid: decoded.uid,
        username,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(profileReference, {
        ...profile,
        username,
        usernameNormalized: username,
        photoDataUrl,
        onboardingComplete: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await adminAuth.updateUser(decoded.uid, { displayName: profile.fullName });

    return Response.json({ saved: true, profile: { ...profile, username, photoDataUrl, onboardingComplete: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
