import { FieldValue } from "firebase-admin/firestore";
import {
  cleanConversationId,
  conversationValue,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

function cleanText(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
) {
  const text = String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n");
  if (text.length < minimum || text.length > maximum)
    throw new ApiAuthError(
      `${label} must be between ${minimum} and ${maximum} characters.`,
      400,
    );
  return text;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const body = await request.json().catch(() => ({}));
    const scope = cleanText(body.scope, 20, 1_500, "Scope");
    const deliverables = cleanText(
      body.deliverables,
      10,
      1_000,
      "Deliverables",
    );
    const deadline = String(body.deadline ?? "").trim();
    const amount = Number(body.amount);
    const revisions = Number(body.revisions);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(new Date(`${deadline}T23:59:59.999Z`).getTime())
    )
      throw new ApiAuthError("Choose a valid deadline.", 400);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000)
      throw new ApiAuthError("Enter a valid agreement amount.", 400);
    if (!Number.isSafeInteger(revisions) || revisions < 0 || revisions > 10)
      throw new ApiAuthError(
        "Revisions must be a whole number from 0 to 10.",
        400,
      );

    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    if (decoded.uid !== access.conversation.ownerId)
      throw new ApiAuthError(
        "Only the client can propose the final terms.",
        403,
      );
    const currency = String(access.gig.currency ?? "");
    if (currency !== "USDC" && !Number.isSafeInteger(amount))
      throw new ApiAuthError(
        "Use a whole-number amount for local currency.",
        400,
      );
    if (currency === "USDC" && Math.round(amount * 100) !== amount * 100)
      throw new ApiAuthError(
        "Use no more than two decimal places for USDC.",
        400,
      );

    await adminDb.runTransaction(async (transaction) => {
      const paymentReference = adminDb.collection("gigPayments").doc(id);
      const [gigSnapshot, conversationSnapshot, paymentSnapshot] = await Promise.all([
        transaction.get(access.gigReference),
        transaction.get(access.conversationReference),
        transaction.get(paymentReference),
      ]);
      if (!gigSnapshot.exists)
        throw new ApiAuthError("This gig could not be found.", 404);
      const currentStatus = gigStatus(gigSnapshot.data()?.status ?? "hired");
      assertGigTransition(currentStatus, "terms_pending");
      const paymentStatus = String(paymentSnapshot.data()?.status ?? "");
      if (
        paymentSnapshot.exists &&
        !["awaiting_funding", "failed"].includes(paymentStatus)
      ) {
        throw new ApiAuthError(
          "The accepted terms cannot change after payment processing starts.",
          409,
        );
      }
      const currentVersion = Number(
        conversationSnapshot.data()?.agreementVersion ?? 0,
      );
      transaction.update(access.conversationReference, {
        agreement: {
          scope,
          deliverables,
          deadline,
          amount,
          currency,
          revisions,
        },
        agreementStatus: "proposed",
        agreementVersion: currentVersion + 1,
        acceptedVersion: 0,
        proposedAt: FieldValue.serverTimestamp(),
        acceptedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(access.gigReference, {
        status: "terms_pending",
        agreementStatus: "proposed",
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, access.gigReference, {
        id: `terms_proposed_v${currentVersion + 1}`,
        type: "terms_proposed",
        actorId: decoded.uid,
        actorRole: "client",
        fromStatus: currentStatus,
        toStatus: "terms_pending",
        metadata: {
          agreementVersion: currentVersion + 1,
          currency,
          amount,
        },
      });
    });

    const updated = await access.conversationReference.get();
    return Response.json({
      conversation: conversationValue(updated.data() ?? {}),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
