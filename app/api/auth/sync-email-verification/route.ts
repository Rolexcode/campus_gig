import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireFirebaseUser } from "@/app/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (!decoded.email_verified) {
      return Response.json(
        { error: "Open the verification link in your inbox before continuing." },
        { status: 400 },
      );
    }

    const { adminDb } = getFirebaseAdminServices();
    await adminDb.collection("users").doc(decoded.uid).set({
      emailVerified: true,
      emailVerifiedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return Response.json({ verified: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
