import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import type { MarketplacePayment, MarketplacePaymentStatus } from "./gigs";
import { ApiAuthError } from "./server-auth";

export const USDC_DECIMALS = 6;
export const USDC_SCALE = BigInt(1_000_000);

function decimalText(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return value.toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: USDC_DECIMALS,
    });
  }
  return String(value ?? "").trim();
}

export function usdcToBaseUnits(value: unknown) {
  const text = decimalText(value);
  const match = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(text);
  if (!match) {
    throw new ApiAuthError(
      "The accepted USDC amount is invalid. Agree a value with no more than six decimal places.",
      409,
    );
  }
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(USDC_DECIMALS, "0"));
  const amount = whole * USDC_SCALE + fraction;
  if (amount <= BigInt(0)) throw new ApiAuthError("The accepted amount must be greater than zero.", 409);
  return amount;
}

export function configuredPlatformFeeBps() {
  const configured = Number(process.env.CAMPUSGIG_PLATFORM_FEE_BPS ?? "500");
  if (!Number.isSafeInteger(configured) || configured < 0 || configured > 10_000) {
    throw new Error("CAMPUSGIG_PLATFORM_FEE_BPS must be a whole number from 0 to 10000.");
  }
  return BigInt(configured);
}

export function paymentAmounts(amount: unknown) {
  const amountBaseUnits = usdcToBaseUnits(amount);
  const feeBps = configuredPlatformFeeBps();
  const platformFeeBaseUnits =
    (amountBaseUnits * feeBps + BigInt(9_999)) / BigInt(10_000);
  const studentAmountBaseUnits = amountBaseUnits - platformFeeBaseUnits;
  if (studentAmountBaseUnits <= BigInt(0)) {
    throw new ApiAuthError("The agreed amount is too small after the platform fee.", 409);
  }
  return {
    amountBaseUnits: amountBaseUnits.toString(),
    platformFeeBaseUnits: platformFeeBaseUnits.toString(),
    studentAmountBaseUnits: studentAmountBaseUnits.toString(),
  };
}

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

const paymentStatuses = new Set<MarketplacePaymentStatus>([
  "awaiting_funding",
  "funding_pending",
  "funded",
  "submitted",
  "disputed",
  "approved",
  "releasing",
  "released",
  "completed",
  "failed",
  "refunded",
]);

export function paymentValue(data: Record<string, unknown>): MarketplacePayment {
  const rawStatus = String(data.status ?? "awaiting_funding") as MarketplacePaymentStatus;
  const status = paymentStatuses.has(rawStatus) ? rawStatus : "awaiting_funding";
  return {
    gigId: String(data.gigId ?? ""),
    clientId: String(data.clientId ?? ""),
    studentId: String(data.studentId ?? ""),
    settlementMethod:
      data.settlementMethod === "solana_custodial" ? "solana_custodial" : "local",
    currency: String(data.currency ?? ""),
    amountBaseUnits: String(data.amountBaseUnits ?? "0"),
    platformFeeBaseUnits: String(data.platformFeeBaseUnits ?? "0"),
    studentAmountBaseUnits: String(data.studentAmountBaseUnits ?? "0"),
    escrowOwnerAddress: String(data.escrowOwnerAddress ?? ""),
    escrowAddress: String(data.escrowAddress ?? ""),
    feePayerAddress: String(data.feePayerAddress ?? ""),
    feesSponsored: data.feesSponsored === true,
    fundingSignature: String(data.fundingSignature ?? ""),
    releaseSignature: String(data.releaseSignature ?? ""),
    status,
    failureReason: String(data.failureReason ?? ""),
    createdAt: dateValue(data.createdAt),
    fundedAt: dateValue(data.fundedAt),
    releasedAt: dateValue(data.releasedAt),
    completedAt: dateValue(data.completedAt),
    updatedAt: dateValue(data.updatedAt),
  };
}

export function usdcDisplayAmount(baseUnits: string) {
  const amount = BigInt(baseUnits || "0");
  const whole = amount / USDC_SCALE;
  const fraction = (amount % USDC_SCALE).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
