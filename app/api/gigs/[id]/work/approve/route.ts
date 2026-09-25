import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { parseCompletionReview, nextReputation } from "@/app/lib/completion-review";
import { cleanConversationId, requireConversationAccess } from "@/app/lib/conversations";
import { decryptEmbeddedWallet } from "@/app/lib/embedded-wallet";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { writeGigEvent } from "@/app/lib/gig-audit";
import { writeUserNotification } from "@/app/lib/user-notifications";
import { assertGigTransition, gigStatus } from "@/app/lib/gig-contracts";
import { assertPaymentsActive } from "@/app/lib/payment-controls";
import { paymentValue, usdcDisplayAmount } from "@/app/lib/payments";
import { releaseAllocation } from "@/app/lib/release-allocation";
import {
  buildProgramReleaseTransaction,
  getProgramEscrow,
} from "@/app/lib/program-escrow";
import { enforceServerRateLimit } from "@/app/lib/server-rate-limit";
import {
  broadcastReleaseTransaction,
  buildSignedUsdcReleaseTransaction,
  confirmReleaseTransaction,
  releaseBlockhashIsValid,
  releaseSignatureIsConfirmed,
  solanaExplorerTransactionUrl,
} from "@/app/lib/solana-payments";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

async function completionPayload(
  adminDb: ReturnType<typeof getFirebaseAdminServices>["adminDb"],
  gigId: string,
) {
  const paymentSnapshot = await adminDb.collection("gigPayments").doc(gigId).get();
  const payment = paymentValue(paymentSnapshot.data() ?? {});
  return {
    payment,
    studentAmountUsdc: usdcDisplayAmount(payment.studentAmountBaseUnits),
    platformFeeUsdc: usdcDisplayAmount(payment.platformFeeBaseUnits),
    explorerUrl: payment.releaseSignature
      ? solanaExplorerTransactionUrl(payment.releaseSignature)
      : "",
  };
}

async function finalizeRelease({
  adminDb,
  gigId,
  signature,
}: {
  adminDb: ReturnType<typeof getFirebaseAdminServices>["adminDb"];
  gigId: string;
  signature: string;
}) {
  const gigReference = adminDb.collection("gigs").doc(gigId);
  const paymentReference = adminDb.collection("gigPayments").doc(gigId);
  const submissionReference = adminDb.collection("gigSubmissions").doc(gigId);
  const reviewReference = adminDb.collection("gigReviews").doc(gigId);
  const feeReference = adminDb.collection("platformFeeCollections").doc(gigId);

  const initialPaymentSnapshot = await paymentReference.get();
  const initialPayment = initialPaymentSnapshot.data() ?? {};
  if (String(initialPayment.settlementMethod ?? "") === "solana_program") {
    const onChain = await getProgramEscrow(gigId);
    if (
      !onChain ||
      onChain.account.status !== "released" ||
      onChain.account.amountBaseUnits.toString() !== String(initialPayment.amountBaseUnits ?? "") ||
      onChain.account.feeBps !== Number(initialPayment.platformFeeBps ?? -1) ||
      onChain.account.clientAddress !== String(initialPayment.clientWalletAddress ?? "") ||
      onChain.account.workerAddress !== String(initialPayment.studentWalletAddress ?? "") ||
      onChain.account.workerAmountBaseUnits.toString() !==
        String(initialPayment.studentAmountBaseUnits ?? "") ||
      onChain.account.platformFeeBaseUnits.toString() !==
        String(initialPayment.platformFeeBaseUnits ?? "") ||
      onChain.account.clientRefundBaseUnits !== 0n
    ) {
      throw new ApiAuthError(
        "The confirmed transaction does not match the expected on-chain release.",
        409,
      );
    }
  }

  await adminDb.runTransaction(async (transaction) => {
    const [gigSnapshot, paymentSnapshot, submissionSnapshot] = await Promise.all([
      transaction.get(gigReference),
      transaction.get(paymentReference),
      transaction.get(submissionReference),
    ]);
    if (!gigSnapshot.exists || !paymentSnapshot.exists || !submissionSnapshot.exists) {
      throw new ApiAuthError("The gig completion records could not be found.", 404);
    }
    const gig = gigSnapshot.data() ?? {};
    const payment = paymentSnapshot.data() ?? {};
    const submission = submissionSnapshot.data() ?? {};
    if (String(payment.releaseSignature ?? "") !== signature) {
      throw new ApiAuthError("The release transaction does not match this gig.", 409);
    }
    if (String(payment.status ?? "") === "completed" && gigStatus(gig.status) === "completed") {
      return;
    }
    if (String(payment.status ?? "") !== "releasing") {
      throw new ApiAuthError("This payment is not ready to finish releasing.", 409);
    }
    const currentStatus = gigStatus(gig.status);
    assertGigTransition(currentStatus, "completed");
    const studentId = String(payment.studentId ?? "");
    const studentReference = adminDb.collection("users").doc(studentId);
    const [studentSnapshot, reviewSnapshot, feeSnapshot] = await Promise.all([
      transaction.get(studentReference),
      transaction.get(reviewReference),
      transaction.get(feeReference),
    ]);
    if (!studentSnapshot.exists) {
      throw new ApiAuthError("The selected student's profile could not be found.", 404);
    }
    if (reviewSnapshot.exists || feeSnapshot.exists) {
      throw new ApiAuthError("This completion has already been recorded.", 409);
    }
    const rating = Number(payment.completionRating ?? 0);
    const review = String(payment.completionReview ?? "");
    const reputation = nextReputation(
      studentSnapshot.data() ?? {},
      rating,
      String(payment.studentAmountBaseUnits ?? "0"),
    );

    transaction.update(paymentReference, {
      status: "completed",
      releasedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      releaseFailureReason: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(submissionReference, {
      status: "approved",
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(gigReference, {
      status: "completed",
      paymentStatus: "completed",
      releaseSignature: signature,
      completedAt: FieldValue.serverTimestamp(),
      version: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(studentReference, {
      ...reputation,
      lastCompletedGigAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(reviewReference, {
      gigId,
      clientId: String(payment.clientId ?? ""),
      studentId,
      rating,
      review,
      studentName: String(gig.selectedApplicantName ?? "CampusGig student"),
      clientName: String(gig.posterName ?? "CampusGig client"),
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(feeReference, {
      gigId,
      currency: "USDC",
      amountBaseUnits: String(payment.platformFeeBaseUnits ?? "0"),
      releaseSignature: signature,
      collectedAt: FieldValue.serverTimestamp(),
    });
    writeGigEvent(transaction, gigReference, {
      id: `work_approved_${signature}`,
      type: "work_approved",
      actorId: String(payment.clientId ?? ""),
      actorRole: "client",
      fromStatus: currentStatus,
      toStatus: "completed",
      metadata: {
        signature,
        rating,
        revisionNumber: Number(submission.revisionNumber ?? 1),
        studentAmountBaseUnits: String(payment.studentAmountBaseUnits ?? "0"),
        platformFeeBaseUnits: String(payment.platformFeeBaseUnits ?? "0"),
      },
    });
    writeUserNotification(transaction, adminDb, {
      userId: studentId,
      eventId: `payment_released_${gigId}_${signature}`,
      type: "review",
      title: "Work approved and payment released",
      body: `The client approved “${String(gig.title ?? "your gig")}”, rated the work ${rating}/5, and released your USDC payment.`,
      href: `/gigs/${gigId}/conversation`,
      gigId,
      actorId: String(payment.clientId ?? ""),
    });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertPaymentsActive();
    const decoded = await requireMarketplaceUser(request);
    const completion = parseCompletionReview(await request.json().catch(() => ({})));
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    await enforceServerRateLimit({
      adminDb,
      bucket: "release-usdc",
      key: decoded.uid,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    if (decoded.uid !== access.conversation.ownerId) {
      throw new ApiAuthError("Only the gig client can approve and release payment.", 403);
    }

    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const submissionReference = adminDb.collection("gigSubmissions").doc(id);
    const escrowKeyReference = adminDb.collection("paymentWalletKeys").doc(id);
    const clientKeyReference = adminDb.collection("walletKeys").doc(decoded.uid);
    const operationId = randomUUID();
    const reservation = await adminDb.runTransaction(async (transaction) => {
      const [
        gigSnapshot,
        paymentSnapshot,
        submissionSnapshot,
        escrowKeySnapshot,
        clientKeySnapshot,
      ] =
        await Promise.all([
          transaction.get(access.gigReference),
          transaction.get(paymentReference),
          transaction.get(submissionReference),
          transaction.get(escrowKeyReference),
          transaction.get(clientKeyReference),
        ]);
      if (!gigSnapshot.exists || !paymentSnapshot.exists || !submissionSnapshot.exists) {
        throw new ApiAuthError("The submitted work or payment could not be found.", 404);
      }
      const gig = gigSnapshot.data() ?? {};
      const payment = paymentSnapshot.data() ?? {};
      const submission = submissionSnapshot.data() ?? {};
      if (String(gig.ownerId ?? "") !== decoded.uid) {
        throw new ApiAuthError("Only the gig owner can approve this work.", 403);
      }
      if (String(payment.status ?? "") === "completed") {
        return { kind: "completed" as const };
      }
      if (String(payment.status ?? "") === "releasing") {
        return {
          kind: "resume" as const,
          signedTransaction: String(payment.releaseSignedTransaction ?? ""),
          blockhash: String(payment.releaseBlockhash ?? ""),
          lastValidBlockHeight: Number(payment.releaseLastValidBlockHeight ?? 0),
          releaseSignature: String(payment.releaseSignature ?? ""),
        };
      }
      if (
        gigStatus(gig.status) !== "submitted" ||
        String(payment.status ?? "") !== "submitted" ||
        String(submission.status ?? "") !== "submitted"
      ) {
        throw new ApiAuthError("The student must submit work before payment can be released.", 409);
      }
      const useProgramEscrow = String(payment.settlementMethod ?? "") === "solana_program";
      if (!useProgramEscrow && !escrowKeySnapshot.exists) {
        throw new ApiAuthError("The gig escrow signer could not be found.", 409);
      }
      if (useProgramEscrow && !clientKeySnapshot.exists) {
        throw new ApiAuthError("The client wallet signer could not be found.", 409);
      }
      const studentId = String(payment.studentId ?? "");
      const studentKeyReference = adminDb.collection("walletKeys").doc(studentId);
      const studentKeySnapshot = await transaction.get(studentKeyReference);
      if (!studentKeySnapshot.exists || !String(studentKeySnapshot.data()?.publicKey ?? "")) {
        throw new ApiAuthError("The selected student's payout wallet could not be found.", 409);
      }
      const allocation = releaseAllocation({
        amountBaseUnits: String(payment.amountBaseUnits ?? "0"),
        studentAmountBaseUnits: String(payment.studentAmountBaseUnits ?? "0"),
        platformFeeBaseUnits: String(payment.platformFeeBaseUnits ?? "0"),
      });
      assertGigTransition(gig.status, "completed");
      transaction.update(paymentReference, {
        status: "releasing",
        releaseOperationId: operationId,
        completionRating: completion.rating,
        completionReview: completion.review,
        releaseSignature: "",
        releaseSignedTransaction: "",
        releaseBlockhash: "",
        releaseLastValidBlockHeight: 0,
        releaseFailureReason: "",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {
        kind: "prepare" as const,
        operationId,
        useProgramEscrow,
        signerKey: useProgramEscrow
          ? (clientKeySnapshot.data() ?? {})
          : (escrowKeySnapshot.data() ?? {}),
        studentAddress: String(studentKeySnapshot.data()?.publicKey ?? ""),
        studentAmountBaseUnits: allocation.studentAmountBaseUnits.toString(),
        platformFeeBaseUnits: allocation.platformFeeBaseUnits.toString(),
      };
    });

    if (reservation.kind === "completed") {
      return Response.json(await completionPayload(adminDb, id));
    }

    let signedTransaction = reservation.kind === "resume" ? reservation.signedTransaction : "";
    let blockhash = reservation.kind === "resume" ? reservation.blockhash : "";
    let lastValidBlockHeight =
      reservation.kind === "resume" ? reservation.lastValidBlockHeight : 0;
    let releaseSignature =
      reservation.kind === "resume" ? reservation.releaseSignature : "";

    if (releaseSignature && (await releaseSignatureIsConfirmed(releaseSignature))) {
      await finalizeRelease({ adminDb, gigId: id, signature: releaseSignature });
      return Response.json(await completionPayload(adminDb, id));
    }

    if (reservation.kind === "resume" && blockhash && !(await releaseBlockhashIsValid(blockhash))) {
      await paymentReference.set(
        {
          status: "submitted",
          releaseSignature: "",
          releaseSignedTransaction: "",
          releaseBlockhash: "",
          releaseLastValidBlockHeight: 0,
          releaseFailureReason: "The previous release transaction expired before confirmation.",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      throw new ApiAuthError("The previous release expired safely. Approve once more to retry.", 409);
    }

    if (reservation.kind === "prepare") {
      try {
        const signer = decryptEmbeddedWallet(
          reservation.signerKey,
          reservation.useProgramEscrow ? `user:${decoded.uid}` : `gig:${id}`,
        );
        const signed = reservation.useProgramEscrow
          ? await buildProgramReleaseTransaction({ gigId: id, client: signer })
          : await buildSignedUsdcReleaseTransaction({
              escrowOwner: signer,
              studentAddress: reservation.studentAddress,
              studentAmountBaseUnits: BigInt(reservation.studentAmountBaseUnits),
              platformFeeBaseUnits: BigInt(reservation.platformFeeBaseUnits),
            });
        signedTransaction = signed.signedTransaction;
        blockhash = signed.blockhash;
        lastValidBlockHeight = signed.lastValidBlockHeight;
        await adminDb.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(paymentReference);
          const data = snapshot.data() ?? {};
          if (
            data.status !== "releasing" ||
            data.releaseOperationId !== reservation.operationId
          ) {
            throw new ApiAuthError("The release operation changed before signing.", 409);
          }
          transaction.update(paymentReference, {
            releaseSignedTransaction: signedTransaction,
            releaseBlockhash: blockhash,
            releaseLastValidBlockHeight: lastValidBlockHeight,
            escrowAddress: signed.escrowAddress,
            studentWalletAddress: signed.studentAddress,
            studentTokenAddress: signed.studentTokenAddress,
            platformFeeAddress: signed.platformFeeAddress,
            platformTokenAddress: signed.platformTokenAddress,
            releaseFeePayerAddress: signed.feePayerAddress,
            releaseFeesSponsored: signed.feesSponsored,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      } catch (error) {
        await paymentReference.set(
          {
            status: "submitted",
            releaseFailureReason:
              error instanceof Error ? error.message.slice(0, 300) : "Release preparation failed.",
            releaseSignedTransaction: "",
            releaseBlockhash: "",
            releaseLastValidBlockHeight: 0,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        throw error;
      }
    }

    if (!signedTransaction || !blockhash || !lastValidBlockHeight) {
      throw new ApiAuthError("The signed release transaction is incomplete.", 409);
    }
    if (!releaseSignature) {
      releaseSignature = await broadcastReleaseTransaction(signedTransaction);
      await paymentReference.set(
        { releaseSignature, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    await confirmReleaseTransaction({
      signature: releaseSignature,
      blockhash,
      lastValidBlockHeight,
    });
    await finalizeRelease({ adminDb, gigId: id, signature: releaseSignature });
    return Response.json(await completionPayload(adminDb, id));
  } catch (error) {
    if (error instanceof Error && !(error instanceof ApiAuthError)) {
      const validationError =
        error.message.startsWith("Choose a rating") ||
        error.message.startsWith("The review");
      if (validationError) return apiErrorResponse(new ApiAuthError(error.message, 400));
    }
    return apiErrorResponse(error);
  }
}
