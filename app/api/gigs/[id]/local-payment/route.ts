import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { cleanConversationId, requireConversationAccess } from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { createFlutterwaveVirtualAccount } from "@/app/lib/flutterwave";
import { gigStatus } from "@/app/lib/gig-contracts";
import { writeGigEvent } from "@/app/lib/gig-audit";
import {
  flutterwaveTransactionReference,
  localPaymentAmounts,
} from "@/app/lib/local-payments";
import { configuredPlatformFeeBps, paymentValue } from "@/app/lib/payments";
import { assertPaymentsActive } from "@/app/lib/payment-controls";
import { withApiObservability } from "@/app/lib/observability";
import { enforceServerRateLimit } from "@/app/lib/server-rate-limit";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

function responsePayment(data: Record<string, unknown>) {
  return Response.json({ payment: paymentValue(data) });
}

async function prepareLocalPayment(
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
      bucket: "prepare-flutterwave-funding",
      key: decoded.uid,
      limit: 6,
      windowMs: 15 * 60 * 1000,
    });
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    if (decoded.uid !== access.conversation.ownerId) {
      throw new ApiAuthError("Only the gig client can prepare this payment.", 403);
    }

    const paymentReference = adminDb.collection("gigPayments").doc(id);
    const userReference = adminDb.collection("users").doc(decoded.uid);
    const operationId = randomUUID();
    const reservation = await adminDb.runTransaction(async (transaction) => {
      const [gigSnapshot, conversationSnapshot, paymentSnapshot, userSnapshot] =
        await Promise.all([
          transaction.get(access.gigReference),
          transaction.get(access.conversationReference),
          transaction.get(paymentReference),
          transaction.get(userReference),
        ]);
      if (!gigSnapshot.exists || !conversationSnapshot.exists) {
        throw new ApiAuthError("The gig or accepted agreement could not be found.", 404);
      }
      const gig = gigSnapshot.data() ?? {};
      const conversation = conversationSnapshot.data() ?? {};
      if (String(gig.ownerId ?? "") !== decoded.uid) {
        throw new ApiAuthError("Only the gig owner can prepare this payment.", 403);
      }
      if (String(gig.settlementPreference ?? "") !== "local") {
        throw new ApiAuthError("This gig was not configured for local settlement.", 409);
      }
      const currentStatus = gigStatus(gig.status ?? "awaiting_funding");
      if (currentStatus !== "awaiting_funding") {
        throw new ApiAuthError(
          `Local funding cannot start while this gig is ${currentStatus}.`,
          409,
        );
      }
      const agreementVersion = Number(conversation.agreementVersion ?? 0);
      if (
        conversation.agreementStatus !== "accepted" ||
        Number(conversation.acceptedVersion ?? 0) !== agreementVersion ||
        agreementVersion <= 0
      ) {
        throw new ApiAuthError("The student must accept the latest terms before funding.", 409);
      }
      const agreement = (conversation.agreement ?? {}) as Record<string, unknown>;
      if (String(agreement.currency ?? "").toUpperCase() !== "NGN") {
        throw new ApiAuthError("Flutterwave bank transfer funding currently supports NGN gigs only.", 409);
      }
      const existing = paymentSnapshot.data() ?? {};
      const existingStatus = String(existing.status ?? "");
      if (existingStatus === "funded") return { kind: "ready" as const };
      if (existingStatus === "funding_pending") {
        if (
          existing.provider === "flutterwave" &&
          String(existing.virtualAccountNumber ?? "")
        ) {
          return { kind: "ready" as const };
        }
        throw new ApiAuthError(
          "The transfer account is still being prepared. Wait a moment and refresh. If this continues, contact support before retrying.",
          409,
        );
      }
      if (existingStatus && !["awaiting_funding", "failed"].includes(existingStatus)) {
        throw new ApiAuthError(`This payment cannot be prepared while it is ${existingStatus}.`, 409);
      }
      const feeBps = Number(configuredPlatformFeeBps());
      const amounts = localPaymentAmounts(agreement.amount, feeBps);
      const providerReference = flutterwaveTransactionReference(id, agreementVersion);
      const profile = userSnapshot.data() ?? {};
      const fullName = String(profile.fullName ?? decoded.name ?? "CampusGig Client").trim();
      const [firstName, ...lastParts] = fullName.split(/\s+/);
      const lastName = lastParts.join(" ") || "Client";
      const email = String(decoded.email ?? profile.email ?? "").trim();
      if (!email) throw new ApiAuthError("Your verified account email is required for funding.", 409);

      transaction.set(
        paymentReference,
        {
          gigId: id,
          clientId: decoded.uid,
          studentId: String(gig.selectedApplicantId ?? ""),
          settlementMethod: "local",
          currency: "NGN",
          provider: "flutterwave",
          providerReference,
          providerTransactionId: "",
          providerSessionId: "",
          ...amounts,
          platformFeeBps: feeBps,
          agreementVersion,
          operationId,
          operationStartedAtMs: Date.now(),
          virtualAccountNumber: "",
          virtualAccountBank: "",
          virtualAccountExpiresAt: "",
          providerPayableAmount: "",
          fundingSignature: "",
          releaseSignature: "",
          status: "funding_pending",
          failureReason: "",
          createdAt: existing.createdAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.update(access.gigReference, {
        paymentStatus: "funding_pending",
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeGigEvent(transaction, access.gigReference, {
        id: `funding_started_flutterwave_v${agreementVersion}`,
        type: "funding_started",
        actorId: decoded.uid,
        actorRole: "client",
        fromStatus: currentStatus,
        toStatus: currentStatus,
        metadata: { agreementVersion, provider: "flutterwave", currency: "NGN" },
      });
      return {
        kind: "prepare" as const,
        operationId,
        providerReference,
        amountNgn: Number(agreement.amount),
        email,
        firstName,
        lastName,
        title: String(gig.title ?? "CampusGig contract").slice(0, 80),
      };
    });

    if (reservation.kind === "prepare") {
      try {
        const account = await createFlutterwaveVirtualAccount({
          amountNgn: reservation.amountNgn,
          email: reservation.email,
          txRef: reservation.providerReference,
          firstName: reservation.firstName,
          lastName: reservation.lastName,
          narration: `CampusGig: ${reservation.title}`.slice(0, 100),
        });
        await adminDb.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(paymentReference);
          const payment = snapshot.data() ?? {};
          if (
            payment.status !== "funding_pending" ||
            payment.operationId !== reservation.operationId ||
            payment.providerReference !== reservation.providerReference
          ) {
            throw new ApiAuthError("The funding operation changed before the account was saved.", 409);
          }
          transaction.update(paymentReference, {
            providerOrderReference: String(account.order_ref ?? ""),
            providerSessionId: String(account.flw_ref ?? ""),
            virtualAccountNumber: String(account.account_number ?? ""),
            virtualAccountBank: String(account.bank_name ?? ""),
            virtualAccountExpiresAt: String(account.expiry_date ?? ""),
            providerPayableAmount: String(account.amount ?? reservation.amountNgn),
            providerNote: String(account.note ?? "").slice(0, 300),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      } catch (error) {
        await adminDb.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(paymentReference);
          const payment = snapshot.data() ?? {};
          if (payment.operationId !== reservation.operationId) return;
          transaction.update(paymentReference, {
            status: "failed",
            failureReason:
              error instanceof Error
                ? error.message.slice(0, 300)
                : "The transfer account could not be prepared.",
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        throw error;
      }
    }

    const snapshot = await paymentReference.get();
    return responsePayment(snapshot.data() ?? {});
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const POST = withApiObservability(
  "/api/gigs/[id]/local-payment",
  prepareLocalPayment,
);
