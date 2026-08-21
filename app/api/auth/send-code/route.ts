import { createHmac, randomInt } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { apiErrorResponse, requireFirebaseUser } from "@/app/lib/server-auth";

export const runtime = "nodejs";

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function codeHash(uid: string, email: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`campusgig-email-otp:${uid}:${email}:${code}`).digest("hex");
}

function verificationEmail(code: string) {
  return `
    <div style="background:#f4f7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#10201a">
      <div style="max-width:520px;margin:auto;background:#ffffff;border:1px solid #dce5e0;border-radius:16px;padding:32px">
        <p style="margin:0;color:#07875f;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">CampusGig</p>
        <h1 style="font-size:26px;line-height:1.2;margin:18px 0 10px">Verify your email</h1>
        <p style="font-size:16px;line-height:1.6;color:#53635d">Enter this six-digit code to finish creating your CampusGig account.</p>
        <div style="margin:28px 0;padding:20px;border-radius:12px;background:#eaf7f1;text-align:center;font-size:34px;font-weight:800;letter-spacing:.25em;color:#076c4e">${code}</div>
        <p style="font-size:14px;line-height:1.6;color:#6a7772">The code expires in 10 minutes. If you did not create a CampusGig account, you can ignore this email.</p>
      </div>
    </div>
  `;
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

    const { adminDb } = getFirebaseAdminServices();
    const codeReference = adminDb.collection("emailVerificationCodes").doc(decoded.uid);
    const existing = await codeReference.get();
    const lastSentAt = existing.data()?.lastSentAt as Timestamp | undefined;
    if (lastSentAt && Date.now() - lastSentAt.toMillis() < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSentAt.toMillis())) / 1000);
      return Response.json(
        { error: `Wait ${retryAfter} seconds before requesting another code.`, retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const code = String(randomInt(100000, 1000000));
    await codeReference.set({
      uid: decoded.uid,
      email: decoded.email.toLowerCase(),
      codeHash: codeHash(decoded.uid, decoded.email.toLowerCase(), code, resendApiKey),
      attempts: 0,
      expiresAt: Timestamp.fromMillis(Date.now() + CODE_LIFETIME_MS),
      lastSentAt: FieldValue.serverTimestamp(),
    });

    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL?.trim() || "CampusGig <onboarding@resend.dev>",
      to: [decoded.email],
      subject: `${code} is your CampusGig verification code`,
      html: verificationEmail(code),
    });

    if (error) {
      await codeReference.delete();
      throw new Error(`Resend could not send the verification email: ${error.message}`);
    }

    return Response.json({ sent: true, expiresInSeconds: CODE_LIFETIME_MS / 1000 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
