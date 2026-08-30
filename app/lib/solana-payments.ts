import "server-only";

import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { ApiAuthError } from "./server-auth";
import { USDC_DECIMALS } from "./payments";

const DEFAULT_DEVNET_RPC = "https://api.devnet.solana.com";
const DEFAULT_DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export function solanaPaymentConfig() {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || DEFAULT_DEVNET_RPC;
  const mintAddress =
    process.env.SOLANA_USDC_MINT?.trim() || DEFAULT_DEVNET_USDC_MINT;
  return {
    connection: new Connection(rpcUrl, "confirmed"),
    mint: new PublicKey(mintAddress),
    network: "devnet" as const,
  };
}

export function solanaExplorerTransactionUrl(signature: string) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

function configuredFeePayer() {
  const encoded = process.env.SOLANA_FEE_PAYER_SECRET_KEY_BASE64?.trim();
  if (!encoded) return null;
  const secret = Buffer.from(encoded, "base64");
  if (secret.length !== 64) {
    throw new Error(
      "SOLANA_FEE_PAYER_SECRET_KEY_BASE64 must decode to a 64-byte Solana keypair.",
    );
  }
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

function configuredPlatformFeeAddress() {
  const address = process.env.CAMPUSGIG_FEE_WALLET_ADDRESS?.trim();
  if (!address) {
    throw new Error(
      "USDC release is not configured. Set CAMPUSGIG_FEE_WALLET_ADDRESS.",
    );
  }
  return new PublicKey(address);
}

export function solanaFeeSponsorshipConfigured() {
  return Boolean(process.env.SOLANA_FEE_PAYER_SECRET_KEY_BASE64?.trim());
}

export async function getUsdcBalance(ownerAddress: string) {
  const { connection, mint } = solanaPaymentConfig();
  const owner = new PublicKey(ownerAddress);
  const tokenAddress = getAssociatedTokenAddressSync(mint, owner);
  try {
    const account = await getAccount(connection, tokenAddress, "confirmed", TOKEN_PROGRAM_ID);
    return account.amount;
  } catch {
    return BigInt(0);
  }
}

export async function buildSignedUsdcFundingTransaction({
  client,
  escrowOwnerAddress,
  amountBaseUnits,
}: {
  client: Keypair;
  escrowOwnerAddress: string;
  amountBaseUnits: bigint;
}) {
  const { connection, mint } = solanaPaymentConfig();
  const sponsor = configuredFeePayer();
  const feePayer = sponsor ?? client;
  const escrowOwner = new PublicKey(escrowOwnerAddress);
  const sourceAddress = getAssociatedTokenAddressSync(mint, client.publicKey);
  const escrowAddress = getAssociatedTokenAddressSync(mint, escrowOwner);
  const [mintAccount, solBalance] = await Promise.all([
    getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID),
    connection.getBalance(feePayer.publicKey, "confirmed"),
  ]);
  if (mintAccount.decimals !== USDC_DECIMALS) {
    throw new Error(`Configured USDC mint must use ${USDC_DECIMALS} decimals.`);
  }
  if (solBalance < Math.ceil(0.003 * LAMPORTS_PER_SOL)) {
    throw new ApiAuthError(
      sponsor
        ? "CampusGig's Devnet fee sponsor needs SOL before it can cover this transaction."
        : "Your embedded wallet needs Devnet SOL because fee sponsorship is not configured.",
      409,
    );
  }

  let sourceAccount;
  try {
    sourceAccount = await getAccount(
      connection,
      sourceAddress,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
  } catch {
    throw new ApiAuthError(
      "Your embedded wallet does not have a Devnet USDC token account yet.",
      409,
    );
  }
  if (!sourceAccount.owner.equals(client.publicKey) || !sourceAccount.mint.equals(mint)) {
    throw new ApiAuthError("The client USDC token account is invalid.", 409);
  }
  if (sourceAccount.amount < amountBaseUnits) {
    throw new ApiAuthError("Your embedded wallet has insufficient Devnet USDC.", 409);
  }

  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: feePayer.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      feePayer.publicKey,
      escrowAddress,
      escrowOwner,
      mint,
      TOKEN_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      sourceAddress,
      mint,
      escrowAddress,
      client.publicKey,
      amountBaseUnits,
      mintAccount.decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  if (sponsor) transaction.sign(sponsor, client);
  else transaction.sign(client);
  return {
    signedTransaction: transaction.serialize().toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    sourceAddress: sourceAddress.toBase58(),
    escrowAddress: escrowAddress.toBase58(),
    availableBaseUnits: sourceAccount.amount.toString(),
    feePayerAddress: feePayer.publicKey.toBase58(),
    feesSponsored: Boolean(sponsor),
  };
}

export async function buildSignedUsdcReleaseTransaction({
  escrowOwner,
  studentAddress,
  studentAmountBaseUnits,
  platformFeeBaseUnits,
}: {
  escrowOwner: Keypair;
  studentAddress: string;
  studentAmountBaseUnits: bigint;
  platformFeeBaseUnits: bigint;
}) {
  const { connection, mint } = solanaPaymentConfig();
  const sponsor = configuredFeePayer();
  const feePayer = sponsor ?? escrowOwner;
  const student = new PublicKey(studentAddress);
  const platform = configuredPlatformFeeAddress();
  if (student.equals(platform)) {
    throw new Error("The student and platform fee wallets must be different.");
  }
  const escrowAddress = getAssociatedTokenAddressSync(mint, escrowOwner.publicKey);
  const studentTokenAddress = getAssociatedTokenAddressSync(mint, student);
  const platformTokenAddress = getAssociatedTokenAddressSync(mint, platform);
  const [mintAccount, solBalance] = await Promise.all([
    getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID),
    connection.getBalance(feePayer.publicKey, "confirmed"),
  ]);
  if (mintAccount.decimals !== USDC_DECIMALS) {
    throw new Error(`Configured USDC mint must use ${USDC_DECIMALS} decimals.`);
  }
  if (solBalance < Math.ceil(0.004 * LAMPORTS_PER_SOL)) {
    throw new ApiAuthError(
      sponsor
        ? "CampusGig's Devnet fee sponsor needs SOL before it can release this payment."
        : "CampusGig fee sponsorship is not configured and this escrow wallet has no Devnet SOL.",
      409,
    );
  }
  let escrowAccount;
  try {
    escrowAccount = await getAccount(
      connection,
      escrowAddress,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
  } catch {
    throw new ApiAuthError("The funded escrow USDC account could not be found.", 409);
  }
  const releaseTotal = studentAmountBaseUnits + platformFeeBaseUnits;
  if (
    !escrowAccount.owner.equals(escrowOwner.publicKey) ||
    !escrowAccount.mint.equals(mint) ||
    escrowAccount.amount < releaseTotal
  ) {
    throw new ApiAuthError("The escrow USDC balance is insufficient or invalid.", 409);
  }

  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: feePayer.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      feePayer.publicKey,
      studentTokenAddress,
      student,
      mint,
      TOKEN_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      escrowAddress,
      mint,
      studentTokenAddress,
      escrowOwner.publicKey,
      studentAmountBaseUnits,
      mintAccount.decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  if (platformFeeBaseUnits > BigInt(0)) {
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        feePayer.publicKey,
        platformTokenAddress,
        platform,
        mint,
        TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(
        escrowAddress,
        mint,
        platformTokenAddress,
        escrowOwner.publicKey,
        platformFeeBaseUnits,
        mintAccount.decimals,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  if (sponsor) transaction.sign(sponsor, escrowOwner);
  else transaction.sign(escrowOwner);
  return {
    signedTransaction: transaction.serialize().toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    escrowAddress: escrowAddress.toBase58(),
    studentAddress: student.toBase58(),
    studentTokenAddress: studentTokenAddress.toBase58(),
    platformFeeAddress: platform.toBase58(),
    platformTokenAddress: platformTokenAddress.toBase58(),
    feePayerAddress: feePayer.publicKey.toBase58(),
    feesSponsored: Boolean(sponsor),
  };
}

export async function broadcastFundingTransaction(signedTransaction: string) {
  const { connection } = solanaPaymentConfig();
  return connection.sendRawTransaction(
    Buffer.from(signedTransaction, "base64"),
    {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: "confirmed",
    },
  );
}

export async function confirmFundingTransaction({
  signature,
  blockhash,
  lastValidBlockHeight,
}: {
  signature: string;
  blockhash: string;
  lastValidBlockHeight: number;
}) {
  const { connection } = solanaPaymentConfig();
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`Solana rejected the funding transaction: ${JSON.stringify(confirmation.value.err)}`);
  }
}

export async function fundingSignatureIsConfirmed(signature: string) {
  const { connection } = solanaPaymentConfig();
  const response = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const status = response.value[0];
  if (!status) return false;
  if (status.err) {
    throw new Error(`Solana rejected the funding transaction: ${JSON.stringify(status.err)}`);
  }
  return status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized";
}

export const broadcastReleaseTransaction = broadcastFundingTransaction;
export const confirmReleaseTransaction = confirmFundingTransaction;
export const releaseSignatureIsConfirmed = fundingSignatureIsConfirmed;

export async function releaseBlockhashIsValid(blockhash: string) {
  const { connection } = solanaPaymentConfig();
  return (
    await connection.isBlockhashValid(blockhash, { commitment: "confirmed" })
  ).value;
}
