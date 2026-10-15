#!/bin/sh
# Visual baselines for the landing. Same image, Playwright version, locale and timezone every run.
set -eu
cd "$(dirname "$0")/../.."
uid="${SUDO_UID:-$(id -u)}"
gid="${SUDO_GID:-$(id -g)}"
exec docker run --rm --ipc=host --network=host \
  --user "${uid}:${gid}" \
  -e HOME=/tmp \
  -e TZ=UTC \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -e LANDING_UNDER_TEST \
  -e LANDING_CTA_URL \
  -v "$PWD":/work \
  -w /work \
  mcr.microsoft.com/playwright:v1.64.1-jammy \
  npx playwright test -c e2e/landing/playwright.config.ts "$@"
