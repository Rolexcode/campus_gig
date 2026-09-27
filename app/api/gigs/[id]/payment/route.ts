import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { createEmbeddedWallet, decryptEmbeddedWallet } from "@/app/lib/embedded-wallet";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import { writeUserNotification } from "@/app/lib/user-notifications";
import { cleanConversationId, requireConversationAccess } from "@/app/lib/conversations";
import {
  configuredPlatformFeeBps,
  paymentAmounts,
  paymentValue,
  usdcDisplayAmount,
} from "@/app/lib/payments";
import { agreementDigest } from "@/app/lib/program-escrow-codec";
import {
  buildProgramFundingTransaction,
  getProgramEscrow,
  programEscrowAddresses,
  programEscrowModeEnabled,
} from "@/app/lib/program-escrow";
import { assertPaymentsActive } from "@/app/lib/payment-controls";
import { withApiObservability } from "@/app/lib/observability";
import { enforceServerRateLimit } from "@/app/lib/server-rate-limit";
import {
  broadcastFundingTransaction,
  buildSignedUsdcFundingTransaction,
  confirmFundingTransaction,
  fundingSignatureIsConfirmed,
  getUsdcBalance,
  solanaFeeSponsorshipConfigured,
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
  const initialPaymentSnapshot = await paymentReference.get();
  const initialPayment = initialPaymentSnapshot.data() ?? {};
  if (String(initialPayment.settlementMethod ?? "") === "solana_program") {
    const onChain = await getProgramEscrow(gigId);
    const expectedAgreementHash = String(initialPayment.agreementHash ?? "");
    if (
      !onChain ||
      onChain.account.status !== "funded" ||
      onChain.account.amountBaseUnits.toString() !== String(initialPayment.amountBaseUnits ?? "") ||
      onChain.account.feeBps !== Number(initialPayment.platformFeeBps ?? -1) ||
      onChain.account.clientAddress !== String(initialPayment.clientWalletAddress ?? "") ||
      onChain.account.workerAddress !== String(initialPayment.studentWalletAddress ?? "") ||
      (expectedAgreementHash && onChain.account.agreementHash.toString("hex") !== expectedAgreementHash)
    ) {
      throw new ApiAuthError(
        "The confirmed transaction does not match the expected on-chain escrow state.",
        409,
      );
    }
  }
  await adminDb.runTransaction(async (transaction) => {
    const [paymentSnapshot, gigSnapshot] = await Promise.all([
      transaction.get(paymentReference),
      transaction.get(gigReference),
    ]);
    if (!paymentSnapshot.exists || !gigSnapshot.exists) {
      throw new ApiAuthError("The gig payment record could not be found.", 404);
    }
    const payment = paymentSnapshot.data() ?? {};
    if (String(payment.fundingSignature ?? "") !== signature) {
      throw new ApiAuthError("The funding transaction does not match this gig.", 409);
    }
    const gig = gigSnapshot.data() ?? {};
    const currentStatus = gigStatus(gig.status ?? "awaiting_funding");
    const paymentAlreadyFunded = String(payment.status ?? "") === "funded";
    const gigAlreadyStarted = currentStatus === "in_progress";
    if (paymentAlreadyFunded && gigAlreadyStarted) return;
    if (!gigAlreadyStarted) {
      assertGigTransition(currentStatus, "in_progress");
    }
    if (!paymentAlreadyFunded) {
      transaction.update(paymentReference, {
        status: "funded",
        failureReason: "",
        fundedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (!gigAlreadyStarted) {
      transaction.update(gigReference, {
        status: "in_progress",
        version: FieldValue.increment(1),
        paymentStatus: "funded",
        fundingSignature: signature,
        fundedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, gigReference, {
        id: `payment_secured_${signature}`,
        type: "payment_secured",
        actorId: String(payment.clientId ?? ""),
        actorRole: "client",
        fromStatus: currentStatus,
        toStatus: "in_progress",
        metadata: { signature, currency: "USDC" },
      });
      writeUserNotification(transaction, adminDb, {
        userId: String(payment.studentId ?? ""),
        eventId: `payment_secured_${gigId}_${signature}`,
        type: "payment",
        title: "Payment secured",
        body: `The client funded “${String(gig.title ?? "your gig")}”. You can begin work now.`,
        href: `/gigs/${gigId}/conversation`,
        gigId,
        actorId: String(payment.clientId ?? ""),
      });
    }
  });
}

async function responseForPayment(
  adminDb: ReturnType<typeof getFirebaseAdminServices>["adminDb"],
  gigId: string,
  clientId: string,
  requesterId: string,
) {
  const paymentSnapshot = await adminDb.collection("gigPayments").doc(gigId).get();
  if (!paymentSnapshot.exists) {
    return Response.json({
      payment: null,
      feeSponsorshipAvailable: solanaFeeSponsorshipConfigured(),
    });
  }
  const payload = publicPaymentPayload(paymentSnapshot.data() ?? {});
  if (payload.payment.settlementMethod === "local") {
    return Response.json({
      ...payload,
      clientWalletAddress: "",
      clientUsdcBalance: "",
      feeSponsorshipAvailable: false,
    });
  }
  const walletSnapshot = await adminDb.collection("walletKeys").doc(clientId).get();
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
    feeSponsorshipAvailable: solanaFeeSponsorshipConfigured(),
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
      String(paymentData.settlementMethod ?? "") !== "local" &&
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

async function fundPayment(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertPaymentsActive();
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    await enforceServerRateLimit({
      adminDb,
      bucket: "fund-usdc",
      key: decoded.uid,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    if (decoded.uid !== access.conversation.ownerId) {
      throw new ApiAuthError("Only the gig client can fund this payment.", 403);
    }

    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const escrowKeyReference = adminDb.collection("paymentWalletKeys").doc(id);
    const clientKeyReference = adminDb.collection("walletKeys").doc(decoded.uid);
    const operationId = randomUUID();
    const useProgramEscrow = programEscrowModeEnabled();
    const escrowCandidate = createEmbeddedWallet(`gig:${id}`);

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
        const expectedMethod = useProgramEscrow ? "solana_program" : "solana_custodial";
        if (String(existing.settlementMethod ?? "") !== expectedMethod) {
          throw new ApiAuthError(
            "The settlement mode changed during funding. Reset this payment before retrying.",
            409,
          );
        }
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
      const currentStatus = gigStatus(gig.status ?? "awaiting_funding");
      assertGigTransition(currentStatus, "in_progress");

      const amounts = paymentAmounts(agreement.amount);
      const platformFeeBps = Number(configuredPlatformFeeBps());
      const studentId = String(gig.selectedApplicantId ?? "");
      const studentKeySnapshot = useProgramEscrow
        ? await transaction.get(adminDb.collection("walletKeys").doc(studentId))
        : null;
      if (
        useProgramEscrow &&
        (!studentKeySnapshot?.exists || !String(studentKeySnapshot.data()?.publicKey ?? ""))
      ) {
        throw new ApiAuthError("The selected student's payout wallet could not be found.", 409);
      }
      const programAddresses = useProgramEscrow ? programEscrowAddresses(id) : null;
      const escrowOwnerAddress = useProgramEscrow
        ? programAddresses!.escrow.toBase58()
        : String(escrowKeySnapshot.data()?.publicKey ?? escrowCandidate.publicKey);
      transaction.set(
        paymentReference,
        {
          gigId: id,
          clientId: decoded.uid,
          studentId,
          settlementMethod: useProgramEscrow ? "solana_program" : "solana_custodial",
          currency: "USDC",
          ...amounts,
          platformFeeBps,
          agreementVersion,
          escrowOwnerAddress,
          escrowAddress: useProgramEscrow ? programAddresses!.escrow.toBase58() : "",
          vaultAddress: useProgramEscrow ? programAddresses!.vault.toBase58() : "",
          programId: useProgramEscrow ? programAddresses!.programId.toBase58() : "",
          configAddress: useProgramEscrow ? programAddresses!.config.toBase58() : "",
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
      if (!useProgramEscrow && !escrowKeySnapshot.exists) {
        transaction.create(escrowKeyReference, {
          gigId: id,
          ...escrowCandidate,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(access.gigReference, {
        paymentStatus: "funding_pending",
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, access.gigReference, {
        id: `funding_started_v${agreementVersion}`,
        type: "funding_started",
        actorId: decoded.uid,
        actorRole: "client",
        fromStatus: currentStatus,
        toStatus: currentStatus,
        metadata: { agreementVersion, operationId, currency: "USDC" },
      });
      return {
        kind: "prepare" as const,
        operationId,
        useProgramEscrow,
        escrowOwnerAddress,
        amountBaseUnits: amounts.amountBaseUnits,
        clientKey: clientKeySnapshot.data() ?? {},
        workerAddress: String(studentKeySnapshot?.data()?.publicKey ?? ""),
        studentId,
        agreementVersion,
        agreement: {
          scope: String(agreement.scope ?? ""),
          deliverables: String(agreement.deliverables ?? ""),
          deadline: String(agreement.deadline ?? ""),
          currency: String(agreement.currency ?? ""),
          revisions: Number(agreement.revisions ?? 0),
        },
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
        const client = decryptEmbeddedWallet(reservation.clientKey, `user:${decoded.uid}`);
        const agreementHash = agreementDigest({
          gigId: id,
          agreementVersion: reservation.agreementVersion,
          clientId: decoded.uid,
          workerId: reservation.studentId,
          scope: reservation.agreement.scope,
          deliverables: reservation.agreement.deliverables,
          deadline: reservation.agreement.deadline,
          amountBaseUnits: reservation.amountBaseUnits,
          currency: reservation.agreement.currency,
          revisions: reservation.agreement.revisions,
        });
        const deadlineUnixSeconds = BigInt(
          Math.floor(
            new Date(`${reservation.agreement.deadline}T23:59:59.999Z`).getTime() / 1000,
          ),
        );
        const signed = reservation.useProgramEscrow
          ? await buildProgramFundingTransaction({
              gigId: id,
              client,
              workerAddress: reservation.workerAddress,
              agreementHash,
              amountBaseUnits: BigInt(reservation.amountBaseUnits),
              feeBps: Number(configuredPlatformFeeBps()),
              deadlineUnixSeconds,
            })
          : await buildSignedUsdcFundingTransaction({
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
            feePayerAddress: signed.feePayerAddress,
            feesSponsored: signed.feesSponsored,
            vaultAddress: "vaultAddress" in signed ? signed.vaultAddress : "",
            programId: "programId" in signed ? signed.programId : "",
            configAddress: "configAddress" in signed ? signed.configAddress : "",
            agreementHash: reservation.useProgramEscrow ? agreementHash.toString("hex") : "",
            clientWalletAddress: reservation.useProgramEscrow
              ? client.publicKey.toBase58()
              : "",
            studentWalletAddress: reservation.useProgramEscrow
              ? reservation.workerAddress
              : "",
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

export const POST = withApiObservability(
  "/api/gigs/[id]/payment",
  fundPayment,
);
