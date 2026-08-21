import nextEnv from "@next/env";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd());

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!apiKey || !projectId) throw new Error("Firebase client configuration is incomplete.");

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const email = `wallet-smoke-${Date.now()}@example.com`;
let uid = "";

try {
  const signUpResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "CampusGig-Smoke-2026!", returnSecureToken: true }),
  });
  const signUp = await signUpResponse.json();
  if (!signUpResponse.ok) throw new Error(`Smoke account creation failed: ${signUp.error?.message ?? signUpResponse.status}`);
  uid = signUp.localId;

  await db.collection("users").doc(uid).set({
    uid,
    email,
    fullName: "Wallet smoke test",
    emailVerified: false,
    studentVerified: false,
    verificationStatus: "unsubmitted",
    onboardingComplete: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const provision = () => fetch("http://localhost:3000/api/wallet", {
    method: "POST",
    headers: { Authorization: `Bearer ${signUp.idToken}` },
  });
  const firstResponse = await provision();
  const first = await firstResponse.json();
  if (!firstResponse.ok) throw new Error(`Wallet provisioning failed: ${first.error ?? firstResponse.status}`);

  const secondResponse = await provision();
  const second = await secondResponse.json();
  if (!secondResponse.ok) throw new Error(`Idempotency check failed: ${second.error ?? secondResponse.status}`);
  if (first.walletAddress !== second.walletAddress) throw new Error("Repeated provisioning created different wallet addresses.");

  const [profile, encryptedKey] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("walletKeys").doc(uid).get(),
  ]);
  const keyData = encryptedKey.data() ?? {};
  if (profile.data()?.walletAddress !== first.walletAddress) throw new Error("The public wallet address was not stored on the profile.");
  if (!encryptedKey.exists || !keyData.encryptedSecretKey || !keyData.iv || !keyData.authTag) throw new Error("The encrypted wallet secret is incomplete.");
  if (keyData.secretKey || keyData.privateKey) throw new Error("A plaintext wallet secret was stored.");

  console.log(JSON.stringify({
    passed: true,
    network: first.network,
    sameAddressAfterRetry: true,
    publicAddressStored: true,
    secretEncrypted: true,
  }, null, 2));
} finally {
  if (uid) {
    await Promise.all([
      db.recursiveDelete(db.collection("users").doc(uid)),
      db.recursiveDelete(db.collection("walletKeys").doc(uid)),
      auth.deleteUser(uid).catch(() => undefined),
    ]);
  }
}
