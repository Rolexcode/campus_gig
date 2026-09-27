export const ONLINE_WINDOW_MS = 60_000;
export const TYPING_WINDOW_MS = 7_000;

export type ConversationPresence = {
  online: boolean;
  typing: boolean;
  lastSeenAt: string;
};

export function presenceState(
  data: Record<string, unknown> | undefined,
  now = Date.now(),
): ConversationPresence {
  const lastSeenAtMs = Number(data?.lastSeenAtMs ?? 0);
  const typingUntilMs = Number(data?.typingUntilMs ?? 0);
  return {
    online: lastSeenAtMs > 0 && now - lastSeenAtMs <= ONLINE_WINDOW_MS,
    typing: typingUntilMs > now,
    lastSeenAt: lastSeenAtMs > 0 ? new Date(lastSeenAtMs).toISOString() : "",
  };
}
