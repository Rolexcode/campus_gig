# CampusGig PDA escrow threat model

## Scope

The program holds one accepted gig's SPL-token deposit in a token account whose
authority is the gig escrow PDA. It does not price assets, swap tokens, borrow,
or depend on an oracle. The configured mint is immutable so a lookalike token
cannot be substituted for USDC.

## Authorities

- **Client:** funds the escrow and may release the full contract amount.
- **Worker:** receives the payout and co-signs a mutual full refund.
- **Dispute authority:** may resolve only an already-disputed escrow and choose
  the worker gross amount. The remainder returns to the client.
- **Pause authority:** prevents new deposits. Existing users can still release,
  mutually refund, open a dispute, or resolve one while paused.
- **Admin:** rotates operational authorities and uses a two-step admin transfer.
  Before mainnet, admin, pause, and dispute authorities must be separate Squads
  multisigs with documented signer and timelock policies.

None of the privileged authorities can directly withdraw a funded vault. The
dispute authority can route a disputed deposit only to the immutable client,
worker, and platform destinations recorded or constrained by the escrow.

## Core invariants

1. Each `gig_id_hash` creates at most one escrow PDA.
2. The vault mint equals the config's immutable allowed mint.
3. The vault authority is the escrow PDA; no server-held escrow key exists.
4. Settlement is single-use because only `Funded` or `Disputed` states settle.
5. `worker_net + client_refund + platform_fee == deposited_amount`.
6. The platform fee is rounded down and applies only to the worker gross share.
7. A full refund charges no platform fee.
8. Token-account ownership and mint are constrained on every transfer.
9. Settlement closes the empty token vault and retains the escrow state as an
   on-chain audit record.
10. Pausing cannot trap existing deposits.

## Explicit non-goals and remaining risk

- The program does not decide whether off-chain work is satisfactory. Dispute
  evidence and decisions remain an operational process.
- The program has not received an independent audit, fuzz campaign, or formal
  verification. It must remain Devnet-only until those gates pass.
- Program upgrade authority, dispute authority, and deployment credentials are
  critical trust surfaces and require multisig custody before mainnet.
- The web application must reconcile Firestore state from confirmed program
  accounts and transaction signatures; Firestore is not the source of truth for
  escrow balances.
