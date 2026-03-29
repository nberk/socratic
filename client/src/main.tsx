import * as Sentry from "@sentry/react";
import { browserTracingIntegration } from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Double-condition guard (mirrors the backend):
  //   import.meta.env.PROD     → Vite sets this to true only during `vite build`, never in dev server
  //   !!VITE_SENTRY_DSN        → opt-in; no DSN = disabled, no overhead
  enabled: Boolean(import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN),
  tracesSampleRate: 1.0,
  integrations: [browserTracingIntegration()],
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
});

const SentryApp = Sentry.withErrorBoundary(App, {
  fallback: ({ error, resetError }) => (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p>{error instanceof Error ? error.message : "An unexpected error occurred."}</p>
      <button onClick={resetError}>Try again</button>
    </div>
  ),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SentryApp />
    </BrowserRouter>
  </StrictMode>
);
