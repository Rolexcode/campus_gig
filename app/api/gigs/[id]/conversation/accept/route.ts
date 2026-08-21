import { FieldValue } from "firebase-admin/firestore";
import {
  cleanConversationId,
  conversationValue,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { createEmbeddedWallet } from "@/app/lib/embedded-wallet";
import { paymentAmounts } from "@/app/lib/payments";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    if (decoded.uid !== access.conversation.studentId)
      throw new ApiAuthError(
        "Only the selected student can accept these terms.",
        403,
      );

    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const escrowKeyReference = adminDb.collection("paymentWalletKeys").doc(id);
    const escrowCandidate = createEmbeddedWallet();

    await adminDb.runTransaction(async (transaction) => {
      const [conversationSnapshot, paymentSnapshot, escrowKeySnapshot] =
        await Promise.all([
          transaction.get(access.conversationReference),
          transaction.get(paymentReference),
          transaction.get(escrowKeyReference),
        ]);
      const data = conversationSnapshot.data() ?? {};
      if (data.agreementStatus !== "proposed")
        throw new ApiAuthError(
          "Wait for the client to propose the final terms.",
          409,
        );
      const version = Number(data.agreementVersion ?? 0);
      const agreement = (data.agreement ?? {}) as Record<string, unknown>;
      const currency = String(agreement.currency ?? "");
      const settlementMethod =
        currency === "USDC" ? "solana_custodial" : "local";
      const amounts =
        currency === "USDC"
          ? paymentAmounts(agreement.amount)
          : {
              amountBaseUnits: String(agreement.amount ?? "0"),
              platformFeeBaseUnits: "0",
              studentAmountBaseUnits: String(agreement.amount ?? "0"),
            };
      const existingStatus = String(paymentSnapshot.data()?.status ?? "");
      if (
        paymentSnapshot.exists &&
        !["awaiting_funding", "failed"].includes(existingStatus)
      ) {
        throw new ApiAuthError(
          "Payment processing has already started for these terms.",
          409,
        );
      }
      transaction.update(access.conversationReference, {
        agreementStatus: "accepted",
        acceptedVersion: version,
        acceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(access.gigReference, {
        agreementStatus: "accepted",
        termsAcceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        paymentReference,
        {
          gigId: id,
          clientId: access.conversation.ownerId,
          studentId: access.conversation.studentId,
          settlementMethod,
          currency,
          ...amounts,
          agreementVersion: version,
          escrowOwnerAddress:
            currency === "USDC"
              ? String(
                  escrowKeySnapshot.data()?.publicKey ??
                    escrowCandidate.publicKey,
                )
              : "",
          escrowAddress: "",
          fundingSignature: "",
          releaseSignature: "",
          status: "awaiting_funding",
          failureReason: "",
          createdAt:
            paymentSnapshot.data()?.createdAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (currency === "USDC" && !escrowKeySnapshot.exists) {
        transaction.create(escrowKeyReference, {
          gigId: id,
          ...escrowCandidate,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    const updated = await access.conversationReference.get();
    return Response.json({
      conversation: conversationValue(updated.data() ?? {}),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
