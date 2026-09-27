import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  logError,
  sanitizeLogFields,
  withApiObservability,
} from "./observability";

describe("observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive fields and bounds untrusted log text", () => {
    const fields = sanitizeLogFields({
      requestId: "safe-request-id",
      authorization: "Bearer do-not-log",
      nested: {
        email: "student@example.com",
        walletSecret: "do-not-log",
        status: "funded",
      },
      note: `line one\n${"x".repeat(400)}`,
    });

    expect(fields.authorization).toBe("[redacted]");
    expect(fields.nested).toEqual({
      email: "[redacted]",
      walletSecret: "[redacted]",
      status: "funded",
    });
    expect(String(fields.note)).not.toContain("\n");
    expect(String(fields.note).length).toBeLessThanOrEqual(240);
  });

  it("adds correlation and timing headers without logging request bodies", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const handler = withApiObservability(
      "/api/test",
      async () => Response.json({ ok: true }, { status: 201 }),
    );
    const response = await handler(
      new Request("https://campusgig.example/api/test", {
        method: "POST",
        headers: { "x-request-id": "request-12345678" },
        body: JSON.stringify({ password: "not-logged" }),
      }),
      {},
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("request-12345678");
    expect(response.headers.get("server-timing")).toMatch(/^app;dur=\d+$/);
    const output = info.mock.calls.map(([entry]) => String(entry)).join("\n");
    expect(output).toContain('"route":"/api/test"');
    expect(output).not.toContain("not-logged");
  });

  it("records error type without emitting the error message", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError(
      "payment.failed",
      { email: "private@example.com", status: "failed" },
      new Error("private provider response"),
    );

    const output = String(error.mock.calls[0]?.[0]);
    expect(output).toContain('"errorType":"Error"');
    expect(output).toContain('"email":"[redacted]"');
    expect(output).not.toContain("private provider response");
  });
});
