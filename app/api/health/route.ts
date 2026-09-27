import { timingSafeEqual } from "node:crypto";
import { getFirebaseAdminServices } from "@/app/lib/firebase-admin";
import { withApiObservability } from "@/app/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secureTokenMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function releaseIdentity() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local";
}

async function deepFirebaseCheck() {
  const { adminDb } = getFirebaseAdminServices();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      adminDb.collection("_operations").doc("readiness").get(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Firebase readiness check timed out.")),
          3_000,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function health(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const common = {
    service: "campusgig-web",
    release: releaseIdentity(),
    timestamp: new Date().toISOString(),
  };

  if (!deep) {
    return Response.json(
      { status: "ok", ...common },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const expectedToken = process.env.HEALTH_CHECK_TOKEN?.trim() ?? "";
  const providedToken =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";
  if (!expectedToken) {
    return Response.json(
      { status: "not_configured", ...common },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!providedToken || !secureTokenMatch(providedToken, expectedToken)) {
    return Response.json(
      { status: "unauthorized", ...common },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await deepFirebaseCheck();
    return Response.json(
      {
        status: "ready",
        ...common,
        checks: { application: "ok", firebase: "ok" },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "not_ready",
        ...common,
        checks: { application: "ok", firebase: "failed" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = withApiObservability("/api/health", health);
