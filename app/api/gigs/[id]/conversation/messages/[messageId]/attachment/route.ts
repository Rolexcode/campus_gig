import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  cleanConversationId,
  requireConversationAccess,
} from "@/app/lib/conversations";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";
import { safeAttachmentName } from "@/app/lib/chat-attachments";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId, messageId: rawMessageId } = await context.params;
    const id = cleanConversationId(rawId);
    const messageId = cleanConversationId(rawMessageId);
    const { adminDb, adminStorage } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    const messageSnapshot = await access.conversationReference
      .collection("messages")
      .doc(messageId)
      .get();
    if (!messageSnapshot.exists)
      throw new ApiAuthError("This attachment could not be found.", 404);
    const attachment = messageSnapshot.data()?.attachment as
      | Record<string, unknown>
      | undefined;
    const storagePath = String(attachment?.storagePath ?? "");
    if (attachment?.scanStatus !== "clean")
      throw new ApiAuthError(
        "This attachment has not passed its security check.",
        423,
      );
    const requiredPrefix = `chatAttachments/${id}/${messageId}/`;
    if (!storagePath.startsWith(requiredPrefix))
      throw new ApiAuthError("This message does not have an attachment.", 404);

    const [contents] = await adminStorage.bucket().file(storagePath).download();
    const name = safeAttachmentName(String(attachment?.name ?? "attachment"));
    const contentType = String(
      attachment?.contentType ?? "application/octet-stream",
    );
    return new Response(new Uint8Array(contents), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
        "Content-Length": String(contents.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
