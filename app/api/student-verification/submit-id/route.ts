import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireFirebaseUser } from "@/app/lib/server-auth";

export const runtime = "nodejs";

const MAX_DATA_URL_LENGTH = 780_000;

export async function POST(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (!decoded.email_verified) {
      return Response.json({ error: "Verify your CampusGig account email first." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const imageDataUrl = String(body.imageDataUrl ?? "");
    const fileName = String(body.fileName ?? "student-id.jpg").slice(0, 160);
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl)) {
      return Response.json({ error: "Upload a JPG, PNG, or WebP image of your student ID." }, { status: 400 });
    }
    if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
      return Response.json({ error: "That image is still too large. Choose a clearer image under 600 KB." }, { status: 413 });
    }

    const { adminDb } = getFirebaseAdminServices();
    const userReference = adminDb.collection("users").doc(decoded.uid);
    const userSnapshot = await userReference.get();
    const userData = userSnapshot.data();
    if (!String(userData?.university ?? "").trim()) {
      return Response.json({ error: "Add your university to your profile before submitting an ID." }, { status: 400 });
    }
    if (userData?.studentVerified === true) return Response.json({ verified: true });

    const requestReference = adminDb.collection("studentVerificationRequests").doc(decoded.uid);
    const batch = adminDb.batch();
    batch.set(requestReference, {
      uid: decoded.uid,
      fullName: String(userData?.fullName ?? decoded.name ?? "CampusGig member"),
      email: String(userData?.email ?? decoded.email ?? ""),
      country: String(userData?.country ?? ""),
      university: String(userData?.university ?? ""),
      method: "student-id",
      status: "pending",
      fileName,
      imageDataUrl,
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(userReference, {
      studentVerified: false,
      verificationStatus: "pending",
      verificationMethod: "student-id",
      verificationSubmittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    return Response.json({ submitted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
