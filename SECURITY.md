# CampusGig security policy

## Supported code

Security fixes target the latest commit on `main`. The Solana payment flow is
currently a Devnet, custodial pre-production implementation and must not be
presented or operated as audited mainnet escrow.

## Reporting a vulnerability

Use the repository's private **Security → Report a vulnerability** workflow.
Do not open a public issue containing credentials, wallet material, personal
data, reproduction tokens, or an exploitable payment sequence. Include the
affected route, impact, reproduction steps, and the least-sensitive evidence
needed to confirm the report.

## Payment and identity controls

- Payment mutations run on authenticated server routes and use integer USDC
  base units, state-transition validation, idempotency records, and confirmed
  transaction signatures.
- Embedded wallet secrets are encrypted at rest and are never sent to the
  browser. Production custody still requires KMS/MPC or a program-controlled
  vault, key rotation, dual control, and an independent audit.
- Admin access is isolated from marketplace access and allowlisted with
  `ADMIN_EMAILS`. Suspending an account revokes its Firebase refresh tokens.
- A participant dispute freezes release until an administrator records a
  resolution. Refunds require a real, confirmed on-chain transfer before the
  internal ledger can change.
- Secrets belong only in deployment environment variables. Service-account
  JSON, private keys, and `.env.local` must never be committed.

## Dependency posture

CI should run `npm audit`, tests, lint, and a production build. The current
Solana 1.x and Firebase Admin dependency trees include published transitive
advisories for `bigint-buffer` and `uuid`. npm's automatic forced remediation
would install incompatible legacy Solana versions, so it must not be used.
Before a mainnet launch, migrate to patched upstream dependency lines or
replace the affected transaction stack, then repeat the security review.

## Launch requirements

Mainnet or real-customer-money operation requires, at minimum, independent
application and Solana-program audits, managed custody and signer controls,
monitoring and alerting, reconciliation jobs, backup/restore exercises,
malware-scanned private deliverable storage, rate limiting backed by shared
infrastructure, an incident response runbook, and the appropriate
KYC/AML/consumer-protection review for each operating jurisdiction.
