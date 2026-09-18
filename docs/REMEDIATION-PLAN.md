# Security and reliability remediation plan

## Purpose and status

This document preserves the remediation plan from the independent review of
`main` at `638d550` (2026-08-12).

Implementation status:

- Phase 1 (reset-link integrity): done in `a98901f` (PR #1)
- Phase 2 (safe outbound URL fetching): done in `14b0f73` (PR #2)
- Phase 3 (durable account-deletion file cleanup): done in `2fc057f` (PR #3)
- Phase 4 (session revocation on password changes): done in `59c904c` (PR #4)
- Phase 5 (upload policy): in progress on `fix/upload-policy`
- Phase 6: not started

The review ran against the current codebase with `npm run gate` passing (lint,
unit suites, and production build). The build currently emits warnings about
Next.js middleware deprecation and broad filesystem tracing.

## Review findings

### Blocker: password-reset links trust proxy headers

`src/lib/passwordReset.ts` uses `X-Forwarded-Host` and
`X-Forwarded-Proto` to build reset URLs, and
`src/app/api/auth/forgot-password/route.ts` passes the request through. An
attacker can supply an attacker-controlled host, causing an email to contain a
reset token in a link to that host.

### Should fix: outbound-fetch SSRF policy is incomplete

`src/lib/safeFetch.ts` checks the spelling of a URL but does not validate the
address to which its hostname resolves. Product lookup and image import can
therefore reach private destinations through a hostname or DNS rebinding; the
current filtering also misses some non-public address formats.

### Should fix: deleting a user leaves photo files on disk

`src/app/api/admin/users/[id]/route.ts` relies on database cascades. Those
remove `Photo` records, but cannot delete their corresponding files from
`PHOTOS_DIR`.

### Should fix: password changes do not invalidate active sessions

The reset and profile routes replace the password hash without revoking the
existing signed sessions. Existing sessions can remain usable until expiration.

### Should fix: direct uploads lack bounded validation

`src/app/api/items/[id]/photos/route.ts` and `src/lib/storage.ts` accept and
persist arbitrary file data without an allowlisted signature, per-file size,
count, or request-size policy.

### Maintenance and product decisions

- Next.js warns that `src/middleware.ts` uses its deprecated middleware
  convention; migrate to `proxy`.
- The production build warns that filesystem use in `src/lib/storage.ts` causes
  broad tracing. Narrow the access pattern before it impacts deployment size or
  reliability.
- The landing page can show category counts for the configured showcase user
  even if the catalog is private. Confirm whether that metadata disclosure is
  intentional and encode the decision in a test.

## Phase 1: reset-link integrity

### Scope

- Add one canonical public-application-origin configuration value.
- Build reset URLs from that configured value only; do not derive them from
  request forwarding headers.
- Document the value in `.env.example`, Docker configuration, and the README.
- Add route-level coverage for malicious forwarded host/protocol headers.

### Acceptance criteria

- A password-reset email always points to the configured public origin.
- Forwarded host/protocol headers cannot alter the reset link.
- Local development and Docker deployment have documented configuration paths.

### Validation and rollback

Run the affected tests and `npm run gate`. Roll back the phase by restoring the
previous application version; this phase has no data migration.

## Phase 2: safe outbound URL fetching

### Scope

- Route all remote image and product-lookup requests through one outbound-fetch
  policy.
- Validate each resolved target immediately before connecting. Reject loopback,
  private, link-local, multicast, carrier-grade NAT, IPv6 local/unique-local,
  and IPv4-mapped equivalents.
- Handle redirects manually and apply the same policy to every target.
- Add deterministic resolver/fetch tests for prohibited ranges, private DNS
  resolution, and redirect chains.

### Acceptance criteria

- Permitted public product and image URLs continue to work.
- No outbound request reaches an internal or locally resolved destination.
- Redirects cannot bypass the policy.

### Validation and rollback

Run targeted fetch-policy tests and `npm run gate`. Roll back by restoring the
previous version if legitimate provider URLs are unexpectedly rejected; retain
test cases for the rejected provider while refining the narrowly scoped policy.

## Phase 3: durable account-deletion file cleanup

### Scope

- Add durable file-deletion work records.
- In the transaction that deletes a user, retain the owned photo paths as
  cleanup work before cascading the photo records away.
- Delete files after commit, retry failures on startup, and provide an
  administrator-safe retry path.
- Test success, idempotent repeat cleanup, and simulated filesystem failure.

### Acceptance criteria

- Deleting a user eventually removes all their uploaded files.
- A process/filesystem failure does not corrupt the database transaction.
- Failed cleanup can be retried without deleting unrelated files.

### Validation and rollback

Run migration and storage-cleanup tests plus `npm run gate`. Keep cleanup work
records during rollback so a restored application version does not lose the
list of orphaned files.

## Phase 4: session revocation on password changes

### Scope

- Add per-user session-version or revocation state to the schema and signed
  session payload.
- Reject a token whose embedded value no longer matches its user record.
- Increment the value for password reset, profile password change, and any
  administrator-initiated password change.
- Add migration and route tests for valid sessions, revoked sessions, reset,
  re-login, and all password-change paths.

### Acceptance criteria

- All issued sessions become invalid immediately after a password change.
- A user can authenticate normally after re-login.
- Existing session behavior remains unchanged when no revocation occurred.

### Validation and rollback

Run migration/auth tests and `npm run gate`. Rollback may require temporarily
accepting the prior token shape; this must be tested before deployment so users
are not locked out.

## Phase 5: upload policy

### Scope

- Set configurable limits for image formats, file size, photo count per item,
  and request body size.
- Validate file signatures against an image allowlist; do not trust filenames
  or declared MIME types.
- Normalize server-side file names/extensions and reject excess inputs before
  writing them to persistent storage.
- Test valid images, spoofed files, oversized inputs, quota boundaries, and
  cleanup of rejected uploads.

### Required decision before implementation

Recorded policy (home-lab catalog, not a public CDN):

- Formats: JPEG, PNG, WebP, GIF (magic bytes only; HEIC is not accepted)
- Max file size: 10 MiB
- Max photos per item: 20
- Max request: 10 MiB + 256 KiB multipart overhead

### Acceptance criteria

- Only allowed, bounded image uploads are persisted.
- Rejected uploads leave no partial file behind.
- An authenticated user cannot fill the persistent volume through one item or
  one request.

### Validation and rollback

Run upload tests and `npm run gate`. Rollback is application-only; already
uploaded, valid files remain unaffected.

## Phase 6: maintenance decisions

### Scope

- Migrate `src/middleware.ts` to the current Next.js `proxy` convention.
- Narrow the storage filesystem access that causes broad build tracing.
- Decide whether private showcase catalog counts may be exposed and enforce the
  selected policy with a test.

### Acceptance criteria

- The production build has no middleware-deprecation or storage-tracing
  warning.
- Showcase metadata behavior matches the recorded product decision.

### Validation and rollback

Run `npm run build`, targeted route tests, and `npm run gate`. Revert these
independently if a framework upgrade compatibility problem appears.

## Delivery gates

Implement one phase per reviewable branch/PR. For every phase:

1. Define/update targeted tests before or alongside the change.
2. Run the phase-specific checks, migration checks where applicable, and
   `npm run gate`.
3. Obtain a new independent read-only review of the patch.
4. Merge only after the local gate and independent review are both green.

The first implementation priority is Phase 1 because it eliminates the
password-reset account-takeover path.
