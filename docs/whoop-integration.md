# WHOOP Integration

## Status

WHOOP is now planned as a pre-release Pro integration. Batch 2 completes the
backend authorization-code flow with mocked-test coverage. It does not sync
WHOOP recovery data, expose new mobile actions, or change daily-plan behavior.

Garmin remains post-release.

## Architecture

The WHOOP foundation lives under:

- `apps/api/src/modules/health/whoop`
- `WhoopOAuthCredential` in Prisma
- `WhoopOAuthState` in Prisma

`WhoopModule` is imported by the existing `HealthModule`. The rest of the health
stack remains provider-neutral through `HealthConnection`,
`WearableDailySnapshot`, wearable source priority, and planning context
resolvers.

The WHOOP services are:

- `WhoopOAuthService`: builds an authorization URL and consumes OAuth state.
- `WhoopOAuthStateService`: creates cryptographically random, short-lived,
  single-use OAuth state.
- `WhoopOAuthClientService`: exchanges authorization codes and revokes provider
  access through backend-only requests.
- `WhoopTokenEncryptionService`: encrypts provider tokens with AES-256-GCM.
- `WhoopCredentialStoreService`: stores and retrieves encrypted credentials for
  backend-only use.
- `WhoopConnectionService`: enforces entitlements and coordinates connection,
  status, callback completion, and disconnect behavior.

The public generic health endpoint still cannot mark WHOOP as connected. Only a
successful server-side WHOOP callback can create a connected state.

## Backend Endpoints

- `POST /v1/whoop/connect`: authenticated and Pro-only; returns a short-lived
  WHOOP authorization URL.
- `GET /v1/whoop/callback`: validates and consumes OAuth state, exchanges the
  authorization code server-side, verifies scopes, encrypts tokens, and marks
  the connection connected.
- `GET /v1/whoop/status`: authenticated and available to every tier for
  connection and upgrade UX; never returns credentials.
- `POST /v1/whoop/disconnect`: authenticated and available after downgrade;
  attempts provider revocation, always deletes local credentials, and stops
  local sync eligibility.

The callback currently returns a backend JSON result. Mobile browser/deep-link
completion remains a later batch.

## Security Rules

- OAuth state plaintext is returned only for the authorization redirect.
- The database stores only a SHA-256 state hash.
- Generated state is exactly eight characters to match the WHOOP contract.
- State expires after 10 minutes by default.
- State consumption is single-use and race-safe through a conditional update.
- Access and refresh tokens are encrypted before Prisma receives them.
- Token ciphertext uses AES-256-GCM with a random IV and authentication tag.
- API keys, client secrets, tokens, OAuth state, raw WHOOP responses, and raw
  health samples must never be logged.
- WHOOP credentials and state rows are deleted when the owning user is deleted.
- The public health connection endpoint continues rejecting client attempts to
  set WHOOP to `CONNECTED`.
- Token responses are schema-validated and all requested scopes must be present.
- Incomplete grants are revoked when possible and are never persisted.
- Credential storage and the connected status update occur in one database
  transaction.
- Reusing, racing, or replaying callback state is rejected.

Generate a local encryption key with a cryptographically secure tool and store it
only in the backend secret manager. It must decode to exactly 32 bytes. Never
commit the generated value.

## Environment

WHOOP is disabled by default:

```dotenv
WHOOP_INTEGRATION_ENABLED=false
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=
WHOOP_TOKEN_ENCRYPTION_KEY=
WHOOP_OAUTH_AUTH_URL=https://api.prod.whoop.com/oauth/oauth2/auth
WHOOP_OAUTH_TOKEN_URL=https://api.prod.whoop.com/oauth/oauth2/token
WHOOP_API_BASE_URL=https://api.prod.whoop.com/developer
WHOOP_OAUTH_STATE_TTL_SECONDS=600
WHOOP_REQUEST_TIMEOUT_MS=15000
```

When disabled, the API starts without WHOOP credentials. When enabled,
`WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REDIRECT_URI`, and a
base64-encoded 32-byte `WHOOP_TOKEN_ENCRYPTION_KEY` are required. Invalid or
partial enabled configuration fails during application startup.

Local HTTP redirect URIs are accepted only for `localhost` or `127.0.0.1`.
Non-local redirect URIs must use HTTPS.

## Provider Scopes

The planned least-privilege authorization request includes:

- `offline`
- `read:recovery`
- `read:cycles`
- `read:workout`
- `read:sleep`

No write scopes are requested.

## Entitlements

WHOOP remains Pro-only through the existing `FeatureAccessService.canUseWhoop`
contract. Authorization and callback completion enforce Pro. Status remains
readable for upgrade and disconnected-state UX. Disconnect deliberately remains
available after downgrade so users can always remove access.

Safety is never paywalled. Users without WHOOP, users who disconnect it, and users
whose WHOOP data is unavailable must still receive a safe plan from existing
profile, schedule, check-in, and Apple Health context.

## Next Batches

### Batch 3: Foreground sync

- Add authenticated manual sync.
- Refresh expired access tokens server-side.
- Read WHOOP recovery, cycle/strain, sleep, and workout data.
- Normalize provider data into backend-owned daily signals and
  `WearableDailySnapshot`.
- Treat missing individual metrics as `null`.
- Never block plan generation when WHOOP is unavailable.

### Batch 4: Planning integration and release QA

- Feed only validated normalized signals into recovery and planning boundaries.
- Keep deterministic safety authoritative.
- Add conservative recovery-aware behavior without medical diagnosis.
- Complete disconnect/delete privacy QA.
- Complete WHOOP developer app approval and physical-account smoke tests.

Background sync, webhooks, long-term recovery trends, continuous monitoring, and
Garmin are not part of the initial release integration.

Provider references:

- [WHOOP OAuth 2.0](https://developer.whoop.com/docs/developing/oauth/)
- [WHOOP API](https://developer.whoop.com/api/)
