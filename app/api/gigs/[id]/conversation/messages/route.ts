import { FieldValue } from "firebase-admin/firestore";
import {
  cleanConversationId,
  messageValue,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { writeUserNotification } from "@/app/lib/user-notifications";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const body = await request.json().catch(() => ({}));
    const text = String(body.text ?? "")
      .trim()
      .replace(/\r\n/g, "\n");
    if (!text || text.length > 1_000)
      throw new ApiAuthError(
        "Write a message between 1 and 1,000 characters.",
        400,
      );

    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    const isOwner = decoded.uid === access.conversation.ownerId;
    const reference = access.conversationReference.collection("messages").doc();
    const recipientId = isOwner
      ? access.conversation.studentId
      : access.conversation.ownerId;
    await adminDb.runTransaction(async (transaction) => {
      transaction.create(reference, {
        senderId: decoded.uid,
        senderName: isOwner
          ? access.conversation.ownerName
          : access.conversation.studentName,
        senderRole: isOwner ? "client" : "student",
        text,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        access.conversationReference,
        { updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      writeUserNotification(transaction, adminDb, {
        userId: recipientId,
        eventId: `message_${id}_${reference.id}`,
        type: "system",
        title: `New message from ${isOwner ? access.conversation.ownerName : access.conversation.studentName}`,
        body: text.length > 160 ? `${text.slice(0, 157)}…` : text,
        href: `/gigs/${id}/conversation`,
        gigId: id,
        actorId: decoded.uid,
      });
    });
    const created = await reference.get();
    return Response.json(
      { message: messageValue(created.id, created.data() ?? {}) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
