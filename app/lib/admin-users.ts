import "server-only";

import type { Auth, UserRecord } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { isConfiguredAdminEmail } from "./server-auth";

export async function listMarketplaceAuthUsers(adminAuth: Auth) {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    users.push(
      ...page.users.filter((record) => !isConfiguredAdminEmail(record.email)),
    );
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

export async function loadUserProfiles(adminDb: Firestore, userIds: string[]) {
  const profiles = new Map<string, FirebaseFirestore.DocumentData>();

  for (let offset = 0; offset < userIds.length; offset += 250) {
    const references = userIds
      .slice(offset, offset + 250)
      .map((uid) => adminDb.collection("users").doc(uid));
    if (!references.length) continue;
    const snapshots = await adminDb.getAll(...references);
    for (const snapshot of snapshots) {
      if (snapshot.exists) profiles.set(snapshot.id, snapshot.data() ?? {});
    }
  }

  return profiles;
}
