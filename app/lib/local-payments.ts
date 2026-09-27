import { createHash } from "node:crypto";

export const NGN_MINOR_UNIT_SCALE = 100n;

export function ngnToMinorUnits(value: unknown) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    throw new Error("The accepted NGN amount must be a positive whole number.");
  }
  return BigInt(amount) * NGN_MINOR_UNIT_SCALE;
}

export function localPaymentAmounts(value: unknown, feeBps: number) {
  if (!Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > 2_500) {
    throw new Error("The platform fee must be a whole number from 0 to 2500 basis points.");
  }
  const amountMinorUnits = ngnToMinorUnits(value);
  const platformFeeMinorUnits = (amountMinorUnits * BigInt(feeBps)) / 10_000n;
  const studentAmountMinorUnits = amountMinorUnits - platformFeeMinorUnits;
  if (studentAmountMinorUnits <= 0n) {
    throw new Error("The accepted amount is too small after the platform fee.");
  }
  return {
    amountMinorUnits: amountMinorUnits.toString(),
    platformFeeMinorUnits: platformFeeMinorUnits.toString(),
    studentAmountMinorUnits: studentAmountMinorUnits.toString(),
  };
}

export function flutterwaveTransactionReference(gigId: string, agreementVersion: number) {
  if (!gigId || !Number.isSafeInteger(agreementVersion) || agreementVersion <= 0) {
    throw new Error("A valid gig and agreement version are required.");
  }
  const digest = createHash("sha256")
    .update(`${gigId}:${agreementVersion}`)
    .digest("hex")
    .slice(0, 32);
  return `CG-${digest}-V${agreementVersion}`;
}

export function providerAmountMatches(expectedMinorUnits: string, providerAmount: unknown) {
  const numeric = Number(providerAmount);
  if (!Number.isFinite(numeric) || numeric < 0) return false;
  const actualMinorUnits = BigInt(Math.round(numeric * 100));
  return actualMinorUnits >= BigInt(expectedMinorUnits);
}
