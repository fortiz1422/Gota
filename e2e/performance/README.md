# Home performance audit

The workflow builds the fixed baseline `a9f0fdb` and the candidate on the same
runner, with the same lockfile, browser, fonts and synthetic DashboardShell data.
It uses production Webpack builds, a cold browser cache, 4x CPU slowdown,
80 ms network latency and 200 kB/s download throughput. Three runs at each of
390 and 1440 px measure downloaded JavaScript, gzip estimates and cold income
opening time. Gzip estimates are calculated from response bodies, not claimed
as measured CDN wire bytes. Font responses are QA substitutes.

`fixture-page.tsx` is copied into `app/landing/performance-audit/page.tsx` only
inside the isolated CI checkout. There is no committed public fixture route.
External browser traffic is blocked; API requests are intercepted and unknown
endpoints fail the audit. No production data or credentials are needed.

The bundle gate requires a real decrease in initial JavaScript. A separate
check holds a cold installment-form chunk and cancels the loading state. Cold form loading and cancellation are checked on
the real components. Timings are diagnostic and have no flaky percentage gate.

This is not a server/database benchmark, a logged-in production session, a field
Core Web Vitals claim, or a React commit profiler. It does not justify financial
cache changes, SQL changes, indexes, font redesigns or broad memoization.

Run locally in an isolated checkout without production environment files or
credentials. The workflow is the authoritative full before/after procedure;
these commands run the candidate alone:

```sh
export NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture
export GOTA_LOCAL_VERIFY=true
export NEXT_TELEMETRY_DISABLED=1
npm ci
npm install --prefix /tmp/gota-fonts --no-package-lock @fontsource-variable/dm-sans @fontsource/dm-mono
npx playwright install --with-deps chromium
export NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/e2e/forms/fonts/mocked-responses.cjs"
mkdir -p app/landing/performance-audit
cp e2e/performance/fixture-page.tsx app/landing/performance-audit/page.tsx
npx next build --webpack
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
# In another terminal, from the same checkout:
PERF_OUTPUT=performance-results/head.json PERF_EXPECT_DEFERRED=true node e2e/performance/audit.mjs
```

Keep the generated route and `performance-results` out of commits. Baseline and
candidate servers must use separate ports; set `PERF_BASE_URL` for the candidate
if its port differs. The workflow checks process liveness before measuring.

The workflow has read-only repository permissions, one job, a 25-minute limit
and cancels a superseded run on this branch. Reports expire after 14 days.
