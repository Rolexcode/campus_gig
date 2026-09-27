# CampusGig incident-response runbook

This runbook covers the CampusGig beta and must be rehearsed before real-money
production use. It does not replace provider, legal, or regulatory obligations.

## Severity and ownership

| Severity | Example | Initial response target |
| --- | --- | --- |
| SEV-1 | Suspected wallet-key exposure, unauthorised settlement, material data disclosure, or active account takeover | Immediately; payments paused first |
| SEV-2 | Payment/provider outage, widespread login failure, webhook backlog, or incorrect contract state | 15 minutes |
| SEV-3 | Degraded feature, isolated failed job, or non-critical integration issue | Same business day |

The incident commander owns decisions and timeline. A separate operations lead
handles provider coordination, and a communications lead prepares user updates.
Do not let one person approve and execute irreversible fund recovery.

## First 15 minutes

1. Record the UTC start time, reporter, affected environment, release SHA, and
   a short factual summary in the incident log.
2. If money, signing, or payment integrity may be affected, set
   `PAYMENTS_PAUSED=true` in Production and redeploy. Confirm funding and release
   endpoints reject mutations; do not assume the environment change worked.
3. Preserve evidence. Export relevant Vercel runtime logs and provider event IDs.
   Never paste tokens, wallet secrets, passwords, identity documents, or raw
   service-account JSON into the incident log or chat.
4. Establish scope using correlation IDs, gig IDs, transaction signatures, and
   provider references. Use pseudonymous identifiers in shared communications.
5. Assign severity and owners. Create a timestamped decision log.

## Triage checks

- Public liveness: `GET /api/health`.
- Token-protected dependency readiness: `GET /api/health?deep=1` with
  `Authorization: Bearer $HEALTH_CHECK_TOKEN`.
- Deployment/runtime errors: Vercel Logs filtered by release SHA and
  `x-request-id`.
- Firebase: authentication error rate, Firestore availability, security-rule
  changes, privileged service-account activity, and unusual admin sessions.
- Solana: expected cluster, program ID, escrow/vault address, token mint,
  transaction finality, and on-chain balances. Never retry a transfer without
  first reconciling its signature and idempotency record.
- Flutterwave: webhook delivery, provider transaction verification, reference,
  currency, amount, and settlement state. A webhook alone is not proof of funds.

## Containment playbooks

### Suspected signing-key or wallet compromise

1. Pause all payments.
2. Disable the affected signer or service account; rotate credentials through
   the provider dashboard and Vercel secrets, never through source control.
3. Reconcile every affected wallet and transaction from independent chain data.
4. Preserve encrypted-key records and access logs for investigation.
5. Do not resume until dual approval confirms new authorities, balances, and
   a successful isolated test transaction.

### Flutterwave or webhook incident

1. Keep local settlement mutations paused if verification integrity is unclear.
2. Re-query Flutterwave by transaction ID and reference; compare successful
   status, currency, and exact amount.
3. Quarantine mismatched, duplicated, delayed, overpaid, or underpaid records
   for manual reconciliation. Never mark them funded from webhook payload alone.
4. Coordinate refunds or payouts only through an approved, auditable procedure.

### Firebase or identity incident

1. Revoke affected refresh tokens and administrator sessions.
2. Rotate service-account credentials if privileged access may be exposed.
3. Review admin-email configuration and recent verification decisions.
4. Restore only from a known-good backup after preserving the compromised state
   for investigation.

## Communication

State what happened, what is affected, what users should do, and when the next
update will arrive. Do not speculate or expose another user’s information.
Security notices must be reviewed by incident, legal/privacy, and communications
owners before publication unless immediate safety guidance is required.

## Recovery and closure

1. Reconcile application state against Firebase, the payment provider, and the
   blockchain before unpausing payments.
2. Run unit, production-build, public Playwright, authenticated-emulator, and
   payment-specific regression gates against the recovery release.
3. Resume payments gradually and monitor structured errors, latency, webhook
   delivery, and settlement mismatches.
4. Publish a blameless post-incident review within five business days, with
   root cause, impact, detection gap, timeline, corrective actions, owners, and
   due dates.

## Required production setup

- Store `HEALTH_CHECK_TOKEN` and payment/security credentials only in encrypted
  environment storage. Rotate them on a documented schedule.
- Enable Vercel Web Analytics and Speed Insights dashboards.
- Configure error alerts for HTTP 5xx, payment failures, readiness failures,
  webhook verification failures, and latency regressions.
- Forward logs/traces to an approved retention-controlled system when the Vercel
  plan supports Drains, or establish a documented dashboard/CLI review rota.
- Maintain an on-call roster, escalation contacts, provider support paths,
  backup/restore procedure, and a quarterly incident exercise.
