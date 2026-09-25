import { FieldValue } from "firebase-admin/firestore";
import { createEmbeddedWallet } from "@/app/lib/embedded-wallet";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { ApiAuthError, apiErrorResponse, requireFirebaseUser, tokenHasAdminEmail } from "@/app/lib/server-auth";
import { getUsdcBalance } from "@/app/lib/solana-payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (tokenHasAdminEmail(decoded)) {
      throw new ApiAuthError("Administrator accounts do not use marketplace wallets.", 403);
    }

    const { adminDb } = getFirebaseAdminServices();
    const userReference = adminDb.collection("users").doc(decoded.uid);
    const keyReference = adminDb.collection("walletKeys").doc(decoded.uid);
    const candidate = createEmbeddedWallet(`user:${decoded.uid}`);

    const walletAddress = await adminDb.runTransaction(async (transaction) => {
      const [userSnapshot, keySnapshot] = await Promise.all([
        transaction.get(userReference),
        transaction.get(keyReference),
      ]);

      if (!userSnapshot.exists) {
        throw new ApiAuthError("Complete account creation before creating a wallet.", 409);
      }

      const profileAddress = String(userSnapshot.data()?.walletAddress ?? "");
      const storedAddress = String(keySnapshot.data()?.publicKey ?? "");

      if (keySnapshot.exists && storedAddress) {
        if (profileAddress !== storedAddress) {
          transaction.set(userReference, {
            walletAddress: storedAddress,
            walletNetwork: "devnet",
            walletUpdatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        return storedAddress;
      }

      if (profileAddress && !keySnapshot.exists) {
        throw new ApiAuthError("This wallet record is incomplete. Contact the administrator.", 409);
      }

      transaction.create(keyReference, {
        uid: decoded.uid,
        ...candidate,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(userReference, {
        walletAddress: candidate.publicKey,
        walletNetwork: "devnet",
        walletCreatedAt: FieldValue.serverTimestamp(),
        walletUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return candidate.publicKey;
    });

    return Response.json({ walletAddress, network: "devnet" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (tokenHasAdminEmail(decoded)) {
      throw new ApiAuthError("Administrator accounts do not use marketplace wallets.", 403);
    }

    const { adminDb } = getFirebaseAdminServices();
    const profileSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
    const walletSnapshot = await adminDb.collection("walletKeys").doc(decoded.uid).get();
    const [clientPayments, studentPayments] = await Promise.all([
      adminDb.collection("gigPayments").where("clientId", "==", decoded.uid).get(),
      adminDb.collection("gigPayments").where("studentId", "==", decoded.uid).get(),
    ]);
    const blockingStatuses = new Set([
      "funding_pending",
      "funded",
      "submitted",
      "disputed",
      "approved",
      "releasing",
      "released",
    ]);
    const hasFinancialObligation = [...clientPayments.docs, ...studentPayments.docs].some(
      (snapshot) => blockingStatuses.has(String(snapshot.data().status ?? "")),
    );
    if (hasFinancialObligation) {
      throw new ApiAuthError(
        "This account has an unsettled contract. Finish or resolve it before deleting the account.",
        409,
      );
    }
    const walletAddress = String(walletSnapshot.data()?.publicKey ?? "");
    if (walletAddress && (await getUsdcBalance(walletAddress)) > 0n) {
      throw new ApiAuthError(
        "This wallet still contains USDC. Withdraw it before deleting the account.",
        409,
      );
    }
    const username = String(profileSnapshot.data()?.usernameNormalized ?? "");
    const batch = adminDb.batch();
    batch.delete(adminDb.collection("walletKeys").doc(decoded.uid));
    batch.delete(adminDb.collection("users").doc(decoded.uid));
    if (username) batch.delete(adminDb.collection("usernames").doc(username));
    await batch.commit();
    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
