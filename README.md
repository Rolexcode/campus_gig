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

- Firebase authentication, profiles, email ownership, and student verification
- Gigs, applications, hiring, private chat, agreed terms, and notifications
- Work submissions, revisions, reviews, ratings, disputes, and admin operations
- Devnet USDC funding, payment evidence, fee splitting, and release
- Encrypted embedded wallets with optional sponsored Solana transaction fees
- Feature-flagged Anchor/Rust PDA escrow source and application integration

The custom Solana program is not deployed or approved for real funds. Custodial
Devnet settlement remains the default while program integration tests, fuzzing,
managed signing, multisig authorities, a verified deployment, and an independent
audit are completed.

## Local development

Requires Node.js 22. Copy `.env.example` to `.env.local`, then run:

```bash
npm install
npm run dev
```

Verification commands:

```bash
npm test
npm run lint
npm run build
cargo test -p campus-gig-escrow
```

Never commit `.env.local`, wallet keys, or Firebase service-account credentials.
See [SECURITY.md](SECURITY.md), the
[escrow threat model](docs/escrow-threat-model.md), and the latest
[internal security audit](docs/security-audit-2026-09-25.md) for the current
trust boundaries and launch blockers.
