# WHOOP Integration

## Status

WHOOP is a staged pre-release Pro integration. Batch 4 completes the bounded
application path: explicit foreground sync, refresh-token rotation, normalized
wearable snapshots, mobile Connect/Sync/Disconnect actions, and conservative
planning rules for a fresh scored Recovery. It does not add background sync,
webhooks, continuous monitoring, or raw provider data storage.

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
  access through backend-only requests, and rotates expired token pairs.
- `WhoopAccessTokenService`: serializes refresh for each user so concurrent
  foreground requests do not race a rotating refresh token.
- `WhoopApiClientService`: reads schema-validated cycle, recovery, sleep, and
  workout collections.
- `WhoopSyncService`: normalizes provider records into the existing
  `WearableDailySnapshot` contract and persists one snapshot for the user's
  current local date.
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
- `POST /v1/whoop/sync`: authenticated and Pro-only; refreshes credentials when
  needed, reads WHOOP data, and returns a provider-neutral normalized snapshot.

The callback returns a backend result in the system browser. When the user
returns to OptiMe, the Health Data screen refreshes connection state.

## Foreground Sync

Sync is user initiated. It reads a bounded 48-hour window and makes four
independent requests: cycles, recovery, sleep, and workouts. One failed dataset
does not discard valid datasets. The response marks the sync as partial and
unavailable metrics stay `null`. If every dataset request fails, no snapshot is
saved and the connection records a safe error code.

OptiMe does not invent WHOOP values:

- `steps` remains `null` because this integration does not read a WHOOP step
  endpoint;
- active calories are derived only from energy attached to today's WHOOP
  workout records, using `kilojoules / 4.184`;
- an empty workout collection does not imply a fabricated zero;
- malformed, non-finite, or out-of-range values are rejected or bounded before
  persistence;
- raw WHOOP samples and raw JSON responses are never stored.

The resulting `WearableDailySnapshot` automatically participates in the
existing provider-neutral wearable source priority. Daily Plan generation still
works when WHOOP has no data or is unavailable.

Recovery normalization is deliberately strict:

- a Recovery must have `score_state=SCORED`;
- data from a user who is still calibrating is not used for recovery planning;
- Recovery must belong to the selected physiological cycle;
- pending, unscorable, mismatched-cycle, stale, or missing Recovery stays
  neutral.

## Conservative Planning

OptiMe treats a fresh WHOOP Recovery score from `0` through `33` as a
deterministic `LOW_RECOVERY` signal. It may select recovery-aware protocols,
reduce the workout exercise range and sets, and increase rest time. It never
uses a higher Recovery score to exceed the user's schedule, deterministic
volume plan, exercise catalog, or safety limits.

The rule does not diagnose fatigue, illness, overtraining, or any medical
condition. Missing data is neutral. Exact Recovery, HRV, resting-heart-rate,
respiratory-rate, and Strain values are not written to Daily Plan debug metadata
or user-facing copy. Deterministic `SafetyService` remains authoritative.

## Security Rules

- OAuth state plaintext is returned only for the authorization redirect.
- The database stores only a SHA-256 state hash.
- Generated state is exactly eight characters to match the WHOOP contract.
- State expires after 10 minutes by default.
- State consumption is single-use and race-safe through a conditional update.
- Access and refresh tokens are encrypted before Prisma receives them.
- A refresh replaces both tokens because WHOOP rotates access and refresh
  tokens together.
- Refreshes are coalesced per user within one API process to avoid local races.
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
contract. Authorization, callback completion, and foreground sync enforce Pro.
Status remains readable for upgrade and disconnected-state UX. Disconnect and
deleting imported WHOOP snapshots deliberately remain available after downgrade
so users can always remove access and stored summaries.

Safety is never paywalled. Users without WHOOP, users who disconnect it, and users
whose WHOOP data is unavailable must still receive a safe plan from existing
profile, schedule, check-in, and Apple Health context.

## Release Gate

The automated Batch 4 planning path is complete. Before release, complete the
external checklist in `docs/whoop-release-qa.md`, including WHOOP developer app
approval and physical-account testing. A production multi-instance refresh lock
must be implemented before horizontally scaling WHOOP sync; the current
per-user refresh coalescing protects one API process only.

Background sync, webhooks, long-term recovery trends, continuous monitoring, and
Garmin are not part of the initial release integration.

Provider references:

- [WHOOP OAuth 2.0](https://developer.whoop.com/docs/developing/oauth/)
- [WHOOP API](https://developer.whoop.com/api/)
