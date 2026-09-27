import "server-only";

import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const SENSITIVE_FIELD =
  /authorization|cookie|password|passcode|token|secret|private|credential|service.?account|signed.?transaction|email|phone|full.?name|document|photo|payload|body/i;
const MAX_STRING_LENGTH = 240;
const MAX_ARRAY_ITEMS = 20;
const MAX_DEPTH = 4;

function safeString(value: string) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, MAX_STRING_LENGTH);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return safeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [
          safeString(key),
          SENSITIVE_FIELD.test(key)
            ? "[redacted]"
            : sanitizeValue(item, depth + 1),
        ]),
    );
  }
  return safeString(String(value));
}

export function sanitizeLogFields(fields: LogFields) {
  return sanitizeValue(fields, 0) as LogFields;
}

function errorFields(error: unknown): LogFields {
  if (!(error instanceof Error)) return { errorType: "UnknownError" };
  const candidate = error as Error & { code?: unknown; digest?: unknown };
  return {
    errorType: safeString(error.name || "Error"),
    errorCode:
      typeof candidate.code === "string"
        ? safeString(candidate.code)
        : undefined,
    errorDigest:
      typeof candidate.digest === "string"
        ? safeString(candidate.digest)
        : undefined,
  };
}

function writeLog(level: LogLevel, event: string, fields: LogFields = {}) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "campusgig-web",
    environment:
      process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    event: safeString(event),
    ...sanitizeLogFields(fields),
  });

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export function logInfo(event: string, fields?: LogFields) {
  writeLog("info", event, fields);
}

export function logWarning(event: string, fields?: LogFields) {
  writeLog("warn", event, fields);
}

export function logError(
  event: string,
  fields: LogFields = {},
  error?: unknown,
) {
  writeLog("error", event, {
    ...fields,
    ...(error === undefined ? {} : errorFields(error)),
  });
}

function usableRequestId(value: string | null) {
  const requestId = value?.trim() ?? "";
  return /^[A-Za-z0-9._:-]{8,128}$/.test(requestId) ? requestId : "";
}

export function requestIdFor(request: Request) {
  return (
    usableRequestId(request.headers.get("x-vercel-id")) ||
    usableRequestId(request.headers.get("x-request-id")) ||
    randomUUID()
  );
}

type ApiHandler<TContext> = (
  request: Request,
  context: TContext,
) => Response | Promise<Response>;

export function withApiObservability<TContext>(
  route: string,
  handler: ApiHandler<TContext>,
): ApiHandler<TContext> {
  return async (request, context) => {
    const startedAt = Date.now();
    const requestId = requestIdFor(request);
    const fields = {
      requestId,
      route,
      method: request.method,
    };
    logInfo("api.request.started", fields);

    try {
      const response = await handler(request, context);
      const durationMs = Date.now() - startedAt;
      const completion = {
        ...fields,
        status: response.status,
        durationMs,
      };
      if (response.status >= 500) logError("api.request.completed", completion);
      else if (response.status >= 400)
        logWarning("api.request.completed", completion);
      else logInfo("api.request.completed", completion);

      try {
        response.headers.set("x-request-id", requestId);
        response.headers.set("server-timing", `app;dur=${durationMs}`);
      } catch {
        logWarning("api.response.headers_immutable", fields);
      }
      return response;
    } catch (error) {
      logError(
        "api.request.unhandled",
        { ...fields, durationMs: Date.now() - startedAt },
        error,
      );
      throw error;
    }
  };
}
