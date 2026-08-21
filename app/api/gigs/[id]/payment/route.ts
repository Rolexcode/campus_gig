import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { createEmbeddedWallet, decryptEmbeddedWallet } from "@/app/lib/embedded-wallet";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { cleanConversationId, requireConversationAccess } from "@/app/lib/conversations";
import { paymentAmounts, paymentValue, usdcDisplayAmount } from "@/app/lib/payments";
import {
  broadcastFundingTransaction,
  buildSignedUsdcFundingTransaction,
  confirmFundingTransaction,
  fundingSignatureIsConfirmed,
  getUsdcBalance,
  solanaExplorerTransactionUrl,
} from "@/app/lib/solana-payments";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

function publicPaymentPayload(data: Record<string, unknown>) {
  const payment = paymentValue(data);
  return {
    payment,
    amountUsdc: usdcDisplayAmount(payment.amountBaseUnits),
    explorerUrl: payment.fundingSignature
      ? solanaExplorerTransactionUrl(payment.fundingSignature)
      : "",
  };
}

async function markFunded(
  adminDb: ReturnType<typeof getFirebaseAdminServices>["adminDb"],
  gigId: string,
  signature: string,
) {
  const paymentReference = adminDb.collection("gigPayments").doc(gigId);
  const gigReference = adminDb.collection("gigs").doc(gigId);
  await adminDb.runTransaction(async (transaction) => {
    const [paymentSnapshot, gigSnapshot] = await Promise.all([
      transaction.get(paymentReference),
      transaction.get(gigReference),
    ]);
    if (!paymentSnapshot.exists || !gigSnapshot.exists) {
      throw new ApiAuthError("The gig payment record could not be found.", 404);
    }
    const payment = paymentSnapshot.data() ?? {};
    if (String(payment.status ?? "") === "funded") return;
    if (String(payment.fundingSignature ?? "") !== signature) {
      throw new ApiAuthError("The funding transaction does not match this gig.", 409);
    }
    transaction.update(paymentReference, {
      status: "funded",
      failureReason: "",
      fundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(gigReference, {
      status: "in_progress",
      paymentStatus: "funded",
      fundingSignature: signature,
      fundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function responseForPayment(
  adminDb: ReturnType<typeof getFirebaseAdminServices>["adminDb"],
  gigId: string,
  clientId: string,
  requesterId: string,
) {
  const [paymentSnapshot, walletSnapshot] = await Promise.all([
    adminDb.collection("gigPayments").doc(gigId).get(),
    adminDb.collection("walletKeys").doc(clientId).get(),
  ]);
  if (!paymentSnapshot.exists) {
    return Response.json({ payment: null });
  }
  const payload = publicPaymentPayload(paymentSnapshot.data() ?? {});
  let clientUsdcBalance = "";
  let clientWalletAddress = "";
  if (requesterId === clientId && walletSnapshot.exists) {
    clientWalletAddress = String(walletSnapshot.data()?.publicKey ?? "");
    if (clientWalletAddress) {
      try {
        clientUsdcBalance = usdcDisplayAmount(
          (await getUsdcBalance(clientWalletAddress)).toString(),
        );
      } catch {
        clientUsdcBalance = "";
      }
    }
  }
  return Response.json({
    ...payload,
    clientWalletAddress,
    clientUsdcBalance,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    const paymentSnapshot = await adminDb.collection("gigPayments").doc(id).get();
    const paymentData = paymentSnapshot.data() ?? {};
    const signature = String(paymentData.fundingSignature ?? "");
    if (
      paymentSnapshot.exists &&
      String(paymentData.status ?? "") === "funding_pending" &&
      signature &&
      (await fundingSignatureIsConfirmed(signature))
    ) {
      await markFunded(adminDb, id, signature);
    }
    return responseForPayment(
      adminDb,
      id,
      access.conversation.ownerId,
      decoded.uid,
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

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
    if (decoded.uid !== access.conversation.ownerId) {
      throw new ApiAuthError("Only the gig client can fund this payment.", 403);
    }

    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const escrowKeyReference = adminDb.collection("paymentWalletKeys").doc(id);
    const clientKeyReference = adminDb.collection("walletKeys").doc(decoded.uid);
    const operationId = randomUUID();
    const escrowCandidate = createEmbeddedWallet();

    const reservation = await adminDb.runTransaction(async (transaction) => {
      const [gigSnapshot, conversationSnapshot, paymentSnapshot, escrowKeySnapshot, clientKeySnapshot] =
        await Promise.all([
          transaction.get(access.gigReference),
          transaction.get(access.conversationReference),
          transaction.get(paymentReference),
          transaction.get(escrowKeyReference),
          transaction.get(clientKeyReference),
        ]);
      if (!gigSnapshot.exists || !conversationSnapshot.exists) {
        throw new ApiAuthError("The gig or accepted agreement could not be found.", 404);
      }
      const gig = gigSnapshot.data() ?? {};
      const conversation = conversationSnapshot.data() ?? {};
      if (String(gig.ownerId ?? "") !== decoded.uid) {
        throw new ApiAuthError("Only the gig owner can fund this payment.", 403);
      }
      if (!String(gig.selectedApplicantId ?? "")) {
        throw new ApiAuthError("Select a student before funding the gig.", 409);
      }
      if (String(gig.settlementPreference ?? "") !== "usdc") {
        throw new ApiAuthError("This gig was not configured for USDC settlement.", 409);
      }
      const agreementVersion = Number(conversation.agreementVersion ?? 0);
      const acceptedVersion = Number(conversation.acceptedVersion ?? 0);
      if (
        conversation.agreementStatus !== "accepted" ||
        agreementVersion <= 0 ||
        acceptedVersion !== agreementVersion
      ) {
        throw new ApiAuthError("The student must accept the latest terms before funding.", 409);
      }
      const agreement = (conversation.agreement ?? {}) as Record<string, unknown>;
      if (String(agreement.currency ?? "") !== "USDC") {
        throw new ApiAuthError("The accepted agreement is not denominated in USDC.", 409);
      }
      if (!clientKeySnapshot.exists) {
        throw new ApiAuthError("Your embedded client wallet could not be found.", 409);
      }

      const existing = paymentSnapshot.data() ?? {};
      const existingStatus = String(existing.status ?? "");
      if (existingStatus === "funded") {
        return { kind: "funded" as const };
      }
      if (existingStatus === "funding_pending") {
        const signedTransaction = String(existing.signedTransaction ?? "");
        if (!signedTransaction) {
          throw new ApiAuthError("Funding is already being prepared. Wait a moment and refresh.", 409);
        }
        return {
          kind: "resume" as const,
          signedTransaction,
          blockhash: String(existing.blockhash ?? ""),
          lastValidBlockHeight: Number(existing.lastValidBlockHeight ?? 0),
          fundingSignature: String(existing.fundingSignature ?? ""),
        };
      }
      if (existingStatus && !["awaiting_funding", "failed"].includes(existingStatus)) {
        throw new ApiAuthError(`This payment cannot be funded while it is ${existingStatus}.`, 409);
      }

      const amounts = paymentAmounts(agreement.amount);
      const escrowOwnerAddress = String(
        escrowKeySnapshot.data()?.publicKey ?? escrowCandidate.publicKey,
      );
      transaction.set(
        paymentReference,
        {
          gigId: id,
          clientId: decoded.uid,
          studentId: String(gig.selectedApplicantId ?? ""),
          settlementMethod: "solana_custodial",
          currency: "USDC",
          ...amounts,
          agreementVersion,
          escrowOwnerAddress,
          escrowAddress: "",
          fundingSignature: "",
          releaseSignature: "",
          signedTransaction: "",
          blockhash: "",
          lastValidBlockHeight: 0,
          operationId,
          status: "funding_pending",
          failureReason: "",
          createdAt: existing.createdAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (!escrowKeySnapshot.exists) {
        transaction.create(escrowKeyReference, {
          gigId: id,
          ...escrowCandidate,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return {
        kind: "prepare" as const,
        operationId,
        escrowOwnerAddress,
        amountBaseUnits: amounts.amountBaseUnits,
        clientKey: clientKeySnapshot.data() ?? {},
      };
    });

    if (reservation.kind === "funded") {
      return responseForPayment(adminDb, id, decoded.uid, decoded.uid);
    }

    let signedTransaction =
      reservation.kind === "resume" ? reservation.signedTransaction : "";
    let blockhash = reservation.kind === "resume" ? reservation.blockhash : "";
    let lastValidBlockHeight =
      reservation.kind === "resume" ? reservation.lastValidBlockHeight : 0;
    let fundingSignature =
      reservation.kind === "resume" ? reservation.fundingSignature : "";

    if (reservation.kind === "prepare") {
      try {
        const client = decryptEmbeddedWallet(reservation.clientKey);
        const signed = await buildSignedUsdcFundingTransaction({
          client,
          escrowOwnerAddress: reservation.escrowOwnerAddress,
          amountBaseUnits: BigInt(reservation.amountBaseUnits),
        });
        signedTransaction = signed.signedTransaction;
        blockhash = signed.blockhash;
        lastValidBlockHeight = signed.lastValidBlockHeight;
        await adminDb.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(paymentReference);
          const data = snapshot.data() ?? {};
          if (
            data.status !== "funding_pending" ||
            data.operationId !== reservation.operationId
          ) {
            throw new ApiAuthError("The funding operation changed before signing.", 409);
          }
          transaction.update(paymentReference, {
            signedTransaction,
            blockhash,
            lastValidBlockHeight,
            sourceAddress: signed.sourceAddress,
            escrowAddress: signed.escrowAddress,
            availableBeforeFundingBaseUnits: signed.availableBaseUnits,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      } catch (error) {
        await paymentReference.set(
          {
            status: "failed",
            failureReason:
              error instanceof Error ? error.message.slice(0, 300) : "Funding preparation failed.",
            signedTransaction: FieldValue.delete(),
            blockhash: FieldValue.delete(),
            lastValidBlockHeight: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        throw error;
      }
    }

    if (fundingSignature && (await fundingSignatureIsConfirmed(fundingSignature))) {
      await markFunded(adminDb, id, fundingSignature);
      return responseForPayment(adminDb, id, decoded.uid, decoded.uid);
    }

    if (!signedTransaction || !blockhash || !lastValidBlockHeight) {
      throw new ApiAuthError("The signed funding transaction is incomplete.", 409);
    }
    fundingSignature = await broadcastFundingTransaction(signedTransaction);
    await paymentReference.set(
      {
        fundingSignature,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await confirmFundingTransaction({
      signature: fundingSignature,
      blockhash,
      lastValidBlockHeight,
    });
    await markFunded(adminDb, id, fundingSignature);
    return responseForPayment(adminDb, id, decoded.uid, decoded.uid);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
