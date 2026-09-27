# CampusGig security audit — 2026-09-25

Scope: full application and infrastructure review with emphasis on the Solana
escrow program, server-side signing, payment state transitions, Firebase access,
secrets, dependencies, and CI. The confidence gate for reported vulnerabilities
is 8/10. This is an internal engineering review, not an independent audit.

## Executive decision

CampusGig is suitable for continued Devnet testing. It is **not approved for
mainnet or real customer funds**. The escrow program has strong baseline account
constraints and checked conservation math, but launch remains blocked on an SBF
build/deployment, account-level integration and fuzz testing, an independent
program/application audit, managed signing, multisig authorities, and resolution
reconciliation.

Review grades:

- Security: **C+** (P0 code findings fixed; material P1 launch controls remain)
- Correctness: **B**
- Error handling: **B**
- Testing: **C** (unit coverage exists; program integration/fuzz coverage does not)
- Code organization: **B**
- Documentation: **A-**
- Ready for mainnet: **No**

## Findings fixed in this review

### [HIGH] CG-SEC-001 — escrow config initialization takeover

**Confidence:** 9/10
**Location:** `programs/campus_gig_escrow/src/lib.rs`

The config PDA initializer originally accepted any signer as the first admin.
An attacker monitoring a newly deployed program could initialize the singleton
config first and choose all operational authorities and the fee recipient.

**Fix:** initialization now requires the signer to match the upgrade authority
stored in the program's canonical ProgramData account, and verifies the supplied
program/program-data relationship.

### [HIGH] CG-SEC-002 — deletion could destroy access to funded wallets

**Confidence:** 9/10
**Location:** `app/api/wallet/route.ts`

Account deletion could remove encrypted wallet material while an unsettled
contract or USDC balance still existed. That could permanently strand funds.

**Fix:** deletion now fails closed when either participant has an unsettled
payment or the embedded wallet has a non-zero USDC balance. RPC failures no
longer masquerade as a zero balance.

### [MEDIUM] CG-SEC-003 — encrypted wallet records were not context-bound

**Confidence:** 8/10
**Location:** `app/lib/embedded-wallet.ts`

AES-GCM protected each key, but the ciphertext was not authenticated against its
user or gig identity. A storage-level attacker could substitute an entire valid
wallet record between documents.

**Fix:** new wallet records use AES-256-GCM additional authenticated data bound
to `user:<uid>` or `gig:<id>`, plus a context hash. Legacy v1 decryption remains
read-only compatible for controlled migration.

### [MEDIUM] CG-SEC-004 — incomplete off-chain verification of PDA state

**Confidence:** 8/10
**Location:** `app/lib/program-escrow.ts`, payment and release routes

The application checked the on-chain status and headline amounts but did not
verify every immutable field before advancing Firestore.

**Fix:** the program must be executable, the config must be owned by the program,
and the decoded escrow must match its canonical gig/config/vault PDAs, mint,
participants, amount, fee, and agreement hash before funding or completion is
recorded.

### [MEDIUM] CG-SEC-005 — mutable CI action references

**Confidence:** 8/10
**Location:** `.github/workflows/ci.yml`

CI actions used mutable major-version tags. A compromised upstream tag could
execute in the build environment.

**Fix:** actions are pinned to immutable commit SHAs; workflow permissions remain
read-only, concurrency is bounded, and Rust Clippy is now enforced.

## Open launch blockers

### [HIGH] CG-SEC-006 — application custody uses environment-held signing keys

**Confidence:** 10/10
**Category:** key management / custody
**Priority:** P0 before real funds

The backend can decrypt embedded user wallets and the fee/dispute signers are raw
environment secrets. A Vercel runtime or environment compromise can authorize
transfers. Move signing to managed KMS/MPC or passkey-backed user authorization,
separate duties, rotate keys, and enforce transaction policy outside the web
runtime. The program-controlled vault reduces per-gig escrow-key custody but does
not remove this trust boundary.

### [HIGH] CG-SEC-007 — no program-level integration, fuzz, or independent audit

**Confidence:** 10/10
**Category:** invariant assurance
**Priority:** P0 before mainnet

Seven Rust tests verify settlement arithmetic, and the TypeScript codec has unit
tests, but there is no LiteSVM/local-validator account test, adversarial fuzzing,
reproducible SBF artifact, verified Devnet deployment, or independent audit.
Add signer/PDA/type-cosplay/aliasing/reinitialization tests, Trident fuzz targets,
and machine-checked conservation and one-shot settlement properties. Authorization,
conservation, and state-machine invariants merit formal verification rather than
coverage-only assurance.

### [HIGH] CG-SEC-008 — vulnerable Solana dependency line

**Confidence:** 8/10
**Category:** software supply chain
**Priority:** P1

After safe transitive updates and the React 19.3 security update,
`npm audit --omit=dev` reports three high and six moderate transitive
advisories, including `bigint-buffer` through the Solana 1.x stack. npm's offered
forced fix downgrades to incompatible legacy packages and must not be applied.
Migrate the payment client to the maintained Solana Kit dependency line, remove
the vulnerable transaction stack, then repeat the audit.

### [HIGH] CG-SEC-009 — authority operations lack multisig and dual control

**Confidence:** 9/10
**Category:** privileged access
**Priority:** P0 before mainnet

Upgrade, pause, dispute, and fee-recipient authority plans are single-key. Migrate
upgrade and dispute control to separate Squads multisigs, require two-person
approval for resolution, and keep pause authority operationally separate.

### [MEDIUM] CG-SEC-010 — disputed program funds cannot yet be settled in product

**Confidence:** 10/10
**Category:** exceptional conditions
**Priority:** P1

The Rust program supports `resolve_dispute` and `mutual_refund`, but the product
currently exposes only a safe resume operation. Funds remain protected on-chain,
but operations cannot complete a refund or split without an external transaction.
Implement a dual-controlled resolution service that broadcasts, confirms, checks
the final PDA split, and only then reconciles Firestore.

### [MEDIUM] CG-SEC-011 — no durable chain reconciliation or alerting

**Confidence:** 9/10
**Category:** logging/exception handling
**Priority:** P1

Request-time confirmation is not sufficient for RPC outages, reorg-sensitive
status, or a crash between confirmation and Firestore commit. Add an idempotent
reconciliation worker that treats chain state as authoritative, alerts on ledger
drift, and quarantines ambiguous payments.

### [LOW] CG-SEC-012 — enforced CSP still permits inline scripts

**Confidence:** 8/10
**Category:** browser hardening
**Priority:** P2

HSTS, frame denial, MIME sniffing protection, referrer policy, COOP, a strict
Permissions Policy, and an enforced origin-restricted CSP are present. The policy
still permits inline scripts for compatibility with the current Next.js rendering
path. Move to per-request nonces after removing that dependency; validate the
nonce policy in report-only mode before enforcement to avoid breaking
Firebase/Next.js flows.

### [MEDIUM] CG-SEC-013 — managed attachment scanner deployment required

**Confidence:** 9/10
**Category:** untrusted file processing
**Priority:** P1 before public scale

The application now quarantines every upload, fails closed without a configured
HTTPS scanner, requires a traceable clean verdict for the exact SHA-256 payload,
copies only clean files to the participant-authorized download namespace, and
automatically deletes abandoned quarantine objects through an authenticated
daily retention job. Deployment still requires an approved managed scanner,
availability alerts, and vendor/privacy review before increasing limits or
supporting more file types. The user-facing abuse workflow is now implemented:
participants can privately report a specific message, immutable text and file
metadata are preserved for administrator review, terminal decisions are audited,
and suspension disables Firebase Auth access and revokes refresh tokens.

## Verified controls

- No committed service-account JSON, private-key material, or common token shape
  was found in the current tree or relevant secret-file creation history.
- Firestore denies direct browser access to gigs, applications, conversations,
  wallet keys, payments, and escrow keys; server routes perform ownership checks.
- Payment mutations require authenticated marketplace identities and enforce
  client/participant roles, canonical lifecycle transitions, rate limits,
  idempotency records, and confirmed Solana signatures.
- Rust uses `Signer`, typed Anchor accounts, canonical PDA seeds/bumps, immutable
  participant/mint/vault fields, checked arithmetic, conservation checks, token
  owner/mint constraints, and terminal token-vault closure.
- The program pause blocks new deposits without trapping already funded escrows.
- `npm test`, lint, production build, Rust formatting, seven Rust tests, and
  Clippy with warnings denied pass at this checkpoint.

## STRIDE summary

| Component | Principal threats | Existing mitigation | Required next control |
| --- | --- | --- | --- |
| Firebase/API | spoofing, IDOR, abuse | revoked-token verification, role/ownership checks, deny-by-default rules | shared edge rate limiting and security-event alerts |
| Wallet custody | disclosure, elevation | AES-GCM, server-only records, context binding | KMS/MPC, key rotation, transaction policy, dual control |
| Escrow program | tampering, privilege escalation | typed accounts, PDA constraints, checked math, upgrade-authority initialization | fuzzing, formal invariants, independent audit, multisigs |
| Payment ledger | tampering, repudiation | signatures, Explorer evidence, append-only gig events | durable reconciliation and anomaly alerts |
| CI/deploy | supply-chain tampering | read-only token, pinned actions, locked dependencies | signed provenance/SBOM and protected production promotion |

## Confidence calibration

- Fixed findings: 5 (high: 2, medium: 3)
- Open findings: 8 (high: 4, medium: 3, low: 1)
- Critical: 0
- False positives filtered: generated build metadata, test-only `unwrap`, example
  environment placeholders, and public PDA/program addresses
- Mode: full daily audit, 8/10 confidence gate
