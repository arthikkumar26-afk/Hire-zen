// Sentry initialization - must be imported first
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN || "https://66714524dab4f6596b7e8bd6b8faad8d@o4510492708175872.ingest.de.sentry.io/4510492747956304";

Sentry.init({
  dsn: dsn,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Setting this option to true will send default PII data to Sentry
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
  // Set release version (optional)
  release: process.env.SENTRY_RELEASE || undefined,
  // Filter out sensitive data
  beforeSend(event, hint) {
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
    }
    return event;
  },
});

