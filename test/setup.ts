import { vi } from "vitest";

// Mock Sentry globally — tests should never send telemetry
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  startSpan: vi.fn(),
  withScope: vi.fn(),
  addBreadcrumb: vi.fn(),
  Handlers: {
    requestHandler: vi.fn(() => vi.fn()),
    errorHandler: vi.fn(() => vi.fn()),
  },
}));

// Set dummy API key so Anthropic SDK doesn't throw at import time
if (!process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = "test-dummy-key";
}

// Fallback DATABASE_URL for unit tests that don't need a real DB
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://localhost:5432/socratic_test";
}
