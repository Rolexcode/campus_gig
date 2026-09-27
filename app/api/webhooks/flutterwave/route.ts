import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  flutterwaveTransactionMatches,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookHash,
} from "@/app/lib/flutterwave";
import { settleVerifiedFlutterwaveFunding } from "@/app/lib/local-payment-settlement";
import { withApiObservability } from "@/app/lib/observability";

export const runtime = "nodejs";

type FlutterwaveWebhook = {
  event?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    status?: string;
  };
};

async function receiveFlutterwaveWebhook(request: Request) {
  if (!verifyFlutterwaveWebhookHash(request.headers.get("verif-hash"))) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256_000) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const payload = (await request.json().catch(() => null)) as FlutterwaveWebhook | null;
  if (!payload || payload.event !== "charge.completed") {
    return Response.json({ received: true });
  }
  const transactionId = Number(payload.data?.id);
  const transactionReference = String(payload.data?.tx_ref ?? "");
  if (
    !Number.isSafeInteger(transactionId) ||
    transactionId <= 0 ||
    !transactionReference ||
    payload.data?.status !== "successful"
  ) {
    return Response.json({ received: true });
  }

  try {
    const { adminDb } = getFirebaseAdminServices();
    const matches = await adminDb
      .collection("gigPayments")
      .where("providerReference", "==", transactionReference)
      .limit(2)
      .get();
    if (matches.size !== 1) return Response.json({ received: true });
    const payment = matches.docs[0].data();
    const verified = await verifyFlutterwaveTransaction(transactionId);
    if (
      !flutterwaveTransactionMatches(verified, {
        transactionId,
        txRef: transactionReference,
        currency: String(payment.currency ?? "NGN"),
        amountMinorUnits: String(payment.amountMinorUnits ?? "0"),
      })
    ) {
      return Response.json({ received: true });
    }
    await settleVerifiedFlutterwaveFunding({
      adminDb,
      gigId: matches.docs[0].id,
      transaction: verified,
    });
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

export const POST = withApiObservability(
  "/api/webhooks/flutterwave",
  receiveFlutterwaveWebhook,
);
