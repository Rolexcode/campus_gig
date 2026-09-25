# CampusGig escrow program

Anchor 1.1.2 program for one PDA-controlled USDC vault per accepted gig.

Instructions:

- `initialize_config`
- `set_pause`
- `propose_admin` / `accept_admin`
- `update_operational_authorities`
- `fund_escrow`
- `release`
- `open_dispute`
- `mutual_refund`
- `resolve_dispute`
- `resume_dispute`

The program ID in this repository is the public half of the ignored Devnet
program keypair at `.secrets/campus_gig_escrow-devnet.json`. Never commit that
keypair or a deployer wallet.

Run host-side math and serialization tests:

```bash
cargo test -p campus-gig-escrow
```

A true SBF build and Devnet integration test require the pinned Solana CLI
3.1.10 and Anchor CLI 1.1.2 toolchain from `Anchor.toml`.

The transaction fee/rent payer is intentionally separate from the client. A
CampusGig gas sponsor creates the escrow and vault accounts and receives only
their reclaimed rent when the empty vault closes. The sponsor cannot transfer
vault USDC. This lets clients and workers use embedded wallets without holding
SOL for fees.

Do not set `SOLANA_SETTLEMENT_MODE=program` until the deployed program ID and
initialized config have been verified on the target cluster. The application
will reject program funding if the config account is absent, paused, points to
a different mint, or caps fees below the configured marketplace fee.
