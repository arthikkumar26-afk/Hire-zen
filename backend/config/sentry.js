import * as Sentry from '@sentry/node';

// Initialize Sentry
export const initSentry = () => {
  const dsn = process.env.SENTRY_DSN || 'https://c1b093670c453dc08e47a51e8efbfa63@o4510492708175872.ingest.de.sentry.io/4510492714270800';
  
  if (dsn) {
    Sentry.init({
      dsn: dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        // Enable HTTP instrumentation
        Sentry.httpIntegration(),
        // Enable Express integration
        Sentry.expressIntegration(),
      ],
      // Set release version (optional)
      release: process.env.SENTRY_RELEASE || undefined,
      // Additional options
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request) {
          // Remove sensitive headers
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
        }
        return event;
      },
    });
  }
};

// Express error handler for Sentry
export const sentryErrorHandler = Sentry.Handlers.errorHandler();

// Request handler for Sentry
export const sentryRequestHandler = Sentry.Handlers.requestHandler({
  request: {
    headers: true,
    query_string: true,
    data: true,
  },
  transaction: {
    op: 'http.server',
  },
});

// Capture exception
export const captureException = (error, context = {}) => {
  const dsn = process.env.SENTRY_DSN || 'https://c1b093670c453dc08e47a51e8efbfa63@o4510492708175872.ingest.de.sentry.io/4510492714270800';
  if (dsn) {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }
};

// Capture message
export const captureMessage = (message, level = 'info', context = {}) => {
  const dsn = process.env.SENTRY_DSN || 'https://c1b093670c453dc08e47a51e8efbfa63@o4510492708175872.ingest.de.sentry.io/4510492714270800';
  if (dsn) {
    Sentry.captureMessage(message, {
      level,
      contexts: {
        custom: context,
      },
    });
  }
};

