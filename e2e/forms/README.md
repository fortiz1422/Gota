# Forms visual and interaction checks

`npm run test:e2e:forms` runs 36 render states and 11 interaction flows at 320×568, 390×844, 768×1024 and 1440×900, with one worker and no retries. `--update-snapshots` deliberately accepts new visual baselines; omit it when checking a stable baseline. All API requests use synthetic fixtures; no production account is used. The fixture page returns notFound outside development.

Install the project dependencies and Playwright Chromium before running. Alternatively use `bash e2e/forms/run-in-docker.sh`. Google Fonts must be reachable. `FORMS_CHROMIUM_PATH` can select an installed Chromium binary.

Screenshot baselines are retained in the private QA package and intentionally excluded from the public repository after automated publication review blocked image uploads. Restore `e2e/forms/__screenshots__` from that package to compare with the reviewed captures. For a new browser/font environment, generate a baseline with `npm run test:e2e:forms -- --update-snapshots` and review it before accepting it. The interaction tests run independently with `npm run test:e2e:forms -- interactions.spec.ts`.

The implementation QA captures were generated with Playwright 1.64.1, Chromium 138.0.7204.0, light mode, reduced motion, scale 1 and es-AR/UTC. Network restrictions required a local DM Sans font fixture; the production font declarations were unchanged. Browser or font changes require a reviewed baseline refresh, not silent snapshot acceptance. These captures demonstrate layout and interactions in this environment, not pixel identity on Safari or physical mobile devices.

The eight original flows cover Argentine decimal input, ARS/USD conversion, validation/no writes, server errors/retry, cancellation/focus return, account opening balances, subscription 409 scope and goal commitment. Three more cover all budget validation messages, busy archive dismissal and the legacy expense PUT payload. API calls and resulting callbacks are checked without writing financial data.

Unit tests in `lib/forms-*` freeze pre-redesign behavior and default surface markup separately from these visual snapshots. No pre-existing test assertions were relaxed. Excluded screens are also protected by keeping base surface markup, base overlay components, endpoints and their source files unchanged; a complete authenticated production screenshot comparison is not claimed.
