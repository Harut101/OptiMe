# Health Privacy And Consent

Health data is sensitive. Sprint 7 must treat health integration as optional, explicit, revocable, and non-diagnostic.

## Core Rules

- Health data requires explicit user consent.
- Permissions should be granular by data type.
- Health data must not block daily plan generation.
- Store daily summaries first, not raw samples.
- Do not log raw health data.
- Do not use health data for medical diagnosis.
- Do not shame low activity, sleep issues, weight changes, or missed workouts.
- Safety remains equal across all tiers.

## Consent Requirements

Before requesting platform permissions, mobile should show a plain explanation:

- what data OptiMe wants to read
- why it helps planning
- that connection is optional
- that the user can disconnect later
- that the user can delete synced summaries
- that OptiMe is not a medical service

Consent should be stored on the backend as connection metadata:

- provider
- status
- consentedAt
- disconnectedAt
- lastSyncAt
- permissionsGranted

## Granular Permissions

Request only the data needed for Sprint 7:

- steps
- sleep
- workouts / exercise sessions
- active energy
- weight only if the user explicitly grants it

Heart rate and resting heart rate should be optional or later.

Weight should be treated as especially sensitive. It must not be required for health integration and should not be used for shame, pressure, or aggressive plan changes.

## Disconnect Behavior

Disconnect should:

- mark the connection as `DISCONNECTED`
- stop future sync attempts
- prevent health summaries from being added to new planning context
- preserve synced summaries unless the user also chooses delete synced data

Disconnect is not the same as delete.

## Delete Synced Data Behavior

Delete synced data should:

- remove stored `HealthDailySummary` rows for the user
- clear or reset provider sync metadata as appropriate
- leave account/profile data intact
- not require deleting the account

Batch 2 behavior:

- `POST /v1/health/disconnect` sets provider status to `DISCONNECTED` and preserves existing summaries.
- `DELETE /v1/health/data` deletes summaries for the authenticated user and clears `lastSyncAt`.
- Provider-specific deletion deletes only that provider's summaries.
- Deleting synced data does not delete the user account.

If the user reconnects later, summaries can be synced again only after consent.

## Logging Rules

Do not log:

- raw health samples
- full health summaries
- platform permission payloads
- device-specific health identifiers
- private notes
- API tokens or secrets

Safe logs may include:

- provider
- status
- summary date count
- sync success/failure
- non-sensitive error reason

## No Diagnosis

OptiMe must not diagnose or treat health conditions based on health data.

Allowed style:

- "Your recent sleep looks lower than usual, so today leans toward easier movement and recovery."

Avoid:

- "You have insomnia."
- "Your heart rate indicates a medical issue."
- "Your weight trend means you need a strict diet."

## Under-18 Safety

For users under 18:

- safeMode remains true
- no aggressive weight-loss guidance
- no body-image pressure
- no strict calorie or macro rules
- health data should support sleep, hydration, recovery, balanced meals, and healthy movement

Under-18 safeMode overrides health-based personalization.

## Pregnancy, Postpartum, And Breastfeeding

Pregnancy/postpartum/breastfeeding context is safety-sensitive.

When present:

- avoid aggressive dieting
- avoid unsafe intensity escalation
- treat fatigue, pain, dizziness, or discomfort conservatively
- recommend qualified professional support for serious symptoms or major changes

Pregnancy/postpartum safety overrides health-based personalization.

## User-Facing Permission Explanation

Suggested copy:

"OptiMe can use optional health data like steps, sleep, workouts, and active energy to make daily plans more aware of your recovery and activity. You choose what to share, and you can disconnect or delete synced data anytime. OptiMe does not diagnose medical conditions."
