import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logInfo } = await import("./app/lib/observability");
  logInfo("service.runtime.started", {
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
  });
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./app/lib/observability");
  logError(
    "next.request.unhandled",
    {
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
    },
    error,
  );
};
