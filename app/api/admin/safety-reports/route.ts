import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { parseSafetyAdminAction } from "@/app/lib/safety-reports";
import {
  ApiAuthError,
  apiErrorResponse,
  isConfiguredAdminEmail,
  requireAdmin,
} from "@/app/lib/server-auth";
import { writeUserNotification } from "@/app/lib/user-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateValue(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function cleanReportId(value: unknown) {
  const reportId = String(value ?? "").trim();
  if (!/^[a-f0-9]{64}$/.test(reportId)) {
    throw new ApiAuthError("Choose a valid safety report.", 400);
  }
  return reportId;
}

function reportValue(id: string, data: Record<string, unknown>) {
  const evidence = (data.messageEvidence ?? {}) as Record<string, unknown>;
  const attachment = evidence.attachment as Record<string, unknown> | null;
  return {
    id,
    gigId: String(data.gigId ?? ""),
    gigTitle: String(data.gigTitle ?? "Untitled gig"),
    messageId: String(data.messageId ?? ""),
    reporterId: String(data.reporterId ?? ""),
    reporterName: String(data.reporterName ?? "CampusGig member"),
    reporterRole: String(data.reporterRole ?? ""),
    subjectUserId: String(data.subjectUserId ?? ""),
    subjectName: String(data.subjectName ?? "CampusGig member"),
    subjectRole: String(data.subjectRole ?? ""),
    category: String(data.category ?? "other"),
    details: String(data.details ?? ""),
    priority: String(data.priority ?? "normal"),
    status: String(data.status ?? "open"),
    assignedToEmail: String(data.assignedToEmail ?? ""),
    resolutionAction: String(data.resolutionAction ?? ""),
    resolutionNote: String(data.resolutionNote ?? ""),
    accountDisabled: data.accountDisabled === true,
    messageEvidence: {
      text: String(evidence.text ?? ""),
      sentAt: typeof evidence.sentAt === "string" ? evidence.sentAt : null,
      attachment: attachment?.name
        ? {
            name: String(attachment.name),
            contentType: String(attachment.contentType ?? ""),
            size: Number(attachment.size ?? 0),
            sha256: String(attachment.sha256 ?? ""),
            scanStatus: String(attachment.scanStatus ?? ""),
          }
        : null,
    },
    createdAt: dateValue(data.createdAt),
    reviewedAt: dateValue(data.reviewedAt),
    resolvedAt: dateValue(data.resolvedAt),
    updatedAt: dateValue(data.updatedAt),
  };
}

async function safetyCounts(adminDb: FirebaseFirestore.Firestore) {
  const [open, reviewing, resolved, dismissed] = await Promise.all(
    ["open", "reviewing", "resolved", "dismissed"].map((status) =>
      adminDb
        .collection("safetyReports")
        .where("status", "==", status)
        .count()
        .get(),
    ),
  );
  return {
    open: open.data().count,
    reviewing: reviewing.data().count,
    resolved: resolved.data().count,
    dismissed: dismissed.data().count,
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { adminDb } = getFirebaseAdminServices();
    const [snapshot, counts] = await Promise.all([
      adminDb
        .collection("safetyReports")
        .orderBy("createdAt", "desc")
        .limit(250)
        .get(),
      safetyCounts(adminDb),
    ]);
    return Response.json({
      reports: snapshot.docs.map((document) =>
        reportValue(document.id, document.data()),
      ),
      counts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const reportId = cleanReportId(body.reportId);
    let input: ReturnType<typeof parseSafetyAdminAction>;
    try {
      input = parseSafetyAdminAction(body);
    } catch (error) {
      throw new ApiAuthError(
        error instanceof Error ? error.message : "Choose a valid safety action.",
        400,
      );
    }

    const { adminAuth, adminDb } = getFirebaseAdminServices();
    const reportReference = adminDb.collection("safetyReports").doc(reportId);
    const auditReference = adminDb.collection("adminAuditEvents").doc();
    const current = await reportReference.get();
    if (!current.exists) throw new ApiAuthError("That report no longer exists.", 404);
    const currentData = current.data() ?? {};
    const currentStatus = String(currentData.status ?? "open");
    if (!["open", "reviewing"].includes(currentStatus)) {
      throw new ApiAuthError("This safety report has already been closed.", 409);
    }

    if (input.action === "suspend") {
      const subjectUserId = String(currentData.subjectUserId ?? "");
      if (!subjectUserId || subjectUserId === admin.uid) {
        throw new ApiAuthError("That account cannot be suspended from this report.", 400);
      }
      const target = await adminAuth.getUser(subjectUserId);
      if (isConfiguredAdminEmail(target.email)) {
        throw new ApiAuthError(
          "Administrator identities cannot be suspended from a marketplace report.",
          403,
        );
      }
      await adminDb.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reportReference);
        if (!snapshot.exists) throw new ApiAuthError("That report no longer exists.", 404);
        if (!["open", "reviewing"].includes(String(snapshot.data()?.status ?? ""))) {
          throw new ApiAuthError("This safety report has already been closed.", 409);
        }
        transaction.update(reportReference, {
          status: "reviewing",
          enforcementPending: true,
          assignedToUid: admin.uid,
          assignedToEmail: admin.email ?? "",
          reviewedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await adminAuth.updateUser(subjectUserId, { disabled: true });
      await adminAuth.revokeRefreshTokens(subjectUserId);
    }

    const terminal = input.action !== "review";
    const nextStatus =
      input.action === "review"
        ? "reviewing"
        : input.action === "dismiss"
          ? "dismissed"
          : "resolved";
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reportReference);
      if (!snapshot.exists) throw new ApiAuthError("That report no longer exists.", 404);
      const data = snapshot.data() ?? {};
      if (!["open", "reviewing"].includes(String(data.status ?? ""))) {
        throw new ApiAuthError("This safety report has already been closed.", 409);
      }
      transaction.update(reportReference, {
        status: nextStatus,
        assignedToUid: admin.uid,
        assignedToEmail: admin.email ?? "",
        reviewedAt: data.reviewedAt ?? FieldValue.serverTimestamp(),
        resolutionAction: terminal ? input.action : "",
        resolutionNote: terminal ? input.resolutionNote : "",
        accountDisabled: input.action === "suspend",
        enforcementPending: false,
        resolvedAt: terminal ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditReference, {
        action: `safety_report_${input.action}`,
        actorUid: admin.uid,
        actorEmail: admin.email ?? "",
        targetUid: String(data.subjectUserId ?? ""),
        reportId,
        gigId: String(data.gigId ?? ""),
        createdAt: FieldValue.serverTimestamp(),
      });
      if (terminal) {
        writeUserNotification(transaction, adminDb, {
          userId: String(data.reporterId ?? ""),
          eventId: `safety_report_closed_${reportId}`,
          type: "system",
          title: "Safety report reviewed",
          body:
            input.action === "dismiss"
              ? "The safety team reviewed your report and closed the case. Contact support if you have new evidence or an urgent concern."
              : "The safety team reviewed your report and recorded an appropriate account action.",
          href: `/gigs/${String(data.gigId ?? "")}/conversation`,
          gigId: String(data.gigId ?? ""),
          actorId: admin.uid,
        });
      }
    });

    const updated = await reportReference.get();
    return Response.json({ report: reportValue(updated.id, updated.data() ?? {}) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
