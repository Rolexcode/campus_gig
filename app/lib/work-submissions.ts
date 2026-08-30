export type WorkSubmissionInput = {
  summary: string;
  deliverableUrl: string;
};

export function parseWorkSubmissionInput(value: unknown): WorkSubmissionInput {
  const body = (value ?? {}) as Record<string, unknown>;
  const summary = String(body.summary ?? "").trim();
  const deliverableUrl = String(body.deliverableUrl ?? "").trim();

  if (summary.length < 20 || summary.length > 2_000) {
    throw new Error("Describe the completed work in 20 to 2,000 characters.");
  }
  if (deliverableUrl.length > 1_000) {
    throw new Error("The deliverable link is too long.");
  }
  if (deliverableUrl) {
    let parsed: URL;
    try {
      parsed = new URL(deliverableUrl);
    } catch {
      throw new Error("Add a valid deliverable link beginning with https://.");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Deliverable links must use https://.");
    }
  }

  return { summary, deliverableUrl };
}

export function parseClientFeedback(value: unknown) {
  const body = (value ?? {}) as Record<string, unknown>;
  const feedback = String(body.feedback ?? "").trim();
  if (feedback.length < 10 || feedback.length > 1_500) {
    throw new Error("Explain the requested changes in 10 to 1,500 characters.");
  }
  return feedback;
}
