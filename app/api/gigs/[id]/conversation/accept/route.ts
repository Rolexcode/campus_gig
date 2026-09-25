import { FieldValue } from "firebase-admin/firestore";
import {
  cleanConversationId,
  conversationValue,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import { writeUserNotification } from "@/app/lib/user-notifications";
import { createEmbeddedWallet } from "@/app/lib/embedded-wallet";
import { paymentAmounts } from "@/app/lib/payments";
import {
  programEscrowAddresses,
  programEscrowModeEnabled,
} from "@/app/lib/program-escrow";
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
    const escrowCandidate = createEmbeddedWallet(`gig:${id}`);

    await adminDb.runTransaction(async (transaction) => {
      const [gigSnapshot, conversationSnapshot, paymentSnapshot, escrowKeySnapshot] =
        await Promise.all([
          transaction.get(access.gigReference),
          transaction.get(access.conversationReference),
          transaction.get(paymentReference),
          transaction.get(escrowKeyReference),
        ]);
      if (!gigSnapshot.exists)
        throw new ApiAuthError("This gig could not be found.", 404);
      const data = conversationSnapshot.data() ?? {};
      if (data.agreementStatus !== "proposed")
        throw new ApiAuthError(
          "Wait for the client to propose the final terms.",
          409,
        );
      const version = Number(data.agreementVersion ?? 0);
      const currentStatus = gigStatus(gigSnapshot.data()?.status ?? "terms_pending");
      assertGigTransition(currentStatus, "awaiting_funding");
      const agreement = (data.agreement ?? {}) as Record<string, unknown>;
      const currency = String(agreement.currency ?? "");
      const useProgramEscrow = currency === "USDC" && programEscrowModeEnabled();
      const settlementMethod =
        currency === "USDC"
          ? useProgramEscrow
            ? "solana_program"
            : "solana_custodial"
          : "local";
      const programAddresses = useProgramEscrow ? programEscrowAddresses(id) : null;
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
        status: "awaiting_funding",
        agreementStatus: "accepted",
        version: FieldValue.increment(1),
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
            useProgramEscrow
              ? programAddresses!.escrow.toBase58()
              : currency === "USDC"
              ? String(
                  escrowKeySnapshot.data()?.publicKey ??
                    escrowCandidate.publicKey,
                )
              : "",
          escrowAddress: useProgramEscrow ? programAddresses!.escrow.toBase58() : "",
          vaultAddress: useProgramEscrow ? programAddresses!.vault.toBase58() : "",
          programId: useProgramEscrow ? programAddresses!.programId.toBase58() : "",
          configAddress: useProgramEscrow ? programAddresses!.config.toBase58() : "",
          feePayerAddress: "",
          feesSponsored: false,
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
      if (currency === "USDC" && !useProgramEscrow && !escrowKeySnapshot.exists) {
        transaction.create(escrowKeyReference, {
          gigId: id,
          ...escrowCandidate,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      writeGigEvent(transaction, access.gigReference, {
        id: `terms_accepted_v${version}`,
        type: "terms_accepted",
        actorId: decoded.uid,
        actorRole: "student",
        fromStatus: currentStatus,
        toStatus: "awaiting_funding",
        metadata: { agreementVersion: version, currency },
      });
      writeUserNotification(transaction, adminDb, {
        userId: access.conversation.ownerId,
        eventId: `terms_accepted_${id}_v${version}`,
        type: "agreement",
        title: "Final terms accepted",
        body: `${access.conversation.studentName} accepted the contract terms. Funding is now the next step.`,
        href: `/gigs/${id}/conversation`,
        gigId: id,
        actorId: decoded.uid,
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
