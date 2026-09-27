import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import {
  attachmentQuarantineTtlHours,
  expiredQuarantineObject,
  validCronAuthorization,
} from "@/app/lib/attachment-retention";
import { ATTACHMENT_QUARANTINE_PREFIX } from "@/app/lib/attachment-malware";
import { logError, logInfo, logWarning } from "@/app/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (
    !validCronAuthorization(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    logWarning("attachment.quarantine_cleanup_unauthorized");
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const ttlHours = attachmentQuarantineTtlHours(
    process.env.CHAT_ATTACHMENT_QUARANTINE_TTL_HOURS,
  );
  try {
    const { adminStorage } = getFirebaseAdminServices();
    const bucket = adminStorage.bucket();
    const [files] = await bucket.getFiles({
      prefix: `${ATTACHMENT_QUARANTINE_PREFIX}/`,
      maxResults: 500,
      autoPaginate: false,
    });
    const now = new Date();
    const expired = files.filter((file) =>
      expiredQuarantineObject(
        { name: file.name, timeCreated: file.metadata.timeCreated },
        now,
        ttlHours,
      ),
    );
    const settled = await Promise.allSettled(
      expired.map((file) => file.delete({ ignoreNotFound: true })),
    );
    const deleted = settled.filter((item) => item.status === "fulfilled").length;
    const failed = settled.length - deleted;
    if (failed) {
      logError("attachment.quarantine_cleanup_partial", {
        inspected: files.length,
        deleted,
        failed,
        ttlHours,
      });
    } else {
      logInfo("attachment.quarantine_cleanup_completed", {
        inspected: files.length,
        deleted,
        ttlHours,
      });
    }
    return Response.json({ ok: failed === 0, inspected: files.length, deleted, failed });
  } catch (error) {
    logError("attachment.quarantine_cleanup_failed", {}, error);
    return Response.json(
      { error: "Quarantine cleanup could not be completed." },
      { status: 500 },
    );
  }
}
