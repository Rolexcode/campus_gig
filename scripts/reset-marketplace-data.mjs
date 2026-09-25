import nextEnv from "@next/env";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd());

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured.");

function configuredCredential() {
  const base64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64?.trim();
  if (base64 && !base64.startsWith("replace_")) {
    return cert(JSON.parse(Buffer.from(base64, "base64").toString("utf8")));
  }
  const inline = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  if (inline && !inline.startsWith("replace_")) return cert(JSON.parse(inline));
  return applicationDefault();
}

const app = getApps()[0] ?? initializeApp({ credential: configuredCredential(), projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const confirmed = process.argv.includes("--confirm-reset-all");

async function allAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function collectionCounts() {
  const collections = await db.listCollections();
  return Object.fromEntries(
    await Promise.all(collections.map(async (collection) => [
      collection.id,
      (await collection.count().get()).data().count,
    ])),
  );
}

const authUsers = await allAuthUsers();
const counts = await collectionCounts();

console.log(JSON.stringify({
  mode: confirmed ? "reset-all" : "dry-run",
  projectId,
  authenticationUsers: authUsers.length,
  rootCollectionCounts: counts,
  warning: confirmed
    ? "Deleting every Firebase Authentication user and every Firestore document."
    : "Dry run only. Re-run with --confirm-reset-all to permanently clear application data.",
}, null, 2));

if (!confirmed) process.exit(0);

for (const collection of await db.listCollections()) {
  await db.recursiveDelete(collection);
}

for (let index = 0; index < authUsers.length; index += 1000) {
  const result = await auth.deleteUsers(
    authUsers.slice(index, index + 1000).map((user) => user.uid),
  );
  if (result.failureCount > 0) {
    throw new Error(`Firebase Authentication failed to delete ${result.failureCount} user(s).`);
  }
}

const remainingAuthUsers = await allAuthUsers();
const remainingCollectionCounts = await collectionCounts();
const remainingDocuments = Object.values(remainingCollectionCounts).reduce(
  (total, count) => total + Number(count),
  0,
);

console.log(JSON.stringify({
  resetComplete: remainingAuthUsers.length === 0 && remainingDocuments === 0,
  projectId,
  remainingAuthenticationUsers: remainingAuthUsers.length,
  remainingRootCollectionCounts: remainingCollectionCounts,
}, null, 2));

if (remainingAuthUsers.length !== 0 || remainingDocuments !== 0) {
  throw new Error("Reset verification failed: Firebase still contains application records.");
}
