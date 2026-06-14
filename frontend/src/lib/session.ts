/**
 * Per-page-load session id for pilot telemetry.
 *
 * A "session" in the live experiment is one visit/page-load. We mint a uuid
 * once per tab and keep it in sessionStorage so a reload reuses it but a new
 * tab/visit starts fresh. The persistent per-browser identity (unique-user
 * proxy) is a separate server-issued cookie (pv_client_id); this is only the
 * session grouping key sent alongside events and feedback.
 */
const KEY = "pv_session_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers.
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage disabled — fall back to a per-call id so calls
    // still succeed (just not groupable). Rare.
    return uuid();
  }
}
