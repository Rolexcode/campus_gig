# Attachment security runbook

CampusGig treats every chat attachment as untrusted. Browser clients never read
Firebase Storage directly; every upload and download passes through an
authenticated server route that verifies conversation membership.

## Production scanner contract

Set these server-only environment variables:

```text
CHAT_ATTACHMENT_SCANNER_URL=https://YOUR_PRIVATE_SCANNER/scan
CHAT_ATTACHMENT_SCANNER_TOKEN=AT_LEAST_32_RANDOM_CHARACTERS
CRON_SECRET=AN_INDEPENDENT_HIGH_ENTROPY_SECRET
CHAT_ATTACHMENT_QUARANTINE_TTL_HOURS=24
```

The scanner URL must use HTTPS and must not contain URL credentials or a
fragment. CampusGig sends `multipart/form-data` containing:

- `file`: the original bytes and verified allowlisted MIME type;
- `sha256`: the hexadecimal SHA-256 digest;
- `X-CampusGig-Content-SHA256`: the same digest;
- `Authorization: Bearer <CHAT_ATTACHMENT_SCANNER_TOKEN>`.

The scanner must return HTTP 2xx and JSON:

```json
{
  "verdict": "clean",
  "engine": "managed-av-provider",
  "scanId": "provider-trace-id",
  "sha256": "required-matching-digest"
}
```

`malicious`, `infected`, and `suspicious` verdicts are rejected. Missing,
unknown, malformed, timed-out, or digest-mismatched results fail closed. Do not
configure an endpoint that merely echoes `clean`; use a managed malware scanner
with current signatures, auditable scan identifiers, availability monitoring,
and a data-processing agreement suitable for user files.

## Object lifecycle

1. The upload is written under `chatAttachmentQuarantine/` as
   `application/octet-stream` and marked `scanStatus=pending`.
2. Only a clean result creates a second private object under
   `chatAttachments/` with the original allowlisted MIME type and scan metadata.
3. The quarantined copy is deleted.
4. A message is created only after the clean object exists.
5. Downloads require both conversation membership and `scanStatus=clean` in the
   message record. Responses are forced to download and include `nosniff` and
   `no-store` controls.
6. The Vercel cron calls `/api/internal/maintenance/attachments` daily with
   `CRON_SECRET`; it deletes quarantine objects older than the configured TTL.

The Firebase Storage rules deny all browser reads and writes. Deploy them with:

```bash
firebase deploy --only storage
```

Cloud Storage requires the Firebase project to have an initialized Storage
bucket. New Firebase projects may require the Blaze billing plan before the
console exposes bucket creation. Do not enable attachment uploads until the
bucket exists, these deny-by-default rules have deployed successfully, and the
managed scanner and cleanup alerts are operational.

## Operations

- Alert on `attachment.quarantine_cleanup_failed`,
  `attachment.quarantine_cleanup_partial`, scanner 5xx rates, and sustained
  scanner latency above the 15-second application timeout.
- Rotate scanner and cron secrets independently. Never place either in a
  `NEXT_PUBLIC_` variable.
- Keep scanner retention to the minimum required by the vendor and documented
  privacy policy.
- Suspend file uploads during a scanner incident; text chat and HTTPS links
  remain available automatically because uploads fail closed.
- Test the malicious path with the EICAR test marker only in an isolated test
  environment. Never upload real malware to CampusGig.

This pipeline reduces attachment risk; it does not make arbitrary files risk
free. Keep the MIME allowlist narrow, preserve the 4 MB limit, and investigate
participant abuse reports before expanding supported file types.
