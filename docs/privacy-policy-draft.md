# Privacy Policy draft

> Release draft. Replace every bracketed placeholder, confirm retention periods and
> subprocessors, obtain legal review, publish at a stable HTTPS URL, and set
> `EXPO_PUBLIC_PRIVACY_POLICY_URL` before store submission.

Effective date: `[DATE]`

Controller: `[LEGAL ENTITY AND ADDRESS]`

Privacy contact: `[PRIVACY EMAIL]`

## What OptiMe collects

- Account data: email address, verification status, locale, timezone, and security metadata.
- Profile and goal data: name, age/date of birth, gender, height, weight, activity level,
  pregnancy/postpartum context when voluntarily provided, goals, and app mode.
- Nutrition and training data: allergies, excluded/preferred foods, meal preferences,
  training preferences, schedules, equipment, limitations, generated plans, completion
  records, substitutions, check-ins, and feedback.
- Optional health and fitness summaries: daily activity, sleep, workouts, active energy,
  and supported recovery signals imported with permission from Apple Health, Health
  Connect, or WHOOP. OptiMe stores normalized daily summaries rather than complete raw
  sample streams.
- Operational data: plan tier, entitlements, feature usage counters, AI provider/model,
  latency, retry, safety-review, and fallback metadata. Prompts, complete profiles, API
  keys, tokens, and raw provider responses are not stored in `AiOperationLog`.
- Technical data needed for security and reliable operation, such as bounded request
  identifiers and rate-limit keys. Rate-limit identifiers are hashed.

OptiMe does not currently sell personal data, serve targeted advertising, or use health
data for advertising.

## Why OptiMe uses data

OptiMe uses data to create and safely adapt wellness plans, track user-selected progress,
operate account and subscription access, secure accounts, diagnose service failures, and
meet legal obligations. Safety-critical rules apply to every tier.

AI requests are made only from the backend. OptiMe minimizes the context sent to an AI
provider and does not send password hashes, authentication tokens, API keys, or unrelated
private fields.

## Permissions and connected services

Health connections are optional. Plan generation continues without them. Users choose
which system permissions to grant and can disconnect a source or delete imported health
summaries from OptiMe.

Current or planned processors and connected services include:

- OpenAI for structured plan generation and semantic safety review.
- Resend for verification and password-reset email delivery.
- Apple Health, Health Connect, and WHOOP when a user explicitly connects them.
- `[HOSTING PROVIDER]` and `[DATABASE PROVIDER]` for service operation.
- `[ERROR/DIAGNOSTIC PROVIDER, IF ANY]`.

Confirm each provider's production contract, data location, retention, and subprocessor
terms before release.

## Retention, deletion, and access

OptiMe retains account data while the account is active and for the documented periods
required for security, legal, and financial records: `[RETENTION SCHEDULE]`. Short-lived
verification/reset codes expire automatically and are stored only as keyed digests.

Users can delete imported health summaries independently. Permanent account deletion
requires password confirmation and removes the profile, plans, tracking history, provider
credentials, and other user-owned OptiMe data through database cascades, subject to
`[LEGAL RETENTION EXCEPTIONS]`.

Document the support workflow for access, correction, portability, and deletion requests
at `[SUPPORT URL OR EMAIL]`. Self-service export is not implemented in the current release.

## Safety, children, and sensitive contexts

OptiMe is a wellness assistant, not a medical service. It does not diagnose or treat
medical conditions. Under-18, pregnancy/postpartum, allergy, pain, illness, dizziness, and
other safety contexts receive conservative deterministic handling and are never paywalled.

The minimum permitted age, parental-consent process, and regions where minors may use the
service must be finalized before publication: `[AGE AND REGIONAL POLICY]`.

## Security and international transfers

OptiMe uses access controls, hashed passwords, short-lived verification codes, versioned
JWT invalidation, production configuration validation, rate limits, and restricted
operational logs. No system can guarantee absolute security.

If data crosses borders, identify the transfer mechanism and affected regions:
`[TRANSFER MECHANISM AND DATA LOCATIONS]`.

## Changes and contact

Material changes will be communicated as required by law. Questions and privacy requests
can be sent to `[PRIVACY EMAIL]`.
