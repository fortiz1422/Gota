#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
docker run --rm --ipc=host -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.64.1-jammy npx playwright test -c e2e/forms/playwright.config.ts "$@"
