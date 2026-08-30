import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, isConfiguredAdminEmail, requireAdmin } from "@/app/lib/server-auth";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function timestampValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

export async function GET(request: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    await requireAdmin(request);
    const { uid } = await context.params;
    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const [authUser, profileSnapshot, verificationSnapshot] = await Promise.all([
      adminAuth.getUser(uid),
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("studentVerificationRequests").doc(uid).get(),
    ]);

    if (isConfiguredAdminEmail(authUser.email)) {
      return Response.json({ error: "Administrator identities are not marketplace users." }, { status: 404 });
    }
    if (!profileSnapshot.exists) return Response.json({ error: "That user profile no longer exists." }, { status: 404 });
    const data = profileSnapshot.data()!;
    const verification = verificationSnapshot.exists ? verificationSnapshot.data()! : null;

    return Response.json({
      user: {
        uid,
        fullName: String(data.fullName ?? authUser.displayName ?? "CampusGig member"),
        email: String(data.email ?? authUser.email ?? ""),
        emailVerified: authUser.emailVerified,
        disabled: authUser.disabled,
        country: String(data.country ?? ""),
        university: String(data.university ?? ""),
        course: String(data.course ?? ""),
        headline: String(data.headline ?? ""),
        bio: String(data.bio ?? ""),
        skills: String(data.skills ?? ""),
        portfolio: String(data.portfolio ?? ""),
        linkedIn: String(data.linkedIn ?? ""),
        gitHub: String(data.gitHub ?? ""),
        availability: String(data.availability ?? ""),
        photoDataUrl: String(data.photoDataUrl ?? ""),
        onboardingComplete: data.onboardingComplete === true,
        studentVerified: data.studentVerified === true,
        verificationStatus: String(data.verificationStatus ?? "unsubmitted"),
        verificationMethod: String(data.verificationMethod ?? ""),
        schoolEmail: String(data.schoolEmail ?? ""),
        verificationSubmittedAt: timestampValue(data.verificationSubmittedAt),
        studentVerifiedAt: timestampValue(data.studentVerifiedAt),
        createdAt: authUser.metadata.creationTime ?? null,
        lastSignInAt: authUser.metadata.lastSignInTime ?? null,
        verificationRequest: verification ? {
          status: String(verification.status ?? "pending"),
          fileName: String(verification.fileName ?? "Student ID"),
          imageDataUrl:
            String(verification.status ?? "pending") === "pending"
              ? String(verification.imageDataUrl ?? "")
              : "",
          submittedAt: timestampValue(verification.submittedAt),
        } : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ uid: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { uid } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (!['disable', 'enable'].includes(action)) {
      return Response.json({ error: "Choose enable or disable." }, { status: 400 });
    }
    if (uid === admin.uid) {
      return Response.json({ error: "You cannot change your own administrator account here." }, { status: 400 });
    }

    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const target = await adminAuth.getUser(uid);
    if (isConfiguredAdminEmail(target.email)) {
      return Response.json({ error: "Administrator identities cannot be managed as marketplace users." }, { status: 403 });
    }

    const disabled = action === "disable";
    await adminAuth.updateUser(uid, { disabled });
    if (disabled) await adminAuth.revokeRefreshTokens(uid);
    await adminDb.collection("adminAuditEvents").add({
      action: disabled ? "user_disabled" : "user_enabled",
      actorUid: admin.uid,
      actorEmail: admin.email ?? "",
      targetUid: uid,
      targetEmail: target.email ?? "",
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ updated: true, disabled });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
