import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Double-condition guard:
  //   NODE_ENV === "production" → never fires in local dev, even if someone copies a prod .env
  //   !!SENTRY_DSN             → opt-in for open source forks; no DSN = no Sentry, zero overhead
  // Both must be true. Fly.io's `bun run start` already hardcodes NODE_ENV=production,
  // so this is reliable without any extra configuration.
  enabled: process.env.NODE_ENV === "production" && !!process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.SENTRY_RELEASE,
  integrations: [
    // Auto-instruments ALL anthropic.messages.create() calls:
    // captures model, token counts (input + output), and latency
    Sentry.anthropicAIIntegration(),
  ],
});
