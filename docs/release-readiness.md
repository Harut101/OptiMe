# Release readiness

This checklist protects the accepted OptiMe product baseline. It does not add product features.

## Implemented safeguards

- Production environment validation rejects placeholder JWT/auth-code secrets.
- JWT and auth-code secrets must be different and at least 32 characters.
- Production email delivery must use Resend; development auth codes are forbidden.
- Registration requires explicit Privacy Policy and Terms consent; onboarding never silently
  accepts it for a legacy account.
- Mobile exposes public Privacy Policy and Terms links during consent and in Profile.
- Browser CORS uses an explicit production allowlist.
- Trusted proxy hops are explicit so request IP handling is deliberate.
- Public auth routes have in-process IP and identity rate limits.
- Email verification codes are short-lived, single-use, attempt-limited HMAC digests.
- Password reset invalidates previously issued JWTs.
- Account deletion requires password re-entry and removes user-owned local data through
  database cascades.
- WHOOP provider revocation is attempted before local account deletion.
- Security logs avoid email addresses, passwords, auth codes, API keys, and raw tokens.

## Production environment checklist

Set unique production values:

```env
NODE_ENV=production
DATABASE_URL=...
JWT_SECRET=...
AUTH_CODE_SECRET=...
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
EMAIL_FROM=...
SUPPORT_EMAIL=...
EMAIL_REPLY_TO=...
EMAIL_REQUEST_TIMEOUT_MS=10000
CORS_ALLOWED_ORIGINS=https://approved-origin.example
TRUST_PROXY_HOPS=1
AUTH_RATE_LIMIT_ENABLED=true
```

Mobile release configuration also requires:

```env
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://...
EXPO_PUBLIC_TERMS_OF_SERVICE_URL=https://...
EXPO_PUBLIC_SUPPORT_EMAIL=support@example.com
```

Do not copy placeholder secrets from `.env.example`. Do not define `AUTH_DEV_CODE`.

## Manual QA

1. Register with a real inbox and verify the six-digit email code.
2. Confirm an unverified account cannot log in.
3. Request a password reset and verify that old JWTs stop working afterward.
4. Confirm repeated public auth attempts receive a friendly `429` and `Retry-After`.
5. Open Profile, Privacy and account, and try deletion with a wrong password.
6. Delete a disposable account with the correct password.
7. Confirm the mobile session is cleared and the deleted account cannot log in.
8. Confirm user-owned rows are gone and unrelated users remain intact.
9. If WHOOP was connected, confirm provider revocation was attempted without logging tokens.
10. Verify allowed web origins work and an unapproved browser origin receives no CORS access.
11. Verify registration cannot continue until consent is checked and both legal links open.
12. Verify Resend text/HTML delivery in English, Russian, French, and Simplified Chinese.
13. Confirm a temporary provider failure does not start a resend cooldown.

## Remaining external gates

- Verify the Resend sender domain, SPF/DKIM, and delivery for all supported locales.
- Confirm the reverse-proxy topology and matching `TRUST_PROXY_HOPS`.
- Add edge/shared-store rate limiting before running multiple API instances.
- Decide whether first release needs self-service data export or a documented support workflow.
- Complete Android Health Connect device QA and Google Play Health declarations.
- Complete release builds, store privacy declarations, localization QA, and physical-device
  regression.
- Replace placeholders in the Privacy Policy and Terms drafts, obtain legal review, publish
  stable HTTPS documents, and complete `docs/store-privacy-declarations.md`.
