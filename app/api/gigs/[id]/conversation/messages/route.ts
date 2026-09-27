import { FieldValue } from "firebase-admin/firestore";
import {
  cleanConversationId,
  messageValue,
  requireConversationAccess,
} from "@/app/lib/conversations";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { writeUserNotification } from "@/app/lib/user-notifications";
import {
  attachmentValidationMessage,
  hasExpectedFileSignature,
  safeAttachmentName,
} from "@/app/lib/chat-attachments";
import {
  AttachmentScanError,
  attachmentStoragePaths,
  scanChatAttachment,
  type AttachmentScanResult,
} from "@/app/lib/attachment-malware";
import { logWarning } from "@/app/lib/observability";
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
    const contentType = request.headers.get("content-type") ?? "";
    let rawText: unknown = "";
    let attachmentFile: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      rawText = form.get("text") ?? "";
      const candidate = form.get("attachment");
      attachmentFile = candidate instanceof File && candidate.size ? candidate : null;
    } else {
      const body = await request.json().catch(() => ({}));
      rawText = body.text;
    }
    const text = String(rawText ?? "")
      .trim()
      .replace(/\r\n/g, "\n");
    if ((!text && !attachmentFile) || text.length > 1_000)
      throw new ApiAuthError(
        "Write a message up to 1,000 characters or attach a file.",
        400,
      );

    let attachmentBuffer: Buffer | null = null;
    let attachmentName = "";
    if (attachmentFile) {
      const validation = attachmentValidationMessage(attachmentFile);
      if (validation) throw new ApiAuthError(validation, 400);
      attachmentBuffer = Buffer.from(await attachmentFile.arrayBuffer());
      if (
        !hasExpectedFileSignature(
          attachmentFile.type,
          attachmentBuffer.subarray(0, Math.min(attachmentBuffer.length, 4_096)),
        )
      ) {
        throw new ApiAuthError(
          "The file contents do not match the selected file type.",
          400,
        );
      }
      attachmentName = safeAttachmentName(attachmentFile.name);
    }

    const { adminDb, adminStorage } = getFirebaseAdminServices();
    const access = await requireConversationAccess(adminDb, id, decoded.uid);
    const isOwner = decoded.uid === access.conversation.ownerId;
    const reference = access.conversationReference.collection("messages").doc();
    const recipientId = isOwner
      ? access.conversation.studentId
      : access.conversation.ownerId;
    let storagePath = "";
    let attachmentScan: AttachmentScanResult | null = null;
    if (attachmentBuffer && attachmentFile) {
      const paths = attachmentStoragePaths(id, reference.id, attachmentName);
      const bucket = adminStorage.bucket();
      const quarantineObject = bucket.file(paths.quarantine);
      const cleanObject = bucket.file(paths.clean);
      const contentDisposition = `attachment; filename="${attachmentName.replace(/"/g, "")}"`;
      try {
        await quarantineObject.save(attachmentBuffer, {
          resumable: false,
          contentType: "application/octet-stream",
          metadata: {
            cacheControl: "private, no-store, max-age=0",
            contentDisposition,
            metadata: {
              scanStatus: "pending",
              originalContentType: attachmentFile.type,
            },
          },
        });
        attachmentScan = await scanChatAttachment({
          bytes: attachmentBuffer,
          filename: attachmentName,
          contentType: attachmentFile.type,
        });
        await cleanObject.save(attachmentBuffer, {
          resumable: false,
          contentType: attachmentFile.type,
          metadata: {
            cacheControl: "private, no-store, max-age=0",
            contentDisposition,
            metadata: {
              scanStatus: "clean",
              scanEngine: attachmentScan.engine,
              scanId: attachmentScan.scanId,
              sha256: attachmentScan.sha256,
            },
          },
        });
        storagePath = paths.clean;
        await quarantineObject.delete({ ignoreNotFound: true }).catch((error) => {
          logWarning("attachment.quarantine_cleanup_failed", {
            gigId: id,
            messageId: reference.id,
            errorType: error instanceof Error ? error.name : "UnknownError",
          });
        });
      } catch (error) {
        await Promise.all([
          quarantineObject.delete({ ignoreNotFound: true }).catch(() => undefined),
          cleanObject.delete({ ignoreNotFound: true }).catch(() => undefined),
        ]);
        if (error instanceof AttachmentScanError) {
          throw new ApiAuthError(
            error.message,
            error.kind === "unsafe" ? 422 : 503,
          );
        }
        throw error;
      }
    }
    try {
      await adminDb.runTransaction(async (transaction) => {
      transaction.create(reference, {
        senderId: decoded.uid,
        senderName: isOwner
          ? access.conversation.ownerName
          : access.conversation.studentName,
        senderRole: isOwner ? "client" : "student",
        text,
        attachment: attachmentFile
          ? {
              storagePath,
              name: attachmentName,
              size: attachmentFile.size,
              contentType: attachmentFile.type,
              scanStatus: "clean",
              scanEngine: attachmentScan?.engine ?? "",
              scanId: attachmentScan?.scanId ?? "",
              sha256: attachmentScan?.sha256 ?? "",
            }
          : null,
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
        body: text
          ? text.length > 160
            ? `${text.slice(0, 157)}…`
            : text
          : `Sent ${attachmentName}`,
        href: `/gigs/${id}/conversation`,
        gigId: id,
        actorId: decoded.uid,
      });
      });
    } catch (error) {
      if (storagePath) {
        await adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
      }
      throw error;
    }
    const created = await reference.get();
    return Response.json(
      { message: messageValue(created.id, created.data() ?? {}) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
