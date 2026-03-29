#!/bin/bash
set -euo pipefail

# Load .env into the environment if present.
# set -a exports every variable defined after it; set +a stops that.
# This is the standard Unix pattern for loading env files into a shell.
# In CI, skip this — variables should already be exported in the environment.
if [ -f .env ]; then
  set -a
  # shellcheck source=.env
  source .env
  set +a
fi

fly deploy \
  --build-arg SENTRY_RELEASE="$(git rev-parse HEAD)" \
  --build-arg VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}" \
  --build-arg SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-}" \
  --build-arg SENTRY_ORG="${SENTRY_ORG:-}" \
  --build-arg SENTRY_PROJECT="${SENTRY_PROJECT:-}"
