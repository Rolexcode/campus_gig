import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import type { MarketplaceApplication } from "@/app/lib/gigs";
import { apiErrorResponse, ApiAuthError, requireMarketplaceUser } from "@/app/lib/server-auth";

export const runtime = "nodejs";

function cleanId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new ApiAuthError("That gig identifier is invalid.", 400);
  return value;
}

function cleanNote(value: unknown) {
  const note = String(value ?? "").trim().replace(/\r\n/g, "\n");
  if (note.length < 20 || note.length > 600) throw new ApiAuthError("Write an application note between 20 and 600 characters.", 400);
  return note;
}

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

function applicationValue(id: string, data: Record<string, unknown>): MarketplaceApplication {
  return {
    id,
    gigId: String(data.gigId ?? ""),
    applicantId: String(data.applicantId ?? ""),
    applicantName: String(data.applicantName ?? "CampusGig student"),
    applicantUniversity: String(data.applicantUniversity ?? "Institution not added"),
    note: String(data.note ?? ""),
    status: String(data.status ?? "pending") as MarketplaceApplication["status"],
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
  };
}

function profileValue(data: Record<string, unknown>) {
  return {
    fullName: String(data.fullName ?? "CampusGig student"),
    email: String(data.email ?? ""),
    university: String(data.university ?? "Institution not added"),
    course: String(data.course ?? ""),
    headline: String(data.headline ?? ""),
    bio: String(data.bio ?? ""),
    skills: String(data.skills ?? ""),
    portfolio: String(data.portfolio ?? ""),
    linkedIn: String(data.linkedIn ?? ""),
    gitHub: String(data.gitHub ?? ""),
    availability: String(data.availability ?? ""),
    photoDataUrl: String(data.photoDataUrl ?? ""),
    studentVerified: data.studentVerified === true,
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    const gigSnapshot = await adminDb.collection("gigs").doc(id).get();
    if (!gigSnapshot.exists) throw new ApiAuthError("This gig could not be found.", 404);
    const gig = gigSnapshot.data() ?? {};

    if (String(gig.ownerId ?? "") !== decoded.uid) {
      const ownSnapshot = await adminDb.collection("applications").doc(`${id}__${decoded.uid}`).get();
      return Response.json({ application: ownSnapshot.exists ? applicationValue(ownSnapshot.id, ownSnapshot.data() ?? {}) : null });
    }

    const snapshot = await adminDb.collection("applications").where("gigId", "==", id).get();
    const rows = snapshot.docs.map((document) => applicationValue(document.id, document.data()));
    const profileSnapshots = rows.length
      ? await adminDb.getAll(...rows.map((item) => adminDb.collection("users").doc(item.applicantId)))
      : [];
    const profiles = new Map(profileSnapshots.map((profile) => [profile.id, profile.exists ? profileValue(profile.data() ?? {}) : null]));
    const applications = rows
      .map((application) => ({ ...application, profile: profiles.get(application.applicantId) ?? undefined }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return Response.json({ applications });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanId(rawId);
    const body = await request.json().catch(() => ({}));
    const note = cleanNote(body.note);
    const { adminDb } = getFirebaseAdminServices();
    const gigReference = adminDb.collection("gigs").doc(id);
    const profileReference = adminDb.collection("users").doc(decoded.uid);
    const applicationReference = adminDb.collection("applications").doc(`${id}__${decoded.uid}`);

    await adminDb.runTransaction(async (transaction) => {
      const [gigSnapshot, profileSnapshot, existingApplication] = await Promise.all([
        transaction.get(gigReference),
        transaction.get(profileReference),
        transaction.get(applicationReference),
      ]);
      if (!gigSnapshot.exists) throw new ApiAuthError("This gig could not be found.", 404);
      const gig = gigSnapshot.data() ?? {};
      if (String(gig.ownerId ?? "") === decoded.uid) throw new ApiAuthError("You cannot apply to your own gig.", 400);
      if (String(gig.status ?? "open") !== "open") throw new ApiAuthError("This gig is no longer accepting applications.", 409);
      if (!profileSnapshot.exists || profileSnapshot.data()?.studentVerified !== true) throw new ApiAuthError("Verify your school before applying for gigs.", 403);
      if (existingApplication.exists) throw new ApiAuthError("You have already applied for this gig.", 409);
      const profile = profileSnapshot.data() ?? {};
      transaction.create(applicationReference, {
        gigId: id,
        applicantId: decoded.uid,
        applicantName: String(profile.fullName ?? "CampusGig student"),
        applicantUniversity: String(profile.university ?? "Institution not added"),
        note,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(gigReference, { applicantCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    });

    const created = await applicationReference.get();
    return Response.json({ application: applicationValue(created.id, created.data() ?? {}) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
