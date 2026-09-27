import "server-only";

import { timingSafeEqual } from "node:crypto";

const DEFAULT_BASE_URL = "https://api.flutterwave.com";
const REQUEST_TIMEOUT_MS = 15_000;

type FlutterwaveEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T | null;
};

export type FlutterwaveVirtualAccount = {
  response_code?: string;
  response_message?: string;
  flw_ref?: string;
  order_ref?: string;
  account_number?: string;
  bank_name?: string;
  expiry_date?: string;
  note?: string;
  amount?: string | number;
};

export type FlutterwaveVerifiedTransaction = {
  id?: number;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number;
  charged_amount?: number;
  currency?: string;
  status?: string;
  payment_type?: string;
};

function secretKey() {
  const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
  if (!key) throw new Error("Flutterwave payments are not configured.");
  return key;
}

function baseUrl() {
  const configured = process.env.FLUTTERWAVE_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(configured);
  if (url.protocol !== "https:") throw new Error("FLUTTERWAVE_BASE_URL must use HTTPS.");
  return url.origin;
}

async function flutterwaveRequest<T>(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as FlutterwaveEnvelope<T>;
    if (!response.ok || payload.status !== "success" || !payload.data) {
      throw new Error("Flutterwave could not complete the payment request.");
    }
    return payload.data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Flutterwave did not respond in time. Try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createFlutterwaveVirtualAccount(input: {
  amountNgn: number;
  email: string;
  txRef: string;
  firstName: string;
  lastName: string;
  narration: string;
}) {
  const data = await flutterwaveRequest<FlutterwaveVirtualAccount>(
    "/v3/virtual-account-numbers",
    {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountNgn,
        email: input.email,
        tx_ref: input.txRef,
        firstname: input.firstName,
        lastname: input.lastName,
        narration: input.narration,
        is_permanent: false,
      }),
    },
  );
  if (
    data.response_code !== "02" ||
    !String(data.account_number ?? "").trim() ||
    !String(data.bank_name ?? "").trim()
  ) {
    throw new Error("Flutterwave did not return a usable transfer account.");
  }
  return data;
}

export function verifyFlutterwaveWebhookHash(received: string | null) {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH?.trim();
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export function flutterwaveTransactionMatches(
  data: FlutterwaveVerifiedTransaction,
  expected: { transactionId: number; txRef: string; currency: string; amountMinorUnits: string },
) {
  const amount = Number(data.amount);
  const amountMinorUnits = Number.isFinite(amount) ? BigInt(Math.round(amount * 100)) : -1n;
  return (
    data.id === expected.transactionId &&
    data.tx_ref === expected.txRef &&
    data.status === "successful" &&
    String(data.currency ?? "").toUpperCase() === expected.currency.toUpperCase() &&
    data.payment_type === "bank_transfer" &&
    amountMinorUnits >= BigInt(expected.amountMinorUnits)
  );
}

export function verifyFlutterwaveTransaction(transactionId: number) {
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
    throw new Error("The Flutterwave transaction ID is invalid.");
  }
  return flutterwaveRequest<FlutterwaveVerifiedTransaction>(
    `/v3/transactions/${transactionId}/verify`,
  );
}
