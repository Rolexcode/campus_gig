# CampusGig

CampusGig is a global freelance platform built around students.

Clients can post work, review applicants, and hire verified students, while
students can discover paid opportunities, apply for gigs, build a work history,
and grow their reputation through completed jobs.

The idea is simple: students already have useful skills, but finding trusted
paid work can be difficult when they are competing on general freelance
platforms. CampusGig creates a space where student talent is the focus.

## How it works

1. A client posts a gig.
2. Verified students apply.
3. The client reviews applicants and selects a student.
4. Both sides agree on the work, amount, and deadline.
5. Payment is secured before work begins.
6. The student completes and submits the work.
7. The client approves the delivery and leaves a review.
8. The completed gig contributes to the student's reputation.

## Current implementation

- Firebase authentication, progressive professional profiles, email ownership,
  and student verification
- Gigs, applications, hiring, private chat with presence, typing, safe links and
  private attachments, agreed terms, and notifications
- Private message reporting with preserved evidence, a dedicated administrator
  safety queue, audited decisions, and refresh-token-revoking account suspension
- Work submissions, revisions, reviews, ratings, disputes, and admin operations
- Public trust centre, help centre, beta terms, and privacy notice
- Devnet USDC funding, payment evidence, fee splitting, and release
- Flutterwave dynamic NGN virtual-account funding with authenticated webhooks,
  server-to-server transaction verification, and idempotent ledger updates
- Encrypted embedded wallets with optional sponsored Solana transaction fees
- Feature-flagged Anchor/Rust PDA escrow source and application integration

The custom Solana program is not deployed or approved for real funds. Custodial
Devnet settlement remains the default while program integration tests, fuzzing,
managed signing, multisig authorities, a verified deployment, and an independent
audit are completed.

NGN collection is implemented as a funding-only integration. Local payout is
intentionally blocked until beneficiary verification, provider approval for the
marketplace flow, payout reconciliation, refunds, and dispute operations are in
place. Do not describe the current NGN flow as regulated escrow.

### Flutterwave setup

Set `FLUTTERWAVE_SECRET_KEY` and a high-entropy
`FLUTTERWAVE_WEBHOOK_SECRET_HASH` in the server environment. Configure the same
secret hash in Flutterwave Dashboard, and register this webhook URL:

```text
https://YOUR_DOMAIN/api/webhooks/flutterwave
```

The webhook is not trusted on its own. CampusGig validates `verif-hash`, then
re-queries Flutterwave's transaction API and checks the transaction ID,
reference, successful status, currency, and amount before changing contract
state. `FLUTTERWAVE_BASE_URL` defaults to `https://api.flutterwave.com`.

## Local development

Requires Node.js 22. Copy `.env.example` to `.env.local`, then run:

```bash
npm install
npm run dev
```

Verification commands (Java 21 is required only for the isolated Firebase
emulator journey):

```bash
npm test
npm run lint
npm run build
npx playwright install chromium # one-time local browser install
npm run test:e2e
npm run test:e2e:authenticated
cargo test -p campus-gig-escrow
```

The Playwright suite runs the public and authentication experience in desktop
and mobile Chromium, checks the production security headers, exercises route
recovery and navigation, proves keyboard-only navigation bypass and form entry,
validates the public liveness endpoint and correlation header, and fails on
WCAG A/AA violations detected by axe.
The authenticated suite starts disposable Firebase Auth, Firestore, and Storage emulators,
proves sign-up and email verification, seeds a client, verified student, and
administrator, saves a progressive profile with professional links, and
exercises the real post → apply → inspect → select → chat → presence/typing →
private file transfer → agree-terms journey plus administrator analytics. It
refuses to run unless the emulator environment is configured, so test accounts,
documents, and attachments cannot reach the production Firebase project. GitHub
Actions runs both browser suites on every pull request and main-branch push.

Chat attachments are limited to 4 MB and accepted only as PDF, plain text, JPG,
PNG, or WebP. The server checks the declared type and file signature, stores the
object in a private quarantine, and requires a clean, traceable verdict from the
configured managed scanner before copying it to the participant-only download
namespace. Production fails closed when the scanner is unavailable or
misconfigured. An authenticated daily job removes abandoned quarantine objects.
See the [attachment security runbook](docs/attachment-security.md) before
enabling file sharing outside isolated development.

Never commit `.env.local`, wallet keys, or Firebase service-account credentials.
Set `NEXT_PUBLIC_SUPPORT_EMAIL` to a monitored support inbox before publishing;
the help, trust, terms, and privacy pages intentionally avoid displaying an
unmonitored fallback address.
Set an independent high-entropy `HEALTH_CHECK_TOKEN` before configuring a
monitor to call `/api/health?deep=1`; the public `/api/health` endpoint performs
liveness only and does not make billable Firebase reads. Runtime logs use
redacted JSON, responses carry `x-request-id` and `server-timing`, and Vercel Web
Analytics plus Speed Insights are mounted in the root layout. See the
[incident-response runbook](docs/incident-response.md) before operating a public
beta.
See [SECURITY.md](SECURITY.md), the
[escrow threat model](docs/escrow-threat-model.md), and the latest
[internal security audit](docs/security-audit-2026-09-25.md) for the current
trust boundaries and launch blockers. The latest
[product-readiness review](docs/product-readiness-review-2026-09-26.md) records
the user-experience scorecard, verification evidence, and prioritised path from
strong beta to public real-money launch.
