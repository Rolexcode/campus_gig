# CampusGig

CampusGig is a verified student-work marketplace where clients can post gigs,
review applicants, agree on final terms, and secure payment before work begins.
The hackathon MVP supports local-currency listings and real custodial USDC
settlement on Solana Devnet.

## What works

- Firebase authentication, email ownership, profiles, and student verification
- Isolated admin console with verification approve/decline actions
- Real Firestore gigs, applications, applicant selection, and hiring state
- Private client/student text chat and mutually accepted final terms
- Encrypted embedded Solana wallets created with user accounts
- Idempotent server-side Devnet USDC funding with saved Explorer signatures

## Demo flow

1. A client posts a gig in NGN or USDC.
2. A verified student applies and the client selects them.
3. Both parties agree on the scope, amount, and deadline in the gig chat.
4. Both accept the same terms.
5. For USDC gigs, the client funds the gig from their embedded Devnet wallet.
6. CampusGig confirms the transfer before marking the gig `in_progress`.

## Architecture

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Identity/data:** Firebase Authentication, Firestore, Firebase Admin SDK
- **Email:** Resend
- **Payments:** Solana Web3.js, SPL Token, Circle Devnet USDC
- **Deployment:** Vercel

Payment mutations are server-only. Embedded wallet keys are generated on the
server, encrypted with AES-256-GCM, and never returned to the browser. USDC is
calculated in integer base units. Funding uses a per-gig custody wallet, an
idempotency lock, signature persistence, and on-chain confirmation before the
marketplace state changes.

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
RESEND_API_KEY=
RESEND_FROM_EMAIL=CampusGig <onboarding@resend.dev>
ADMIN_EMAILS=
WALLET_ENCRYPTION_KEY=
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
CAMPUSGIG_PLATFORM_FEE_BPS=500
```

Local development may instead use `GOOGLE_APPLICATION_CREDENTIALS` pointing to
a service-account JSON outside the repository. On Vercel, paste the minified
JSON as `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`; a Windows path does not exist in
the deployment environment. Never commit secrets or `.env.local`.

## Devnet payment test

1. Copy the client's embedded wallet address from the accepted-terms panel.
2. Fund it with Devnet SOL for fees and account rent.
3. Send Circle Devnet USDC to its USDC token account.
4. Post a USDC gig, select a student, and accept terms on both accounts.
5. Click **Secure payment** and open the saved signature on Solana Explorer.

## Verification

```bash
npm run lint
npm run build
npm start
```

The funding implementation passes the production build. A live transfer needs
Devnet SOL and Devnet USDC in the client wallet.

## Next milestones

- Work submission, approval, and USDC release with CampusGig's fee split
- Completed-job reputation and reviews
- Program-controlled escrow/PDA custody
- Optional regulated local-currency off-ramp integration
