# Authentication release security

## Current flow

- Registration creates an unverified account and sends a six-digit email code.
- The code expires after 10 minutes, is single-use, and is stored only as an HMAC-SHA256 digest.
- A user receives a full JWT only after email verification.
- Login rejects an unverified account with `EMAIL_NOT_VERIFIED`.
- Verification resend is limited to once per minute and five codes per hour.
- Password-reset requests return the same response for known and unknown email addresses.
- A successful password reset increments `User.authVersion`, invalidating earlier JWTs.

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
AUTH_CODE_SECRET=...
```

`AUTH_CODE_SECRET` and `JWT_SECRET` must be separate high-entropy secrets. Do not set `AUTH_DEV_CODE` in production. API keys, codes, password hashes, and complete email payloads must never be logged.

## API endpoints

- `POST /v1/auth/register`
- `POST /v1/auth/verify-email`
- `POST /v1/auth/resend-verification`
- `POST /v1/auth/login`
- `POST /v1/auth/request-password-reset`
- `POST /v1/auth/reset-password`

## Remaining release work

- Configure and verify the production email domain and sender identity in Resend.
- Add infrastructure-level IP rate limiting in front of public auth endpoints.
- Add account deletion password re-entry and audit-safe security event telemetry.
- Run deliverability QA for all supported locales before release.
