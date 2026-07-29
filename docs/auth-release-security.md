# Authentication release security

## Current flow

- Registration creates an unverified account and sends a six-digit email code.
- The code expires after 10 minutes, is single-use, and is stored only as an HMAC-SHA256 digest.
- A user receives a full JWT only after email verification.
- Login rejects an unverified account with `EMAIL_NOT_VERIFIED`.
- Verification resend is limited to once per minute and five codes per hour.
- Password-reset requests return the same response for known and unknown email addresses.
- A successful password reset increments `User.authVersion`, invalidating earlier JWTs.
- Public auth endpoints use bounded in-process IP and normalized-email rate limits.
- Auth rate-limit keys are SHA-256 digests and responses never expose an email address or IP.
- Authenticated account deletion requires the current password and cascades through local user data.
- WHOOP provider revocation is attempted before local account deletion. A provider outage is logged
  safely but cannot prevent deletion of the user's local OptiMe data.

Existing users are marked verified by the migration so an upgrade does not lock them out.

## Development

Development uses `EMAIL_PROVIDER=development` and does not call an external service. Set:

```env
AUTH_DEV_CODE=123456
AUTH_CODE_SECRET=use-a-local-secret-different-from-jwt
```

The development delivery adapter logs only the email purpose and expiry. It never logs the email address or code.

## Production

Production fails at startup unless:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
EMAIL_FROM=...
SUPPORT_EMAIL=...
EMAIL_REPLY_TO=...
EMAIL_REQUEST_TIMEOUT_MS=10000
AUTH_CODE_SECRET=...
CORS_ALLOWED_ORIGINS=https://your-approved-web-origin.example
TRUST_PROXY_HOPS=1
AUTH_RATE_LIMIT_ENABLED=true
```

`AUTH_CODE_SECRET` and `JWT_SECRET` must be separate high-entropy secrets. Do not set `AUTH_DEV_CODE` in production. API keys, codes, password hashes, and complete email payloads must never be logged.

Production startup also rejects placeholder/short secrets, a wildcard or missing CORS
allowlist, malformed proxy settings, a configured development auth code, a malformed
sender/reply-to mailbox, a missing support mailbox, an invalid Resend key shape, or an
email timeout outside 1-30 seconds.

Resend messages use localized, responsive text and HTML templates for verification and
password reset. They contain no tracking scripts. Provider failures are mapped to safe
reasons and never log recipients, codes, complete payloads, API keys, or raw responses.
If delivery fails, the newly created code is deleted so a user can retry immediately.

`TRUST_PROXY_HOPS` must match the actual number of trusted reverse proxies. A wrong value can
make IP-based protection ineffective. The in-process limiter is appropriate for the initial
single API instance; add an edge or shared-store limiter before horizontally scaling.

## API endpoints

- `POST /v1/auth/register`
- `POST /v1/auth/verify-email`
- `POST /v1/auth/resend-verification`
- `POST /v1/auth/login`
- `POST /v1/auth/request-password-reset`
- `POST /v1/auth/reset-password`
- `DELETE /v1/me/account` with `{ "currentPassword": "..." }`

## Account deletion

The Profile privacy sheet explains the scope, asks for the current password, and requires a
second destructive confirmation. A successful `204` response clears the local mobile session.
Prisma cascade relations remove profile, plans, check-ins, history, imported health summaries,
provider credentials, and other user-owned rows.

Account export is not implemented yet and remains a separate release decision.

## Remaining release work

- Configure and verify the production email domain and sender identity in Resend.
- Add infrastructure-level IP rate limiting before using more than one API process.
- Decide and document the support workflow for account-data export requests.
- Run deliverability QA for all supported locales before release.
- Verify the localized text and HTML templates in major light/dark email clients.
