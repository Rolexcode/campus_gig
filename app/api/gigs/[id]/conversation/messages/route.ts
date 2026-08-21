import { FieldValue } from "firebase-admin/firestore";
import {
  cleanConversationId,
  messageValue,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
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
    await Promise.all([
      reference.create({
        senderId: decoded.uid,
        senderName: isOwner
          ? access.conversation.ownerName
          : access.conversation.studentName,
        senderRole: isOwner ? "client" : "student",
        text,
        createdAt: FieldValue.serverTimestamp(),
      }),
      access.conversationReference.set(
        { updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      ),
    ]);
    const created = await reference.get();
    return Response.json(
      { message: messageValue(created.id, created.data() ?? {}) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
