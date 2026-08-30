export type ReleaseAllocation = {
  amountBaseUnits: bigint;
  studentAmountBaseUnits: bigint;
  platformFeeBaseUnits: bigint;
};

export function releaseAllocation(input: {
  amountBaseUnits: string;
  studentAmountBaseUnits: string;
  platformFeeBaseUnits: string;
}): ReleaseAllocation {
  const amountBaseUnits = BigInt(input.amountBaseUnits);
  const studentAmountBaseUnits = BigInt(input.studentAmountBaseUnits);
  const platformFeeBaseUnits = BigInt(input.platformFeeBaseUnits);
  if (
    amountBaseUnits <= BigInt(0) ||
    studentAmountBaseUnits <= BigInt(0) ||
    platformFeeBaseUnits < BigInt(0) ||
    studentAmountBaseUnits + platformFeeBaseUnits !== amountBaseUnits
  ) {
    throw new Error("The stored USDC release allocation is invalid.");
  }
  return { amountBaseUnits, studentAmountBaseUnits, platformFeeBaseUnits };
}
