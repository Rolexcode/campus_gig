import { createHmac, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireFirebaseUser } from "@/app/lib/server-auth";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

function codeHash(uid: string, email: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`campusgig-email-otp:${uid}:${email}:${code}`).digest("hex");
}

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (!resendApiKey || resendApiKey.startsWith("replace_")) {
      throw new Error("Resend is not configured. Add RESEND_API_KEY to .env.local.");
    }

    const decoded = await requireFirebaseUser(request);
    if (!decoded.email) return Response.json({ error: "This account has no email address." }, { status: 400 });
    if (decoded.email_verified) return Response.json({ verified: true });

    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      return Response.json({ error: "Enter the six-digit code from your email." }, { status: 400 });
    }

    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const codeReference = adminDb.collection("emailVerificationCodes").doc(decoded.uid);
    const snapshot = await codeReference.get();
    if (!snapshot.exists) {
      return Response.json({ error: "Request a new verification code." }, { status: 400 });
    }

    const data = snapshot.data()!;
    const expiresAt = data.expiresAt as Timestamp;
    const attempts = Number(data.attempts ?? 0);
    if (expiresAt.toMillis() < Date.now()) {
      await codeReference.delete();
      return Response.json({ error: "That code has expired. Request a new one." }, { status: 400 });
    }
    if (attempts >= MAX_ATTEMPTS) {
      return Response.json({ error: "Too many incorrect attempts. Request a new code." }, { status: 429 });
    }

    const expectedHash = Buffer.from(String(data.codeHash), "hex");
    const suppliedHash = Buffer.from(codeHash(decoded.uid, decoded.email.toLowerCase(), code, resendApiKey), "hex");
    const matches = expectedHash.length === suppliedHash.length && timingSafeEqual(expectedHash, suppliedHash);
    if (!matches) {
      await codeReference.update({ attempts: FieldValue.increment(1) });
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts - 1);
      return Response.json(
        { error: attemptsLeft ? `That code is incorrect. ${attemptsLeft} attempts remaining.` : "Too many incorrect attempts. Request a new code." },
        { status: 400 },
      );
    }

    await adminAuth.updateUser(decoded.uid, { emailVerified: true });
    const batch = adminDb.batch();
    batch.set(adminDb.collection("users").doc(decoded.uid), {
      emailVerified: true,
      emailVerifiedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.delete(codeReference);
    await batch.commit();

    return Response.json({ verified: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
