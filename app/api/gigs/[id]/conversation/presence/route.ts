import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  cleanConversationId,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { TYPING_WINDOW_MS } from "@/app/lib/conversation-presence";
import {
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
    const typing = body.typing === true;
    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    const now = Date.now();
    await access.conversationReference.collection("presence").doc(decoded.uid).set(
      {
        lastSeenAtMs: now,
        typingUntilMs: typing ? now + TYPING_WINDOW_MS : now,
      },
      { merge: true },
    );
    return Response.json({ active: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
