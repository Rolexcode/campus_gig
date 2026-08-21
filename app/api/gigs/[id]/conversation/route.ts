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
    const messageSnapshot = await access.conversationReference
      .collection("messages")
      .orderBy("createdAt", "asc")
      .limit(200)
      .get();
    return Response.json({
      conversation: access.conversation,
      messages: messageSnapshot.docs.map((document) =>
        messageValue(document.id, document.data()),
      ),
      role: decoded.uid === access.conversation.ownerId ? "client" : "student",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
