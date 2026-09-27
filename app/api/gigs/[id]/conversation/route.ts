import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  cleanConversationId,
  messageValue,
  requireConversationAccess,
} from "@/app/lib/conversations";
import {
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";
import { presenceState } from "@/app/lib/conversation-presence";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId } = await context.params;
    const id = cleanConversationId(rawId);
    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    const otherId =
      decoded.uid === access.conversation.ownerId
        ? access.conversation.studentId
        : access.conversation.ownerId;
    const [messageSnapshot, presenceSnapshot] = await Promise.all([
      access.conversationReference
        .collection("messages")
        .orderBy("createdAt", "asc")
        .limit(200)
        .get(),
      access.conversationReference.collection("presence").doc(otherId).get(),
    ]);
    return Response.json({
      conversation: access.conversation,
      messages: messageSnapshot.docs.map((document) =>
        messageValue(document.id, document.data()),
      ),
      role: decoded.uid === access.conversation.ownerId ? "client" : "student",
      presence: presenceState(
        presenceSnapshot.exists ? presenceSnapshot.data() : undefined,
      ),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
