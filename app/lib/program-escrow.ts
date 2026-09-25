import "server-only";

import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ApiAuthError } from "./server-auth";
import { configuredFeePayer, configuredPlatformFeeAddress, solanaPaymentConfig } from "./solana-payments";
import {
  decodeEscrowAccount,
  decodeEscrowConfig,
  encodeFundEscrowInstruction,
  encodeOpenDisputeInstruction,
  encodeReleaseInstruction,
  encodeResumeDisputeInstruction,
  ESCROW_PROGRAM_ID,
  gigIdDigest,
} from "./program-escrow-codec";
import { configuredPlatformFeeBps, USDC_DECIMALS } from "./payments";

const CONFIG_SEED = Buffer.from("config");
const ESCROW_SEED = Buffer.from("escrow");
const VAULT_SEED = Buffer.from("vault");
const MIN_SPONSOR_SOL = Math.ceil(0.01 * LAMPORTS_PER_SOL);

export function programEscrowModeEnabled() {
  return process.env.SOLANA_SETTLEMENT_MODE?.trim().toLowerCase() === "program";
}

export function configuredEscrowProgramId() {
  return new PublicKey(process.env.SOLANA_ESCROW_PROGRAM_ID?.trim() || ESCROW_PROGRAM_ID);
}

export function programEscrowAddresses(gigId: string) {
  const programId = configuredEscrowProgramId();
  const gigIdHash = gigIdDigest(gigId);
  const [config] = PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
  const [escrow] = PublicKey.findProgramAddressSync([ESCROW_SEED, gigIdHash], programId);
  const [vault] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, escrow.toBuffer()],
    programId,
  );
  return { programId, gigIdHash, config, escrow, vault };
}

function signingKeypairs(...candidates: Array<Keypair | null>) {
  const unique = new Map<string, Keypair>();
  for (const candidate of candidates) {
    if (candidate) unique.set(candidate.publicKey.toBase58(), candidate);
  }
  return [...unique.values()];
}

function requiredSponsor() {
  const sponsor = configuredFeePayer();
  if (!sponsor) {
    throw new Error(
      "Program escrow requires SOLANA_FEE_PAYER_SECRET_KEY_BASE64 so users do not need SOL.",
    );
  }
  return sponsor;
}

function keypairFromBase64(name: string) {
  const encoded = process.env[name]?.trim();
  if (!encoded) throw new Error(`${name} is required for this operation.`);
  const secret = Buffer.from(encoded, "base64");
  if (secret.length !== 64) throw new Error(`${name} must decode to a 64-byte Solana keypair.`);
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function validatedConfig() {
  const { connection, mint } = solanaPaymentConfig();
  const { programId, config } = programEscrowAddresses("validation");
  const [programInfo, info] = await Promise.all([
    connection.getAccountInfo(programId, "confirmed"),
    connection.getAccountInfo(config, "confirmed"),
  ]);
  if (!programInfo?.executable) {
    throw new ApiAuthError("The configured CampusGig escrow program is not deployed.", 503);
  }
  if (!info || !info.owner.equals(programId)) {
    throw new ApiAuthError("The CampusGig program escrow has not been initialized on Devnet.", 503);
  }
  const decoded = decodeEscrowConfig(Buffer.from(info.data));
  if (decoded.allowedMintAddress !== mint.toBase58()) {
    throw new Error("The escrow program is configured for a different USDC mint.");
  }
  if (decoded.feeRecipientAddress !== configuredPlatformFeeAddress().toBase58()) {
    throw new Error("The escrow program fee recipient does not match CampusGig configuration.");
  }
  const feeBps = Number(configuredPlatformFeeBps());
  if (decoded.maxFeeBps < feeBps) {
    throw new Error("The configured platform fee exceeds the escrow program limit.");
  }
  return { config, decoded };
}

async function latestTransaction(feePayer: PublicKey) {
  const { connection } = solanaPaymentConfig();
  if ((await connection.getBalance(feePayer, "confirmed")) < MIN_SPONSOR_SOL) {
    throw new ApiAuthError("CampusGig's Devnet gas sponsor needs SOL.", 409);
  }
  const latest = await connection.getLatestBlockhash("confirmed");
  return {
    latest,
    transaction: new Transaction({
      feePayer,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    }),
  };
}

export async function getProgramEscrow(gigId: string) {
  const { connection, mint } = solanaPaymentConfig();
  const addresses = programEscrowAddresses(gigId);
  const info = await connection.getAccountInfo(addresses.escrow, "confirmed");
  if (!info) return null;
  if (!info.owner.equals(addresses.programId)) {
    throw new Error("The escrow PDA is not owned by the configured CampusGig program.");
  }
  const account = decodeEscrowAccount(Buffer.from(info.data));
  if (
    !account.gigIdHash.equals(addresses.gigIdHash) ||
    account.configAddress !== addresses.config.toBase58() ||
    account.vaultAddress !== addresses.vault.toBase58() ||
    account.mintAddress !== mint.toBase58()
  ) {
    throw new Error("The on-chain escrow account does not match its canonical PDA configuration.");
  }
  return { ...addresses, account };
}

export async function buildProgramFundingTransaction(input: {
  gigId: string;
  client: Keypair;
  workerAddress: string;
  agreementHash: Buffer;
  amountBaseUnits: bigint;
  feeBps: number;
  deadlineUnixSeconds: bigint;
}) {
  const { connection, mint } = solanaPaymentConfig();
  const sponsor = requiredSponsor();
  const worker = new PublicKey(input.workerAddress);
  const addresses = programEscrowAddresses(input.gigId);
  const { decoded: config } = await validatedConfig();
  if (config.paused) throw new ApiAuthError("New program escrows are temporarily paused.", 503);
  if (input.feeBps > config.maxFeeBps) throw new Error("The fee exceeds the on-chain limit.");
  const source = getAssociatedTokenAddressSync(mint, input.client.publicKey);
  const [mintAccount, sourceAccount] = await Promise.all([
    getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID),
    getAccount(connection, source, "confirmed", TOKEN_PROGRAM_ID).catch(() => null),
  ]);
  if (mintAccount.decimals !== USDC_DECIMALS) throw new Error("The USDC mint must use six decimals.");
  if (!sourceAccount || sourceAccount.amount < input.amountBaseUnits) {
    throw new ApiAuthError("Your embedded wallet has insufficient Devnet USDC.", 409);
  }
  const { latest, transaction } = await latestTransaction(sponsor.publicKey);
  transaction.add(
    new TransactionInstruction({
      programId: addresses.programId,
      keys: [
        { pubkey: sponsor.publicKey, isSigner: true, isWritable: true },
        { pubkey: input.client.publicKey, isSigner: true, isWritable: true },
        { pubkey: worker, isSigner: false, isWritable: false },
        { pubkey: addresses.config, isSigner: false, isWritable: false },
        { pubkey: addresses.escrow, isSigner: false, isWritable: true },
        { pubkey: addresses.vault, isSigner: false, isWritable: true },
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeFundEscrowInstruction({
        gigIdHash: addresses.gigIdHash,
        agreementHash: input.agreementHash,
        amountBaseUnits: input.amountBaseUnits,
        feeBps: input.feeBps,
        deadlineUnixSeconds: input.deadlineUnixSeconds,
      }),
    }),
  );
  transaction.sign(...signingKeypairs(sponsor, input.client));
  return {
    signedTransaction: transaction.serialize().toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    programId: addresses.programId.toBase58(),
    configAddress: addresses.config.toBase58(),
    escrowAddress: addresses.escrow.toBase58(),
    vaultAddress: addresses.vault.toBase58(),
    sourceAddress: source.toBase58(),
    availableBaseUnits: sourceAccount.amount.toString(),
    feePayerAddress: sponsor.publicKey.toBase58(),
    feesSponsored: true,
  };
}

export async function buildProgramReleaseTransaction(input: {
  gigId: string;
  client: Keypair;
}) {
  const { mint } = solanaPaymentConfig();
  const sponsor = requiredSponsor();
  const escrow = await getProgramEscrow(input.gigId);
  if (!escrow || escrow.account.status !== "funded") {
    throw new ApiAuthError("The on-chain escrow is not funded and releasable.", 409);
  }
  if (escrow.account.clientAddress !== input.client.publicKey.toBase58()) {
    throw new ApiAuthError("The client signer does not control this escrow.", 403);
  }
  const platform = configuredPlatformFeeAddress();
  const config = await validatedConfig();
  if (config.decoded.feeRecipientAddress !== platform.toBase58()) {
    throw new Error("The platform fee wallet does not match the on-chain escrow config.");
  }
  const worker = new PublicKey(escrow.account.workerAddress);
  const rentPayer = new PublicKey(escrow.account.rentPayerAddress);
  const workerToken = getAssociatedTokenAddressSync(mint, worker);
  const clientToken = getAssociatedTokenAddressSync(mint, input.client.publicKey);
  const platformToken = getAssociatedTokenAddressSync(mint, platform);
  const { latest, transaction } = await latestTransaction(sponsor.publicKey);
  for (const [address, owner] of [
    [workerToken, worker],
    [clientToken, input.client.publicKey],
    [platformToken, platform],
  ] as const) {
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        sponsor.publicKey,
        address,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  transaction.add(
    new TransactionInstruction({
      programId: escrow.programId,
      keys: [
        { pubkey: input.client.publicKey, isSigner: true, isWritable: false },
        { pubkey: rentPayer, isSigner: false, isWritable: true },
        { pubkey: escrow.config, isSigner: false, isWritable: false },
        { pubkey: escrow.escrow, isSigner: false, isWritable: true },
        { pubkey: escrow.vault, isSigner: false, isWritable: true },
        { pubkey: workerToken, isSigner: false, isWritable: true },
        { pubkey: clientToken, isSigner: false, isWritable: true },
        { pubkey: platformToken, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: encodeReleaseInstruction(),
    }),
  );
  transaction.sign(...signingKeypairs(sponsor, input.client));
  return {
    signedTransaction: transaction.serialize().toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    escrowAddress: escrow.escrow.toBase58(),
    vaultAddress: escrow.vault.toBase58(),
    studentAddress: worker.toBase58(),
    studentTokenAddress: workerToken.toBase58(),
    platformFeeAddress: platform.toBase58(),
    platformTokenAddress: platformToken.toBase58(),
    feePayerAddress: sponsor.publicKey.toBase58(),
    feesSponsored: true,
  };
}

export async function buildProgramDisputeTransaction(input: {
  gigId: string;
  authority: Keypair;
  reasonHash: Buffer;
}) {
  const sponsor = requiredSponsor();
  const escrow = await getProgramEscrow(input.gigId);
  if (!escrow || escrow.account.status !== "funded") {
    throw new ApiAuthError("The on-chain escrow is not open for a dispute.", 409);
  }
  const authority = input.authority.publicKey.toBase58();
  if (![escrow.account.clientAddress, escrow.account.workerAddress].includes(authority)) {
    throw new ApiAuthError("Only an escrow participant can open this dispute.", 403);
  }
  const { latest, transaction } = await latestTransaction(sponsor.publicKey);
  transaction.add(
    new TransactionInstruction({
      programId: escrow.programId,
      keys: [
        { pubkey: input.authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: escrow.escrow, isSigner: false, isWritable: true },
      ],
      data: encodeOpenDisputeInstruction(input.reasonHash),
    }),
  );
  transaction.sign(...signingKeypairs(sponsor, input.authority));
  return {
    signedTransaction: transaction.serialize().toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    escrowAddress: escrow.escrow.toBase58(),
  };
}

export async function buildProgramResumeTransaction(gigId: string) {
  const sponsor = requiredSponsor();
  const authority = keypairFromBase64("SOLANA_DISPUTE_AUTHORITY_SECRET_KEY_BASE64");
  const escrow = await getProgramEscrow(gigId);
  if (!escrow || escrow.account.status !== "disputed") {
    throw new ApiAuthError("The on-chain escrow is not disputed.", 409);
  }
  const config = await validatedConfig();
  if (config.decoded.disputeAuthorityAddress !== authority.publicKey.toBase58()) {
    throw new Error("The configured dispute signer does not match the on-chain authority.");
  }
  const { latest, transaction } = await latestTransaction(sponsor.publicKey);
  transaction.add(
    new TransactionInstruction({
      programId: escrow.programId,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: escrow.config, isSigner: false, isWritable: false },
        { pubkey: escrow.escrow, isSigner: false, isWritable: true },
      ],
      data: encodeResumeDisputeInstruction(),
    }),
  );
  transaction.sign(...signingKeypairs(sponsor, authority));
  return {
    signedTransaction: transaction.serialize().toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}
