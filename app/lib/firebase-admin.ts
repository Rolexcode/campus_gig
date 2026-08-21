import "server-only";

import { existsSync } from "node:fs";
import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function configuredCredential() {
  const inlineServiceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineServiceAccount && !inlineServiceAccount.startsWith("replace_")) {
    return cert(JSON.parse(inlineServiceAccount));
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath || credentialsPath.startsWith("replace_") || !existsSync(credentialsPath)) {
    throw new Error(
      "Firebase Admin is not configured. Set GOOGLE_APPLICATION_CREDENTIALS to the absolute path of your Firebase service-account JSON file.",
    );
  }

  return applicationDefault();
}

export function getFirebaseAdminServices() {
  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: configuredCredential(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

  return {
    adminAuth: getAuth(app),
    adminDb: getFirestore(app),
  };
}
