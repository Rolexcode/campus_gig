import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, isConfiguredAdminEmail, requireAdmin } from "@/app/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb.collection("studentVerificationRequests").orderBy("submittedAt", "desc").limit(100).get();
    const identifiers = snapshot.docs.map((document) => ({ uid: document.id }));
    const authUsers = identifiers.length ? await adminAuth.getUsers(identifiers) : { users: [] };
    const authByUid = new Map(authUsers.users.map((record) => [record.uid, record]));
    const requests = snapshot.docs.flatMap((document) => {
      const data = document.data();
      const authUser = authByUid.get(document.id);
      if (!authUser || isConfiguredAdminEmail(authUser.email ?? String(data.email ?? ""))) return [];
      return [{
        uid: document.id,
        fullName: String(data.fullName ?? "CampusGig member"),
        email: String(data.email ?? ""),
        country: String(data.country ?? ""),
        university: String(data.university ?? ""),
        status: String(data.status ?? "pending"),
        fileName: String(data.fileName ?? "Student ID"),
        imageDataUrl: String(data.imageDataUrl ?? ""),
        submittedAt: data.submittedAt?.toDate?.().toISOString?.() ?? null,
      }];
    });
    return Response.json({ requests });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const uid = String(body.uid ?? "").trim();
    const decision = String(body.decision ?? "");
    if (!uid || !["approved", "rejected"].includes(decision)) {
      return Response.json({ error: "Choose a valid verification request and decision." }, { status: 400 });
    }

    const { adminDb } = getFirebaseAdminServices();
    const requestReference = adminDb.collection("studentVerificationRequests").doc(uid);
    const userReference = adminDb.collection("users").doc(uid);
    const [snapshot, userSnapshot] = await Promise.all([requestReference.get(), userReference.get()]);
    if (!userSnapshot.exists) return Response.json({ error: "That user no longer exists." }, { status: 404 });
    if (String(userSnapshot.data()?.verificationStatus ?? "unsubmitted") === "unsubmitted") {
      return Response.json({ error: "This user has not submitted student verification." }, { status: 400 });
    }

    const approved = decision === "approved";
    const batch = adminDb.batch();
    if (snapshot.exists) {
      batch.set(requestReference, {
        status: decision,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: admin.email ?? admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    batch.set(userReference, {
      studentVerified: approved,
      verificationStatus: decision,
      studentVerifiedAt: approved ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    return Response.json({ updated: true, status: decision });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
