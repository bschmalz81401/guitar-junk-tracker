# Guitar Junk Tracker — security notes

Threat model: **home-lab / LAN self-host**, optional reverse proxy with TLS.
Not hardened as a multi-tenant public SaaS.

## Session cookies

| Flag | Value | Why |
|------|--------|-----|
| Name | `gt_session` | HMAC session token (`userId.expires.sessionVersion.sig`) |
| `httpOnly` | true | Not readable from JavaScript |
| `sameSite` | `lax` | Browser omits cookie on most cross-site POSTs (CSRF mitigation) |
| `path` | `/` | Whole app |
| `secure` | when `COOKIE_SECURE=1` | Set behind HTTPS only |
| Max age | 30 days | Sliding only by re-login (token has absolute expiry) |

Logout clears the cookie with the **same** path/secure attributes.

**Session audit:** Tokens are signed with `AppSettings.sessionSecret`
(generated on first run). Verification uses `timingSafeEqual`. Expired tokens
are rejected. Each user has a `sessionVersion`; password reset, profile
password change, and admin-set passwords increment it, so previously issued
cookies stop verifying. A three-part legacy cookie (`userId.expires.sig`) is
still accepted as version `0` so existing sessions survive this deploy. After
a password change the current cookie is cleared; sign in again to get a new
token.

## CSRF

Primary control: **`SameSite=Lax` session cookie**.

Additional control on auth POSTs: if the browser sends `Origin`, it must match
the request `Host` (`rejectCrossOrigin`). Missing `Origin` is allowed (non-browser
clients / some same-site cases).

State-changing APIs (`/api/items`, profile, admin) still rely on the cookie
not being sent cross-site under Lax. Do not set `SameSite=None` without a
deliberate design review.

## Rate limits (auth)

In-memory fixed windows (per Node process — one Docker replica):

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login (per IP) | 20 | 15 min |
| Login (per email) | 10 | 15 min |
| Signup (per IP) | 10 | 1 hour |
| Forgot password (per IP) | 8 | 15 min |
| Reset password (per IP) | 15 | 15 min |

Responses: HTTP **429** + `Retry-After`. Limits reset on process restart.

Behind a reverse proxy, ensure `X-Forwarded-For` is set by a trusted hop only.

## Passwords

- scrypt with random salt (`saltHex:hashHex`)
- Minimum length 8 on signup/reset
- Failed login returns a **generic** error (no email enumeration)
- Forgot-password claims generic success only when SMTP **and**
  `APP_PUBLIC_ORIGIN` are valid. Otherwise it returns HTTP 503 (no email
  enumeration). Reset-email links are built from `APP_PUBLIC_ORIGIN` only.
  Incoming `X-Forwarded-Host` / `X-Forwarded-Proto` headers cannot change the
  link.

## Response headers

Set in `next.config.ts` for all routes:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

HSTS should be configured on the **reverse proxy** when you terminate TLS, not
in the app by default (LAN HTTP is common).

## Outbound fetches (product lookup and image URL import)

The server fetches remote URLs only through `safeFetch`. Each hop:

1. Allows `http`/`https` only.
2. Resolves the hostname (IP literals are checked as-is).
3. Rejects the destination if **any** record is loopback, private, link-local,
   multicast, CGNAT, IPv6 unique-local, or an IPv4-mapped/NAT64/6to4 equivalent.
4. Connects to a resolved address that already passed that check (the TCP
   connection is not allowed to re-resolve the name).
5. Follows redirects manually and repeats the same policy on the next URL.

A hostname that merely *looks* public but resolves internally is rejected.
`localhost` / `*.local` names are blocked without DNS.

## Account deletion and photo files

Deleting a user is a database transaction: owned photo **filenames** are copied
into `PhotoCleanupJob` first, then the user row is removed (items/photos
cascade). Files under `PHOTOS_DIR` are unlinked after commit. Missing files
count as success. Failures stay in the job table, retry on process start, and
can be retried from Admin → Photo cleanup. Cleanup never follows `..` or
absolute paths, and it will not unlink a filename still referenced by another
photo.

## Production checklist

1. Choose a strong admin password in the first-run setup wizard.
2. Serve over HTTPS and set `COOKIE_SECURE=1`. Set `APP_PUBLIC_ORIGIN` to that
   HTTPS origin so password-reset emails point at your real URL.
3. Do not port-forward to the public internet without TLS and a threat model.
4. Keep catalogs private by default; review public catalog + price/serial flags.
5. Back up `./data` regularly (`scripts/backup.sh`).
6. Keep your Docker host and OS updated.

## Out of scope (later)

- Distributed rate limits (Redis) for multi-replica
- Distributed session store (per-user `sessionVersion` covers password-change logout)
- Full CSRF tokens for every mutating API
- CAPTCHA on login/signup
