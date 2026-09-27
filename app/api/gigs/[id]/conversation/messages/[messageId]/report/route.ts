import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  cleanConversationId,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  parseSafetyReportInput,
  safetyReportPriority,
} from "@/app/lib/safety-reports";
import {
  ApiAuthError,
  apiErrorResponse,
  requireMarketplaceUser,
} from "@/app/lib/server-auth";
import { enforceServerRateLimit } from "@/app/lib/server-rate-limit";

export const runtime = "nodejs";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const decoded = await requireMarketplaceUser(request);
    const { id: rawId, messageId: rawMessageId } = await context.params;
    const gigId = cleanConversationId(rawId);
    const messageId = cleanConversationId(rawMessageId);
    let input: ReturnType<typeof parseSafetyReportInput>;
    try {
      input = parseSafetyReportInput(await request.json().catch(() => ({})));
    } catch (error) {
      throw new ApiAuthError(
        error instanceof Error ? error.message : "Choose a valid report reason.",
        400,
      );
    }

    const { adminDb } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, gigId, decoded.uid);
    await enforceServerRateLimit({
      adminDb,
      bucket: "safety_report",
      key: decoded.uid,
      limit: 10,
      windowMs: 24 * 60 * 60 * 1_000,
      errorMessage:
        "You have submitted several reports today. Contact support if someone is in immediate danger.",
    });

    const messageReference = access.conversationReference
      .collection("messages")
      .doc(messageId);
    const messageSnapshot = await messageReference.get();
    if (!messageSnapshot.exists) {
      throw new ApiAuthError("That message could not be found.", 404);
    }
    const message = messageSnapshot.data() ?? {};
    const subjectUserId = String(message.senderId ?? "");
    const subjectRole = String(message.senderRole ?? "");
    if (!subjectUserId || subjectRole === "system") {
      throw new ApiAuthError("System messages cannot be reported.", 400);
    }
    if (subjectUserId === decoded.uid) {
      throw new ApiAuthError("You cannot report your own message.", 400);
    }
    if (
      subjectUserId !== access.conversation.ownerId &&
      subjectUserId !== access.conversation.studentId
    ) {
      throw new ApiAuthError("That message does not belong to this conversation.", 409);
    }

    const reportId = createHash("sha256")
      .update(`${gigId}:${messageId}:${decoded.uid}`)
      .digest("hex");
    const reportReference = adminDb.collection("safetyReports").doc(reportId);
    const reporterRole =
      decoded.uid === access.conversation.ownerId ? "client" : "student";
    const reporterName =
      reporterRole === "client"
        ? access.conversation.ownerName
        : access.conversation.studentName;
    const attachment = message.attachment as Record<string, unknown> | undefined;

    await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(reportReference);
      if (existing.exists) {
        throw new ApiAuthError(
          "You already reported this message. The safety team has the evidence.",
          409,
        );
      }
      transaction.create(reportReference, {
        reportId,
        gigId,
        gigTitle: String(access.gig.title ?? "Untitled gig"),
        messageId,
        reporterId: decoded.uid,
        reporterName,
        reporterRole,
        subjectUserId,
        subjectName: String(message.senderName ?? "CampusGig member"),
        subjectRole,
        category: input.category,
        details: input.details,
        priority: safetyReportPriority(input.category),
        status: "open",
        assignedToUid: "",
        assignedToEmail: "",
        resolutionAction: "",
        resolutionNote: "",
        messageEvidence: {
          text: String(message.text ?? "").slice(0, 1_000),
          attachment: attachment?.name
            ? {
                name: String(attachment.name).slice(0, 160),
                contentType: String(attachment.contentType ?? "").slice(0, 120),
                size: Number(attachment.size ?? 0),
                sha256: String(attachment.sha256 ?? "").slice(0, 64),
                scanStatus: String(attachment.scanStatus ?? ""),
              }
            : null,
          sentAt: dateValue(message.createdAt),
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return Response.json(
      {
        report: {
          id: reportId,
          status: "open",
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
