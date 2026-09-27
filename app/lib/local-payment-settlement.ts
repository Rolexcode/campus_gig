import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { getFirebaseAdminServices } from "./firebase-admin";
import { assertGigTransition, gigStatus } from "./gig-contracts";
import { writeGigEvent } from "./gig-audit";
import { flutterwaveTransactionMatches, type FlutterwaveVerifiedTransaction } from "./flutterwave";
import { ApiAuthError } from "./server-auth";
import { writeUserNotification } from "./user-notifications";

type AdminDb = ReturnType<typeof getFirebaseAdminServices>["adminDb"];

export async function settleVerifiedFlutterwaveFunding({
  adminDb,
  gigId,
  transaction: verifiedTransaction,
}: {
  adminDb: AdminDb;
  gigId: string;
  transaction: FlutterwaveVerifiedTransaction;
}) {
  const paymentReference = adminDb.collection("gigPayments").doc(gigId);
  const gigReference = adminDb.collection("gigs").doc(gigId);
  const transactionId = Number(verifiedTransaction.id);
  const eventReference = adminDb
    .collection("paymentProviderEvents")
    .doc(`flutterwave_charge_${transactionId}`);

  await adminDb.runTransaction(async (databaseTransaction) => {
    const [paymentSnapshot, gigSnapshot, eventSnapshot] = await Promise.all([
      databaseTransaction.get(paymentReference),
      databaseTransaction.get(gigReference),
      databaseTransaction.get(eventReference),
    ]);
    if (eventSnapshot.exists) return;
    if (!paymentSnapshot.exists || !gigSnapshot.exists) {
      throw new ApiAuthError("The matching gig payment could not be found.", 404);
    }
    const payment = paymentSnapshot.data() ?? {};
    if (
      payment.gigId !== gigId ||
      payment.provider !== "flutterwave" ||
      payment.settlementMethod !== "local" ||
      !flutterwaveTransactionMatches(verifiedTransaction, {
        transactionId,
        txRef: String(payment.providerReference ?? ""),
        currency: String(payment.currency ?? "NGN"),
        amountMinorUnits: String(payment.amountMinorUnits ?? "0"),
      })
    ) {
      throw new ApiAuthError("The verified payment does not match this contract.", 409);
    }
    const existingTransactionId = String(payment.providerTransactionId ?? "");
    if (existingTransactionId && existingTransactionId !== String(transactionId)) {
      throw new ApiAuthError("This contract is already linked to another transaction.", 409);
    }
    const paymentStatus = String(payment.status ?? "");
    if (!["funding_pending", "funded"].includes(paymentStatus)) {
      throw new ApiAuthError(`This payment cannot be confirmed while it is ${paymentStatus}.`, 409);
    }
    const gig = gigSnapshot.data() ?? {};
    if (
      String(gig.ownerId ?? "") !== String(payment.clientId ?? "") ||
      String(gig.selectedApplicantId ?? "") !== String(payment.studentId ?? "")
    ) {
      throw new ApiAuthError("The payment participants do not match this contract.", 409);
    }
    const currentStatus = gigStatus(gig.status ?? "awaiting_funding");
    const gigAlreadyStarted = currentStatus === "in_progress";
    if (!gigAlreadyStarted) assertGigTransition(currentStatus, "in_progress");

    databaseTransaction.create(eventReference, {
      provider: "flutterwave",
      eventType: "charge.completed",
      gigId,
      providerTransactionId: String(transactionId),
      providerReference: String(verifiedTransaction.tx_ref ?? ""),
      createdAt: FieldValue.serverTimestamp(),
    });
    if (paymentStatus !== "funded") {
      databaseTransaction.update(paymentReference, {
        status: "funded",
        providerTransactionId: String(transactionId),
        providerSessionId: String(verifiedTransaction.flw_ref ?? ""),
        providerPaymentType: String(verifiedTransaction.payment_type ?? ""),
        providerVerifiedAmount: Number(verifiedTransaction.amount ?? 0),
        failureReason: "",
        fundedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (!gigAlreadyStarted) {
      databaseTransaction.update(gigReference, {
        status: "in_progress",
        version: FieldValue.increment(1),
        paymentStatus: "funded",
        fundingProvider: "flutterwave",
        fundingReference: String(verifiedTransaction.tx_ref ?? ""),
        fundedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(databaseTransaction, gigReference, {
        id: `payment_secured_flutterwave_${transactionId}`,
        type: "payment_secured",
        actorId: String(payment.clientId ?? ""),
        actorRole: "client",
        fromStatus: currentStatus,
        toStatus: "in_progress",
        metadata: {
          provider: "flutterwave",
          providerTransactionId: String(transactionId),
          currency: String(payment.currency ?? "NGN"),
        },
      });
      writeUserNotification(databaseTransaction, adminDb, {
        userId: String(payment.studentId ?? ""),
        eventId: `payment_secured_${gigId}_flutterwave_${transactionId}`,
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
