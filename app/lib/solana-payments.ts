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

export async function getUsdcBalance(ownerAddress: string) {
  const { connection, mint } = solanaPaymentConfig();
  const owner = new PublicKey(ownerAddress);
  const tokenAddress = getAssociatedTokenAddressSync(mint, owner);
  try {
    const account = await getAccount(connection, tokenAddress, "confirmed", TOKEN_PROGRAM_ID);
    return account.amount;
  } catch {
    return 0n;
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
  const escrowOwner = new PublicKey(escrowOwnerAddress);
  const sourceAddress = getAssociatedTokenAddressSync(mint, client.publicKey);
  const escrowAddress = getAssociatedTokenAddressSync(mint, escrowOwner);
  const [mintAccount, solBalance] = await Promise.all([
    getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID),
    connection.getBalance(client.publicKey, "confirmed"),
  ]);
  if (mintAccount.decimals !== USDC_DECIMALS) {
    throw new Error(`Configured USDC mint must use ${USDC_DECIMALS} decimals.`);
  }
  if (solBalance < Math.ceil(0.003 * LAMPORTS_PER_SOL)) {
    throw new ApiAuthError(
      "Your embedded wallet needs Devnet SOL for the transaction fee and escrow token account.",
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
    feePayer: client.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      client.publicKey,
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
  transaction.sign(client);
  return {
    signedTransaction: transaction.serialize().toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    sourceAddress: sourceAddress.toBase58(),
    escrowAddress: escrowAddress.toBase58(),
    availableBaseUnits: sourceAccount.amount.toString(),
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
