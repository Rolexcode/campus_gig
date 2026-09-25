import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const DEVNET_GENESIS_HASH = "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC";
const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const CONFIG_SEED = Buffer.from("config");

function requiredAddress(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return new PublicKey(value);
}

function requiredKeypair(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for initialization.`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 64) throw new Error(`${name} must decode to a 64-byte keypair.`);
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

function instructionDiscriminator(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function encodeU16(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_500) {
    throw new Error("CAMPUSGIG_PLATFORM_FEE_BPS must be an integer from 0 to 2500.");
  }
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
const connection = new Connection(rpcUrl, "confirmed");
const programId = requiredAddress("SOLANA_ESCROW_PROGRAM_ID");
const [config] = PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
const [programData] = PublicKey.findProgramAddressSync([programId.toBuffer()], UPGRADEABLE_LOADER);
const existing = await connection.getAccountInfo(config, "confirmed");
const genesisHash = await connection.getGenesisHash();

if (genesisHash !== DEVNET_GENESIS_HASH) {
  throw new Error("Refusing to initialize escrow outside Solana Devnet.");
}

console.log(`Program: ${programId.toBase58()}`);
console.log(`Config PDA: ${config.toBase58()}`);
console.log(`ProgramData: ${programData.toBase58()}`);

if (existing) {
  if (!existing.owner.equals(programId)) {
    throw new Error("The config PDA exists but is not owned by the escrow program.");
  }
  console.log("Escrow config already exists; no transaction was sent.");
  process.exit(0);
}

if (!process.argv.includes("--confirm-initialize")) {
  console.log("Dry run only. Add --confirm-initialize after checking every public address above.");
  process.exit(0);
}

const admin = requiredKeypair("SOLANA_PROGRAM_UPGRADE_AUTHORITY_SECRET_KEY_BASE64");
const pauseAuthority = requiredAddress("SOLANA_PAUSE_AUTHORITY_ADDRESS");
const disputeAuthority = requiredAddress("SOLANA_DISPUTE_AUTHORITY_ADDRESS");
const feeRecipient = requiredAddress("CAMPUSGIG_FEE_WALLET_ADDRESS");
const mint = requiredAddress("SOLANA_USDC_MINT");
const maxFeeBps = Number(process.env.CAMPUSGIG_PLATFORM_FEE_BPS ?? "500");
const programInfo = await connection.getAccountInfo(programId, "confirmed");
const programDataInfo = await connection.getAccountInfo(programData, "confirmed");

if (!programInfo?.executable || !programDataInfo) {
  throw new Error("Deploy the verified SBF program before initializing its config.");
}

const data = Buffer.concat([
  instructionDiscriminator("initialize_config"),
  pauseAuthority.toBuffer(),
  disputeAuthority.toBuffer(),
  feeRecipient.toBuffer(),
  mint.toBuffer(),
  encodeU16(maxFeeBps),
]);
const instruction = new TransactionInstruction({
  programId,
  keys: [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: programData, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data,
});
const signature = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(instruction),
  [admin],
  { commitment: "confirmed", preflightCommitment: "confirmed", maxRetries: 3 },
);

console.log(`Initialized: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
