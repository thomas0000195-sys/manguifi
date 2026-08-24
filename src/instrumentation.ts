// Server + edge runtime error monitoring. No-ops entirely when SENTRY_DSN
// isn't set (local dev, or before the account described in SESSION_REPORT.md
// is created) — Sentry.init() with dsn: undefined is a documented safe no-op.
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      // PII (names, phone numbers) lives in this app's data — never send
      // request bodies/headers by default to avoid leaking it into Sentry.
      sendDefaultPii: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

export async function onRequestError(...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
