import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { adminDb } = getFirebaseAdminServices();
    const snapshot = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    const notifications = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        type: String(data.type ?? "system"),
        title: String(data.title ?? "CampusGig update"),
        body: String(data.body ?? ""),
        href: String(data.href ?? "/gigs"),
        gigId: String(data.gigId ?? ""),
        read: Boolean(data.readAt),
        createdAt: dateValue(data.createdAt),
        readAt: dateValue(data.readAt),
      };
    });
    return Response.json({
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const body = await request.json().catch(() => ({}));
    const notificationId = String(body.notificationId ?? "").trim();
    const markAll = body.all === true;
    if (!markAll && !/^[A-Za-z0-9_-]{1,220}$/.test(notificationId)) {
      throw new ApiAuthError("Choose a valid notification.", 400);
    }

    const { adminDb } = getFirebaseAdminServices();
    const collection = adminDb
      .collection("users")
      .doc(decoded.uid)
      .collection("notifications");
    if (markAll) {
      const unread = await collection.where("readAt", "==", null).limit(250).get();
      const batch = adminDb.batch();
      for (const document of unread.docs) {
        batch.update(document.ref, {
          readAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (!unread.empty) await batch.commit();
      return Response.json({ updated: unread.size });
    }

    const reference = collection.doc(notificationId);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      throw new ApiAuthError("That notification could not be found.", 404);
    }
    await reference.update({
      readAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ updated: 1 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
