import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  ApiAuthError,
  apiErrorResponse,
  requireFirebaseUser,
  tokenHasAdminEmail,
} from "@/app/lib/server-auth";
import { validatedUsername } from "@/app/lib/usernames";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (tokenHasAdminEmail(decoded)) {
      throw new ApiAuthError("Use the dedicated administrator sign-up page for this email.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const fullName = String(body.fullName ?? "").trim();
    if (!fullName || fullName.length > 100) {
      throw new ApiAuthError("Enter a display name of 100 characters or fewer.", 400);
    }

    let username: string;
    try {
      username = validatedUsername(body.username);
    } catch (error) {
      throw new ApiAuthError(error instanceof Error ? error.message : "Choose a valid username.", 400);
    }

    const email = String(decoded.email ?? "").trim().toLowerCase();
    if (!email) throw new ApiAuthError("Your account does not have an email address.", 400);

    const { adminDb } = getFirebaseAdminServices();
    const profileReference = adminDb.collection("users").doc(decoded.uid);
    const usernameReference = adminDb.collection("usernames").doc(username);

    await adminDb.runTransaction(async (transaction) => {
      const [profileSnapshot, usernameSnapshot] = await transaction.getAll(
        profileReference,
        usernameReference,
      );
      if (profileSnapshot.exists) {
        throw new ApiAuthError("This account is already registered. Log in instead.", 409);
      }
      if (usernameSnapshot.exists && usernameSnapshot.data()?.uid !== decoded.uid) {
        throw new ApiAuthError("That username is already taken. Choose another one.", 409);
      }

      transaction.create(profileReference, {
        uid: decoded.uid,
        email,
        fullName,
        username,
        usernameNormalized: username,
        emailVerified: decoded.email_verified === true,
        studentVerified: false,
        verificationStatus: "unsubmitted",
        onboardingComplete: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(usernameReference, {
        uid: decoded.uid,
        username,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return Response.json({ registered: true, username });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
