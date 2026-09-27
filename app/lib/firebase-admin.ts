import "server-only";

import { existsSync } from "node:fs";
import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function configuredCredential() {
  const base64ServiceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64?.trim();
  if (base64ServiceAccount && !base64ServiceAccount.startsWith("replace_")) {
    try {
      const decoded = Buffer.from(base64ServiceAccount, "base64").toString("utf8");
      return cert(JSON.parse(decoded));
    } catch {
      throw new Error(
        "Firebase Admin is not configured. FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 is invalid.",
      );
    }
  }

  const inlineServiceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineServiceAccount && !inlineServiceAccount.startsWith("replace_")) {
    try {
      return cert(JSON.parse(inlineServiceAccount));
    } catch {
      throw new Error(
        "Firebase Admin is not configured. FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is invalid.",
      );
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath || credentialsPath.startsWith("replace_") || !existsSync(credentialsPath)) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 on Vercel or GOOGLE_APPLICATION_CREDENTIALS locally.",
    );
  }

  return applicationDefault();
}

function usingFirebaseEmulators() {
  return Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.FIRESTORE_EMULATOR_HOST,
  );
}

export function getFirebaseAdminServices() {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    "campusgig-e2e";
  const app = getApps().length
    ? getApp()
    : initializeApp(
        usingFirebaseEmulators()
          ? {
              projectId,
              storageBucket:
                process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
                `${projectId}.appspot.com`,
            }
          : {
              credential: configuredCredential(),
              projectId,
              storageBucket:
                process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
                `${projectId}.appspot.com`,
            },
      );

  return {
    adminAuth: getAuth(app),
    adminDb: getFirestore(app),
    adminStorage: getStorage(app),
  };
}
