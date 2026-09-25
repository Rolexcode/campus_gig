import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

export const ESCROW_PROGRAM_ID = "5xcjvcVCAbdrJtzRZv8UkeGhTPTFGAiTTeLLauKam7d8";

function digest(text: string) {
  return createHash("sha256").update(text, "utf8").digest();
}

function instructionDiscriminator(name: string) {
  return digest(`global:${name}`).subarray(0, 8);
}

function accountDiscriminator(name: string) {
  return digest(`account:${name}`).subarray(0, 8);
}

function encodeU16(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff) {
    throw new Error("The value does not fit in an unsigned 16-bit integer.");
  }
  const output = Buffer.alloc(2);
  output.writeUInt16LE(value);
  return output;
}

function encodeU64(value: bigint) {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new Error("The value does not fit in an unsigned 64-bit integer.");
  }
  const output = Buffer.alloc(8);
  output.writeBigUInt64LE(value);
  return output;
}

function encodeI64(value: bigint) {
  if (value < -0x8000_0000_0000_0000n || value > 0x7fff_ffff_ffff_ffffn) {
    throw new Error("The value does not fit in a signed 64-bit integer.");
  }
  const output = Buffer.alloc(8);
  output.writeBigInt64LE(value);
  return output;
}

export function gigIdDigest(gigId: string) {
  const normalized = String(gigId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(normalized)) {
    throw new Error("The gig ID cannot be hashed for escrow.");
  }
  return digest(`campusgig:gig:v1:${normalized}`);
}

export type EscrowAgreementDigestInput = {
  gigId: string;
  agreementVersion: number;
  clientId: string;
  workerId: string;
  scope: string;
  deliverables: string;
  deadline: string;
  amountBaseUnits: string;
  currency: string;
  revisions: number;
};

export function agreementDigest(input: EscrowAgreementDigestInput) {
  if (!Number.isSafeInteger(input.agreementVersion) || input.agreementVersion <= 0) {
    throw new Error("The agreement version cannot be hashed for escrow.");
  }
  const canonical = JSON.stringify({
    schema: "campusgig-agreement-v1",
    gigId: input.gigId,
    agreementVersion: input.agreementVersion,
    clientId: input.clientId,
    workerId: input.workerId,
    scope: input.scope,
    deliverables: input.deliverables,
    deadline: input.deadline,
    amountBaseUnits: input.amountBaseUnits,
    currency: input.currency,
    revisions: input.revisions,
  });
  return digest(canonical);
}

export function reasonDigest(input: {
  gigId: string;
  category: string;
  description: string;
}) {
  return digest(
    JSON.stringify({
      schema: "campusgig-dispute-v1",
      gigId: input.gigId,
      category: input.category,
      description: input.description,
    }),
  );
}

export function encodeFundEscrowInstruction(input: {
  gigIdHash: Buffer;
  agreementHash: Buffer;
  amountBaseUnits: bigint;
  feeBps: number;
  deadlineUnixSeconds: bigint;
}) {
  if (input.gigIdHash.length !== 32 || input.agreementHash.length !== 32) {
    throw new Error("Escrow hashes must contain exactly 32 bytes.");
  }
  return Buffer.concat([
    instructionDiscriminator("fund_escrow"),
    input.gigIdHash,
    input.agreementHash,
    encodeU64(input.amountBaseUnits),
    encodeU16(input.feeBps),
    encodeI64(input.deadlineUnixSeconds),
  ]);
}

export function encodeReleaseInstruction() {
  return instructionDiscriminator("release");
}

export function encodeOpenDisputeInstruction(hash: Buffer) {
  if (hash.length !== 32) throw new Error("The dispute reason hash must contain 32 bytes.");
  return Buffer.concat([instructionDiscriminator("open_dispute"), hash]);
}

export function encodeResumeDisputeInstruction() {
  return instructionDiscriminator("resume_dispute");
}

export const escrowStatuses = [
  "funded",
  "disputed",
  "released",
  "refunded",
  "resolved",
] as const;

export type DecodedEscrowAccount = {
  gigIdHash: Buffer;
  agreementHash: Buffer;
  configAddress: string;
  clientAddress: string;
  workerAddress: string;
  rentPayerAddress: string;
  mintAddress: string;
  vaultAddress: string;
  amountBaseUnits: bigint;
  feeBps: number;
  deadlineUnixSeconds: bigint;
  fundedAtUnixSeconds: bigint;
  settledAtUnixSeconds: bigint;
  workerAmountBaseUnits: bigint;
  clientRefundBaseUnits: bigint;
  platformFeeBaseUnits: bigint;
  disputedBy: string;
  status: (typeof escrowStatuses)[number];
  bump: number;
  vaultBump: number;
  version: number;
};

export function decodeEscrowAccount(data: Buffer): DecodedEscrowAccount {
  const expected = accountDiscriminator("Escrow");
  if (data.length < 358 || !data.subarray(0, 8).equals(expected)) {
    throw new Error("The Solana account is not a CampusGig escrow.");
  }
  let offset = 8;
  const bytes = (length: number) => {
    const value = data.subarray(offset, offset + length);
    offset += length;
    return value;
  };
  const pubkey = () => new PublicKey(bytes(32)).toBase58();
  const u64 = () => {
    const value = data.readBigUInt64LE(offset);
    offset += 8;
    return value;
  };
  const i64 = () => {
    const value = data.readBigInt64LE(offset);
    offset += 8;
    return value;
  };
  const gigIdHash = bytes(32);
  const agreementHash = bytes(32);
  const configAddress = pubkey();
  const clientAddress = pubkey();
  const workerAddress = pubkey();
  const rentPayerAddress = pubkey();
  const mintAddress = pubkey();
  const vaultAddress = pubkey();
  const amountBaseUnits = u64();
  const feeBps = data.readUInt16LE(offset);
  offset += 2;
  const deadlineUnixSeconds = i64();
  const fundedAtUnixSeconds = i64();
  const settledAtUnixSeconds = i64();
  const workerAmountBaseUnits = u64();
  const clientRefundBaseUnits = u64();
  const platformFeeBaseUnits = u64();
  const disputedBy = pubkey();
  const statusIndex = data.readUInt8(offset++);
  const status = escrowStatuses[statusIndex];
  if (!status) throw new Error("The CampusGig escrow has an unknown state.");
  return {
    gigIdHash,
    agreementHash,
    configAddress,
    clientAddress,
    workerAddress,
    rentPayerAddress,
    mintAddress,
    vaultAddress,
    amountBaseUnits,
    feeBps,
    deadlineUnixSeconds,
    fundedAtUnixSeconds,
    settledAtUnixSeconds,
    workerAmountBaseUnits,
    clientRefundBaseUnits,
    platformFeeBaseUnits,
    disputedBy,
    status,
    bump: data.readUInt8(offset++),
    vaultBump: data.readUInt8(offset++),
    version: data.readUInt8(offset),
  };
}
export type DecodedEscrowConfig = {
  adminAddress: string;
  pendingAdminAddress: string;
  pauseAuthorityAddress: string;
  disputeAuthorityAddress: string;
  feeRecipientAddress: string;
  allowedMintAddress: string;
  maxFeeBps: number;
  paused: boolean;
  bump: number;
  version: number;
};

export function decodeEscrowConfig(data: Buffer): DecodedEscrowConfig {
  const expected = accountDiscriminator("GlobalConfig");
  if (data.length < 205 || !data.subarray(0, 8).equals(expected)) {
    throw new Error("The Solana account is not the CampusGig escrow config.");
  }
  let offset = 8;
  const pubkey = () => {
    const value = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    offset += 32;
    return value;
  };
  const adminAddress = pubkey();
  const pendingAdminAddress = pubkey();
  const pauseAuthorityAddress = pubkey();
  const disputeAuthorityAddress = pubkey();
  const feeRecipientAddress = pubkey();
  const allowedMintAddress = pubkey();
  const maxFeeBps = data.readUInt16LE(offset);
  offset += 2;
  const paused = data.readUInt8(offset++) === 1;
  return {
    adminAddress,
    pendingAdminAddress,
    pauseAuthorityAddress,
    disputeAuthorityAddress,
    feeRecipientAddress,
    allowedMintAddress,
    maxFeeBps,
    paused,
    bump: data.readUInt8(offset++),
    version: data.readUInt8(offset),
  };
}
