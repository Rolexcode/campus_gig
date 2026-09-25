import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cleanConversationId, requireConversationAccess } from "@/app/lib/conversations";
import { parseDisputeInput } from "@/app/lib/disputes";
import { decryptEmbeddedWallet } from "@/app/lib/embedded-wallet";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";
import { writeUserNotification } from "@/app/lib/user-notifications";
import {
  buildProgramDisputeTransaction,
  getProgramEscrow,
} from "@/app/lib/program-escrow";
import { reasonDigest } from "@/app/lib/program-escrow-codec";
import {
  broadcastFundingTransaction,
  confirmFundingTransaction,
} from "@/app/lib/solana-payments";

export const runtime = "nodejs";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function disputeValue(data: Record<string, unknown>) {
  return {
    gigId: String(data.gigId ?? ""),
    status: String(data.status ?? "open"),
    category: String(data.category ?? "other"),
    description: String(data.description ?? ""),
    openedBy: String(data.openedBy ?? ""),
    openedByRole: String(data.openedByRole ?? ""),
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
  };
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
    await requireConversationAccess(adminDb, id, decoded.uid);
    const snapshot = await adminDb.collection("gigDisputes").doc(id).get();
    return Response.json({
      dispute: snapshot.exists ? disputeValue(snapshot.data() ?? {}) : null,
    });
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
    const input = parseDisputeInput(await request.json().catch(() => ({})));
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    const gigReference = adminDb.collection("gigs").doc(id);
    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const disputeReference = adminDb.collection("gigDisputes").doc(id);
    const initialPaymentSnapshot = await paymentReference.get();
    if (!initialPaymentSnapshot.exists) {
      throw new ApiAuthError("The funded contract could not be found.", 404);
    }
    let disputeSignature = "";
    if (String(initialPaymentSnapshot.data()?.settlementMethod ?? "") === "solana_program") {
      let onChain = await getProgramEscrow(id);
      if (!onChain) throw new ApiAuthError("The on-chain escrow could not be found.", 409);
      if (onChain.account.status !== "disputed") {
        const walletSnapshot = await adminDb.collection("walletKeys").doc(decoded.uid).get();
        if (!walletSnapshot.exists) {
          throw new ApiAuthError("Your embedded wallet signer could not be found.", 409);
        }
        const authority = decryptEmbeddedWallet(walletSnapshot.data() ?? {}, `user:${decoded.uid}`);
        const signed = await buildProgramDisputeTransaction({
          gigId: id,
          authority,
          reasonHash: reasonDigest({ gigId: id, ...input }),
        });
        disputeSignature = await broadcastFundingTransaction(signed.signedTransaction);
        await confirmFundingTransaction({
          signature: disputeSignature,
          blockhash: signed.blockhash,
          lastValidBlockHeight: signed.lastValidBlockHeight,
        });
        onChain = await getProgramEscrow(id);
      }
      if (
        !onChain ||
        onChain.account.status !== "disputed" ||
        onChain.account.disputedBy !==
          String((await adminDb.collection("walletKeys").doc(decoded.uid).get()).data()?.publicKey ?? "")
      ) {
        throw new ApiAuthError("The on-chain dispute could not be verified.", 409);
      }
    }

    await adminDb.runTransaction(async (transaction) => {
      const [gigSnapshot, paymentSnapshot, disputeSnapshot] = await Promise.all([
        transaction.get(gigReference),
        transaction.get(paymentReference),
        transaction.get(disputeReference),
      ]);
      if (!gigSnapshot.exists || !paymentSnapshot.exists) {
        throw new ApiAuthError("The funded contract could not be found.", 404);
      }
      if (disputeSnapshot.exists) {
        throw new ApiAuthError(
          disputeSnapshot.data()?.status === "open"
            ? "A dispute is already open for this contract."
            : "This contract already has a resolved dispute record. Contact support if another issue occurs.",
          409,
        );
      }
      const gig = gigSnapshot.data() ?? {};
      const payment = paymentSnapshot.data() ?? {};
      const currentStatus = gigStatus(gig.status);
      const currentPaymentStatus = String(payment.status ?? "");
      if (!["in_progress", "submitted"].includes(currentStatus)) {
        throw new ApiAuthError(
          "Disputes can be opened only after funding and before completion.",
          409,
        );
      }
      if (!["funded", "submitted"].includes(currentPaymentStatus)) {
        throw new ApiAuthError("This payment cannot be disputed in its current state.", 409);
      }
      assertGigTransition(currentStatus, "disputed");
      const openedByRole = decoded.uid === access.conversation.ownerId ? "client" : "student";
      const otherUserId =
        openedByRole === "client"
          ? access.conversation.studentId
          : access.conversation.ownerId;
      transaction.set(disputeReference, {
        gigId: id,
        clientId: access.conversation.ownerId,
        studentId: access.conversation.studentId,
        openedBy: decoded.uid,
        openedByRole,
        ...input,
        disputeSignature,
        status: "open",
        priorGigStatus: currentStatus,
        priorPaymentStatus: currentPaymentStatus,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(gigReference, {
        status: "disputed",
        disputeStatus: "open",
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(paymentReference, {
        status: "disputed",
        priorStatus: currentPaymentStatus,
        disputeStatus: "open",
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, gigReference, {
        id: `dispute_opened_${currentStatus}`,
        type: "dispute_opened",
        actorId: decoded.uid,
        actorRole: openedByRole,
        fromStatus: currentStatus,
        toStatus: "disputed",
        metadata: { category: input.category },
      });
      writeUserNotification(transaction, adminDb, {
        userId: otherUserId,
        eventId: `dispute_opened_${id}`,
        type: "system",
        title: "Contract dispute opened",
        body: `The ${openedByRole} opened a dispute. Payment release is frozen while CampusGig reviews the contract.`,
        href: `/gigs/${id}/conversation`,
        gigId: id,
        actorId: decoded.uid,
      });
    });

    const snapshot = await disputeReference.get();
    return Response.json(
      { dispute: disputeValue(snapshot.data() ?? {}) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && !(error instanceof ApiAuthError)) {
      if (
        error.message.startsWith("Choose a valid dispute") ||
        error.message.startsWith("Describe the issue")
      ) {
        return apiErrorResponse(new ApiAuthError(error.message, 400));
      }
    }
    return apiErrorResponse(error);
  }
}
