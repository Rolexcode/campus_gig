import nextEnv from "@next/env";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd());

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

if (!projectId)
  throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured.");
if (adminEmails.size === 0)
  throw new Error(
    "ADMIN_EMAILS is empty; refusing to reset without an admin identity to preserve.",
  );

const app =
  getApps()[0] ??
  initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const shouldDelete = process.argv.includes("--confirm-reset");

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

const authUsers = await allAuthUsers();
const adminUsers = authUsers.filter((user) =>
  adminEmails.has((user.email ?? "").toLowerCase()),
);
const marketplaceUsers = authUsers.filter(
  (user) => !adminEmails.has((user.email ?? "").toLowerCase()),
);
const collections = await db.listCollections();
const collectionCounts = Object.fromEntries(
  await Promise.all(
    collections.map(async (collection) => [
      collection.id,
      (await collection.count().get()).data().count,
    ]),
  ),
);

console.log(
  JSON.stringify(
    {
      mode: shouldDelete ? "reset" : "dry-run",
      projectId,
      authUsers: authUsers.length,
      adminUsersPreserved: adminUsers.length,
      marketplaceAuthUsersToDelete: marketplaceUsers.length,
      collectionCounts,
    },
    null,
    2,
  ),
);

if (!shouldDelete) process.exit(0);

const fullyClearedCollections = [
  "applications",
  "emailVerificationCodes",
  "gigConversations",
  "gigs",
  "schoolVerificationCodes",
  "studentVerificationRequests",
  "walletKeys",
];

for (const collectionName of fullyClearedCollections) {
  await db.recursiveDelete(db.collection(collectionName));
}

const userDocuments = await db.collection("users").get();
for (const document of userDocuments.docs) {
  const email = String(document.data().email ?? "").toLowerCase();
  if (!adminEmails.has(email)) await db.recursiveDelete(document.ref);
}

for (let index = 0; index < marketplaceUsers.length; index += 1000) {
  const batch = marketplaceUsers
    .slice(index, index + 1000)
    .map((user) => user.uid);
  if (batch.length) await auth.deleteUsers(batch);
}

const remainingUsers = await allAuthUsers();
const remainingProfiles = await db.collection("users").count().get();
console.log(
  JSON.stringify(
    {
      resetComplete: true,
      remainingAuthUsers: remainingUsers.length,
      remainingAdminUsers: remainingUsers.filter((user) =>
        adminEmails.has((user.email ?? "").toLowerCase()),
      ).length,
      remainingMarketplaceProfiles: remainingProfiles.data().count,
    },
    null,
    2,
  ),
);
