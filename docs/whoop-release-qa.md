# WHOOP Release QA

## Automated Gate

The release candidate must pass:

- WHOOP OAuth, token rotation, API schema, sync, and planning unit tests;
- full API E2E in mock mode with no live WHOOP requests;
- API build, shared package builds, mobile typecheck, and mobile interaction
  contracts;
- secret scan and `git diff --check`.

## Developer App Gate

- WHOOP developer application is approved for the intended production use.
- Production callback URL uses HTTPS and exactly matches backend configuration.
- Only `offline`, `read:recovery`, `read:cycles`, `read:workout`, and
  `read:sleep` are requested.
- Production credentials and the 32-byte token-encryption key exist only in the
  backend secret manager.
- No provider token or raw WHOOP response appears in API, mobile, analytics, or
  crash logs.

## Physical Account Smoke Test

1. Use a Pro test account with a WHOOP account that has completed calibration.
2. Connect from the mobile Health Data screen and complete authorization in the
   system browser.
3. Return to OptiMe and confirm status becomes Connected without exposing
   credentials.
4. Run Sync and confirm recovery, sleep, cycle, and workout availability is
   reported safely.
5. Generate a plan with a fresh low Recovery and confirm the plan remains useful
   while training volume/intensity is reduced and rest is increased.
6. Confirm a moderate/high Recovery never raises load beyond the saved schedule
   and deterministic workout budget.
7. Confirm pending, unscorable, calibrating, stale, or missing Recovery remains
   neutral.
8. Revoke WHOOP authorization and confirm the next sync moves to Needs reauth.
9. Downgrade the test account and confirm new connect/sync is blocked while
   Disconnect and Delete synced data remain available.
10. Delete WHOOP data and confirm WHOOP snapshots are removed while unrelated
    provider snapshots remain.

## Release Blockers

Do not release WHOOP when:

- provider approval or physical-account QA is incomplete;
- callback, scope, token rotation, or revocation behavior differs from the
  documented flow;
- exact health metrics or credentials appear in user-facing copy or logs;
- unavailable data prevents Daily Plan generation;
- a Recovery signal can increase load beyond deterministic limits;
- the API is horizontally scaled without a distributed refresh lock.

Background sync, webhooks, long-term Recovery trends, continuous monitoring,
Garmin, and medical interpretation remain out of scope.
