// Browser-side error monitoring. No-ops when NEXT_PUBLIC_SENTRY_DSN isn't
// set — see src/instrumentation.ts for the server/edge counterpart.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
