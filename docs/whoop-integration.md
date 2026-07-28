# WHOOP Integration

## Status

WHOOP is now planned as a pre-release Pro integration. Batch 1 adds the secure
backend OAuth foundation only. It does not call WHOOP, exchange authorization
codes, sync health data, expose new mobile actions, or change daily-plan behavior.

Garmin remains post-release.

## Batch 1 Architecture

The WHOOP foundation lives under:

- `apps/api/src/modules/health/whoop`
- `WhoopOAuthCredential` in Prisma
- `WhoopOAuthState` in Prisma

`WhoopModule` is imported by the existing `HealthModule`. The rest of the health
stack remains provider-neutral through `HealthConnection`,
`WearableDailySnapshot`, wearable source priority, and planning context
resolvers.

The Batch 1 services are:

- `WhoopOAuthService`: builds a WHOOP authorization URL only.
- `WhoopOAuthStateService`: creates cryptographically random, short-lived,
  single-use OAuth state.
- `WhoopTokenEncryptionService`: encrypts provider tokens with AES-256-GCM.
- `WhoopCredentialStoreService`: stores and retrieves encrypted credentials for
  backend-only use.

No controller endpoint invokes these services yet. The public client still
cannot mark WHOOP as connected.

## Security Rules

- OAuth state plaintext is returned only for the authorization redirect.
- The database stores only a SHA-256 state hash.
- State expires after 10 minutes by default.
- State consumption is single-use and race-safe through a conditional update.
- Access and refresh tokens are encrypted before Prisma receives them.
- Token ciphertext uses AES-256-GCM with a random IV and authentication tag.
- API keys, client secrets, tokens, OAuth state, raw WHOOP responses, and raw
  health samples must never be logged.
- WHOOP credentials and state rows are deleted when the owning user is deleted.
- The public health connection endpoint continues rejecting client attempts to
  set WHOOP to `CONNECTED`.

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
contract. Batch 2 endpoints must enforce that entitlement on authorization,
callback completion, sync, and reconnect operations. Status may remain readable
for upgrade and disconnected-state UX.

Safety is never paywalled. Users without WHOOP, users who disconnect it, and users
whose WHOOP data is unavailable must still receive a safe plan from existing
profile, schedule, check-in, and Apple Health context.

## Next Batches

### Batch 2: OAuth completion

- Add Pro-gated authorization endpoint.
- Add backend callback endpoint.
- Exchange authorization code server-side.
- Verify granted scopes.
- Store encrypted access and refresh tokens.
- Create/update `HealthConnection` only after successful provider authorization.
- Add disconnect, token deletion, and provider revocation behavior.
- Keep secrets and raw responses out of logs.

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
