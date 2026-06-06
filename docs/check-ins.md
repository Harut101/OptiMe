# Plan-To-Fact Check-Ins

Sprint 5 Batch 5 adds lightweight check-ins so OptiMe can learn what actually happened after a plan is shown.

Check-ins are optional. They do not block plan generation, do not affect usage limits, and should never feel like punishment.

## Check-In Types

### Meal

Purpose: understand whether a planned meal was followed, changed, or skipped.

Payload:

- `mealIndex` or `mealName`
- `status`: `COMPLETED`, `PARTIALLY_COMPLETED`, `SKIPPED`, or `SWAPPED`
- `notes` optional, max 500 characters

Supportive copy:

- "How did this meal go?"
- "No worries if it changed - this helps us adapt."

### Training

Purpose: understand whether training happened and whether the guidance felt safe.

Payload:

- `status`: `COMPLETED`, `PARTIALLY_COMPLETED`, `SKIPPED`, or `RESTED_INSTEAD`
- `perceivedDifficulty`: optional 1-10
- `energyAfter`: optional 1-10
- `painOrDiscomfort`: optional boolean
- `notes` optional, max 500 characters

If `painOrDiscomfort=true`, store it as a safety signal. Do not diagnose. Future planning should prefer conservative training guidance.

### Evening Reflection

Purpose: collect simple daily adaptation signals.

Payload:

- `energyLevel`: optional 1-10
- `tirednessLevel`: optional 1-10
- `sorenessLevel`: optional 1-10
- `mood`: optional simple text, max 80 characters
- `notes` optional, max 500 characters

Do not overbuild mental health tracking in this batch.

## Backend API

Endpoints:

- `POST /v1/daily-plans/:id/check-ins`
- `GET /v1/daily-plans/:id/check-ins`

Both endpoints require auth and enforce ownership. A user can only create or read check-ins for their own daily plan.

`POST` upserts:

- meal check-ins by meal index or meal name
- one training check-in per daily plan
- one evening reflection per daily plan

## Storage

`DailyPlanCheckIn` stores:

- `userId`
- `dailyPlanId`
- `type`
- `subjectKey`
- `payload`
- timestamps

The payload remains JSON for MVP, but backend validation is strict by check-in type.

## Planning Context

Daily plan generation can include a recent check-in summary:

- recent skipped meals count
- recent completed workouts count
- recent average tiredness
- pain/discomfort signal
- high tiredness signal
- illness-like notes signal
- conservative training recommendation flag

If recent check-ins indicate pain, dizziness, illness, high tiredness, or extreme fatigue, OpenAI planning context should favor conservative training guidance without medical diagnosis.

## Sprint 6 Protocol Implications

Sprint 6 Batch 3 uses check-ins to influence deterministic protocol selection before AI generation.

Examples:

- Pain/discomfort check-ins should select or bias toward conservative training and recovery protocols.
- High tiredness should select or bias toward a recovery-oriented protocol.
- Repeated skipped workouts can reduce intensity, duration, or complexity instead of adding pressure.
- Completed workouts can support normal or gently progressive guidance when no safety concerns are present.
- Skipped meals can make nutrition guidance simpler and more practical.

Check-ins influence safety and recovery for all tiers. This is not paywalled.

The protocol selector uses summary flags only. It does not store full private check-in notes in protocol debug metadata.

Do not overbuild analytics yet. Check-ins should influence the next plan context and protocol selection, not create dashboards in Sprint 6.

## Mobile UX

Batch 5 adds Plan Details check-ins:

- meal buttons: Completed, Partial, Skipped, Swapped
- training buttons: Completed, Partial, Skipped, Rested
- pain/discomfort signal button

After submit, mobile shows:

"Thanks, we'll use this to adapt future plans."

If `painOrDiscomfort=true`, mobile shows:

"Thanks for letting us know. We'll use this to keep future training guidance more conservative."

Evening reflection UI can be added later if the Today screen still feels clean.

## Out Of Scope

- Notifications
- Reminders
- Check-in streaks
- Shame/guilt language
- Embeddings
- Advanced analytics
- WHOOP
- AI Coach chat
- Admin dashboards
- Usage limits for check-ins
