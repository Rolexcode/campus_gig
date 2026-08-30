# CampusGig

CampusGig is a verified student-work marketplace where clients can post gigs,
review applicants, agree on final terms, and secure payment before work begins.
The hackathon MVP supports local-currency listings and real custodial USDC
settlement on Solana Devnet.

## What works

- Firebase authentication, email ownership, profiles, and student verification
- Isolated admin console with accurate UTC registration analytics, account
  suspension, verification decisions, contract/payment inspection, and a
  dispute queue
- Real Firestore gigs, applications, applicant selection, and hiring state
- Private client/student text chat and mutually accepted final terms
- Persistent in-app notifications for applications, hiring, chat, payment,
  submissions, revisions, releases, and dispute decisions
- Encrypted embedded Solana wallets created with user accounts
- Idempotent server-side Devnet USDC funding with saved Explorer signatures
- Explicit, validated gig lifecycle with an immutable per-gig event history
- Optional CampusGig fee sponsorship so marketplace users do not need SOL
- Real work submissions, revision requests, and client approval
- Atomic Devnet USDC release to the student and CampusGig fee wallet
- Deterministic reviews plus completed-gig, rating, and USDC-earnings reputation
- Participant-raised disputes that freeze work/payment release until an admin
  records a resolution
- Emergency payment pause for funding and release operations

## Demo flow

1. A client posts a gig in NGN or USDC.
2. A verified student applies and the client selects them.
3. Both parties agree on the scope, amount, and deadline in the gig chat.
4. Both accept the same terms.
5. For USDC gigs, the client funds the gig from their embedded Devnet wallet.
6. CampusGig confirms the transfer before marking the gig `in_progress`.
7. The student submits a completion note and optional HTTPS deliverable link.
8. The client requests a revision or approves the work with a rating.
9. Approval atomically transfers the student payout and CampusGig fee, saves
   the Explorer signature, completes the gig, and updates reputation.

The canonical contract path is:

```text
open → hired → terms_pending → awaiting_funding → in_progress → submitted → completed
```

Invalid jumps are rejected server-side. Terms can be revised before funding,
which returns the contract to `terms_pending` and requires fresh acceptance.

## Architecture

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Identity/data:** Firebase Authentication, Firestore, Firebase Admin SDK
- **Email:** Resend
- **Payments:** Solana Web3.js, SPL Token, Circle Devnet USDC
- **Deployment:** Vercel

Payment mutations are server-only. Embedded wallet keys are generated on the
server, encrypted with AES-256-GCM, and never returned to the browser. USDC is
calculated in integer base units. Funding and release use a per-gig custody
wallet, idempotency locks, signed-transaction persistence, and on-chain
confirmation before marketplace state changes. The release contains both the
student payout and the platform fee in one Solana transaction.

The core Firestore records are `gigs`, `applications`, `gigConversations`,
`gigPayments`, `gigSubmissions`, `gigReviews`, `gigDisputes`, and
`platformFeeCollections`. Private notification records live under each user.
Each gig also has an append-only `events` subcollection for lifecycle audit
history.

### Admin operations

The admin identity is separate from marketplace identities and is allowlisted
with `ADMIN_EMAILS`. The console exposes:

- exact Firebase Authentication counts for total registrations and accounts
  created today, this week, and this month using UTC boundaries;
- email-verified, student-verified, pending-verification, suspended, open-gig,
  active-contract, completed-contract, and disputed-contract totals;
- searchable user records with suspension/restoration and refresh-token
  revocation on suspension;
- student-verification approval and decline decisions;
- recent gig, participant, payment-state, and Solana Explorer evidence; and
- dispute review with a mandatory resolution note and safe restoration of the
  pre-dispute state.

The console does not pretend to refund on-chain funds. A production refund
operation must broadcast and confirm the USDC transfer before updating the
marketplace ledger.

See [SECURITY.md](SECURITY.md) for vulnerability reporting, custody boundaries,
known dependency risk, and the launch-security checklist.

### Custody disclosure

This MVP demonstrates real USDC settlement using a CampusGig-controlled
custodial flow. CampusGig's backend controls the encrypted signer and is part of
the trust model. The production path is dedicated key-management/MPC and a
Solana program-controlled vault.

## Local setup

Requires Node.js 22 and Firebase Email/Password authentication plus Firestore.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Required environment variables:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON=
FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64=
RESEND_API_KEY=
RESEND_FROM_EMAIL=CampusGig <onboarding@resend.dev>
ADMIN_EMAILS=
WALLET_ENCRYPTION_KEY=
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
SOLANA_FEE_PAYER_SECRET_KEY_BASE64=
CAMPUSGIG_PLATFORM_FEE_BPS=500
CAMPUSGIG_FEE_WALLET_ADDRESS=
PAYMENTS_PAUSED=false
```

Local development may instead use `GOOGLE_APPLICATION_CREDENTIALS` pointing to
a service-account JSON outside the repository. On Vercel, use the base64 form as
`FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64`; this avoids multiline private-key
parsing issues, and a Windows path does not exist in the deployment environment.
Never commit secrets or `.env.local`.

## Devnet payment test

1. Copy the client's embedded wallet address from the accepted-terms panel.
2. Send Circle Devnet USDC to its USDC token account.
3. Configure and fund a dedicated Devnet fee-payer wallet with SOL. Encode its
   64-byte secret key as base64 in `SOLANA_FEE_PAYER_SECRET_KEY_BASE64`. This
   wallet pays transaction fees and token-account rent; users need no SOL.
4. Post a USDC gig, select a student, and accept terms on both accounts.
5. Click **Secure payment** and open the saved signature on Solana Explorer.
6. On the student account, submit a completion note and optional HTTPS link.
7. On the client account, approve the work, choose a rating, and confirm the
   student payout and CampusGig fee amounts.
8. Open the release signature on Solana Explorer and confirm both token
   transfers. Check the student's profile for the updated reputation totals.

## Verification

```bash
npm run lint
npm test
npm run build
npm start
```

The funding, submission, release, and reputation implementation passes the
production build. A sponsored live lifecycle needs Devnet USDC in the client
wallet, Devnet SOL only in the dedicated CampusGig fee-payer wallet, and a
public `CAMPUSGIG_FEE_WALLET_ADDRESS` that receives the platform fee.

## Production boundaries and next milestones

- Program-controlled escrow/PDA custody
- Production fee sponsorship through Kora or dedicated KMS/MPC infrastructure
- Confirmed on-chain refunds, richer moderation evidence, appeals, and
  operational reconciliation jobs
- Pagination/export and durable analytics projections for marketplace-scale
  admin datasets
- Firebase Storage deliverables with malware scanning and signed access
- Optional regulated local-currency off-ramp integration
