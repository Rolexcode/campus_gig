# CampusGig security policy

## Supported code

Security fixes target the latest commit on `main`. Solana settlement remains
Devnet-only. The custodial flow is the default, while an unaudited Anchor PDA
vault and its application integration are feature-flagged off. Neither mode
may be presented or operated as audited mainnet escrow.

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
  browser. Program mode removes the server-held per-gig escrow key, but the
  backend still authorizes user-wallet actions. Production signing requires
  KMS/MPC or passkey-backed user authorization, key rotation, and dual control.
- Program mode checks the program owner, immutable allowed mint, fee cap,
  participants, amount, agreement hash, and terminal split from confirmed PDA
  state before Firestore advances. The program source and threat model live in
  `programs/campus_gig_escrow` and `docs/escrow-threat-model.md`.
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

Mainnet or real-customer-money operation requires, at minimum, a reproducible
SBF build, local-validator and Devnet integration tests, fuzz/property tests,
independent application and Solana-program audits, multisig program and dispute
authorities, managed custody and signer controls,
monitoring and alerting, reconciliation jobs, backup/restore exercises,
malware-scanned private deliverable storage, rate limiting backed by shared
infrastructure, an incident response runbook, and the appropriate
KYC/AML/consumer-protection review for each operating jurisdiction.
