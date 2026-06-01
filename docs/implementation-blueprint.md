# OptiMe MVP Implementation Blueprint

## 1. Product Scope

OptiMe is a mobile-first AI wellness coach that helps users decide what to eat, how hard to train, and when to recover based on profile data, goals, preferences, schedule, daily condition, and later WHOOP data.

MVP product promise:

- Open the app each day
- See a safe, personalized daily plan
- Understand whether to push, maintain, or recover
- Move toward goals without unsafe dieting or training advice

Non-goals for MVP:

- calorie logging as the core experience
- medical diagnosis
- fully autonomous agent workflows
- microservices
- web user dashboard
- direct mobile-to-OpenAI integration

Core architecture rule:

- `Mobile app -> NestJS backend -> AI orchestration layer -> OpenAI API`

## 2. Build Order

Corrected implementation sequence:

1. Onboarding + profile + goals
2. Training schedule + nutrition preferences
3. Safety rules foundation + usage guard foundation
4. Daily plan generation
5. Safety Agent validation for every AI output
6. History + user feedback loop
7. Subscriptions and entitlements
8. Weekly reports
9. WHOOP integration as Pro-only feature
10. Pro recovery-based recommendations
11. AI Coach chat
12. Embeddings-based personalization

## 3. Architecture Principles

- Start as a modular monolith.
- Keep business rules deterministic and centralized in backend services.
- Use AI only for bounded generation tasks.
- All AI outputs must be structured JSON.
- All AI outputs must be validated against schema.
- Safety Agent validation must run before any AI output is shown to the user.
- Mobile app must never call OpenAI directly and must never store OpenAI API keys.
- WHOOP access must be guarded by entitlement checks and remain Pro-only.
- Do not over-engineer for future microservices; use clean module boundaries instead.

## 4. Monorepo Structure

Recommended monorepo:

```text
optime/
  apps/
    mobile/
      app/
      src/
        api/
        components/
        features/
        hooks/
        navigation/
        screens/
        store/
        theme/
        types/
        utils/
      assets/
      app.json
      package.json
      tsconfig.json
    api/
      src/
        main.ts
        app.module.ts
        common/
          config/
          decorators/
          dto/
          enums/
          errors/
          guards/
          interceptors/
          pipes/
          validators/
        modules/
          auth/
          users/
          profiles/
          goals/
          nutrition-preferences/
          training-schedule/
          safety/
          usage/
          ai/
          daily-plans/
          history/
          subscriptions/
          weekly-reports/
          integrations-whoop/
          coach-chat/
          embeddings/
          admin/
        jobs/
          processors/
          queues/
        prisma/
        test/
      package.json
      tsconfig.json
    web/
      landing/
      admin/
  packages/
    shared-types/
    shared-schemas/
    ui-mobile/
    config/
  docs/
    implementation-blueprint.md
  prisma/
    migrations/
  .github/
    workflows/
  package.json
  turbo.json
  pnpm-workspace.yaml
```

Recommended tooling:

- package manager: `pnpm`
- monorepo orchestration: `turbo`
- backend validation: `zod` plus Nest DTO validation where helpful
- shared contracts: `packages/shared-types`, `packages/shared-schemas`

Keep `web` present as a placeholder but do not let it drive MVP decisions.

## 5. High-Level Runtime Architecture

```text
Expo Mobile App
  -> REST API (NestJS)
  -> Auth + JWT
  -> Domain Services
  -> AI Orchestrator
  -> Safety Pipeline
  -> PostgreSQL via Prisma
  -> Redis/BullMQ for jobs
  -> OpenAI API
```

Synchronous flows:

- auth
- profile updates
- goal updates
- schedule and preference updates
- request today plan
- coach chat turn

Asynchronous flows:

- pre-generate daily plans
- weekly report generation
- usage aggregation
- notifications
- WHOOP sync
- personalization embedding refresh

## 6. NestJS Module Layout

Use a modular monolith with clear ownership.

### Core platform modules

- `auth`
  - registration, login, refresh, JWT guards
- `users`
  - user account lifecycle, status, locale, timezone
- `profiles`
  - date of birth, gender, height, weight, activity level, units
- `goals`
  - primary goal, target weight, target timeline, goal mode
- `nutrition-preferences`
  - allergies, excluded foods, preferred foods, diet type, meals per day
- `training-schedule`
  - recurring weekly sport schedule and free-text workout descriptions

### Safety and control modules

- `safety`
  - safety rules engine
  - safe mode logic
  - calorie floor logic
  - training intensity ceiling logic
  - allergy enforcement
  - safety agent orchestration
  - safety audit logging
- `usage`
  - fair-use counters
  - monthly quota tracking
  - cost guard
  - AI generation budget tracking
- `subscriptions`
  - plan assignment
  - entitlement resolution
  - feature access middleware

### AI and product modules

- `ai`
  - OpenAI client wrapper
  - model router
  - prompt builders
  - structured output validation
  - retry/fallback handler
- `daily-plans`
  - today plan orchestration
  - plan persistence
  - plan regeneration logic
  - meal swap handling later
- `history`
  - historical plan retrieval
  - user plan feedback
  - adherence summaries
- `weekly-reports`
  - weekly summaries and report generation
- `coach-chat`
  - Pro-only conversational endpoint
  - moderation and safety gating
- `integrations-whoop`
  - OAuth connection
  - sync jobs
  - normalized recovery/sleep/strain records
- `embeddings`
  - future memory indexing
  - retrieval assembly for personalization

### Operations modules

- `admin`
  - generation log inspection
  - safety event review
  - user support tools
- `jobs`
  - BullMQ queue definitions and processors

## 7. Backend Service Boundaries

Service boundaries should stay practical:

- `ProfileService`
  - owns profile completeness and derived profile facts
- `GoalService`
  - owns goal validity and dangerous goal checks
- `NutritionPreferenceService`
  - owns food constraints normalization
- `TrainingScheduleService`
  - owns weekly schedule CRUD and day summaries
- `EntitlementService`
  - resolves current active subscription from subscription history and derives feature access
- `UsageGuardService`
  - checks daily/monthly quotas before AI calls
- `OpenAIService`
  - single gateway to OpenAI
- `ModelRouterService`
  - chooses model by task, plan, and cost policy
- `DailyPlannerService`
  - builds planning context and generates daily plans
- `SafetyRuleService`
  - deterministic safety rules
- `SafetyAgentService`
  - structured AI safety review
- `DailyPlanPersistenceService`
  - stores plan versions and outcomes
- `WhoopNormalizationService`
  - converts WHOOP payloads into app-specific readiness signals
- `CoachChatService`
  - handles Pro coach conversations

## 8. Data Model and Prisma Schema

Below is the recommended MVP schema outline. Keep it in one Prisma schema with clear enums and auditability.

### Main entities

- `User`
- `Profile`
- `Goal`
- `NutritionPreference`
- `Allergy`
- `ExcludedFood`
- `PreferredFood`
- `TrainingScheduleItem`
- `Subscription`
- `UsageLedger`
- `DailyPlan`
- `DailyPlanMeal`
- `DailyPlanTraining`
- `DailyPlanRecovery`
- `DailyPlanFeedback`
- `AiGenerationLog`
- `SafetyReviewLog`
- `WeeklyReport`
- `WhoopConnection`
- `WhoopDailyMetric`
- `CoachConversation`
- `CoachMessage`
- `EmbeddingDocument`

### Recommended enums

- `SubscriptionPlan`: `FREE`, `PLUS`, `PRO`
- `SubscriptionStatus`: `TRIALING`, `ACTIVE`, `GRACE_PERIOD`, `CANCELED`, `EXPIRED`, `PAST_DUE`
- `GoalType`: `HEALTHY_LIFESTYLE`, `IMPROVE_FITNESS`, `BUILD_MUSCLE`, `IMPROVE_ENDURANCE`, `REDUCE_WEIGHT`
- `GoalImpactMode`: `NUTRITION_ONLY`, `NUTRITION_AND_TRAINING`
- `DietType`: `NONE`, `OMNIVORE`, `VEGETARIAN`, `VEGAN`, `PESCATARIAN`, `KETO`, `LOW_CARB`, `MEDITERRANEAN`, `HALAL`, `KOSHER`
- `ActivityLevel`: `LOW`, `LIGHT`, `MODERATE`, `HIGH`, `ATHLETE`
- `SportType`: `RUNNING`, `CYCLING`, `GYM`, `STRENGTH`, `HIIT`, `YOGA`, `SWIMMING`, `WALKING`, `TEAM_SPORT`, `OTHER`
- `IntensityLevel`: `LOW`, `MODERATE`, `HIGH`
- `PlanStatus`: `DRAFT`, `READY`, `BLOCKED`, `FALLBACK`
- `SafetyDecision`: `APPROVED`, `APPROVED_WITH_EDITS`, `BLOCKED`
- `DailyReadinessLevel`: `RECOVER`, `MAINTAIN`, `PUSH`
- `FeedbackOutcome`: `FOLLOWED`, `PARTIAL`, `SKIPPED`, `TOO_HARD`, `TOO_EASY`, `DISLIKED_MEALS`, `LOW_ENERGY`
- `AiTaskType`: `DAILY_PLAN`, `WEEKLY_REPORT`, `COACH_CHAT`, `SAFETY_REVIEW`, `PERSONALIZATION_SUMMARY`

### Prisma schema draft

```prisma
enum SubscriptionPlan {
  FREE
  PLUS
  PRO
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  GRACE_PERIOD
  CANCELED
  EXPIRED
  PAST_DUE
}

enum GoalType {
  HEALTHY_LIFESTYLE
  IMPROVE_FITNESS
  BUILD_MUSCLE
  IMPROVE_ENDURANCE
  REDUCE_WEIGHT
}

enum GoalImpactMode {
  NUTRITION_ONLY
  NUTRITION_AND_TRAINING
}

enum DietType {
  NONE
  OMNIVORE
  VEGETARIAN
  VEGAN
  PESCATARIAN
  KETO
  LOW_CARB
  MEDITERRANEAN
  HALAL
  KOSHER
}

enum ActivityLevel {
  LOW
  LIGHT
  MODERATE
  HIGH
  ATHLETE
}

enum SportType {
  RUNNING
  CYCLING
  GYM
  STRENGTH
  HIIT
  YOGA
  SWIMMING
  WALKING
  TEAM_SPORT
  OTHER
}

enum IntensityLevel {
  LOW
  MODERATE
  HIGH
}

enum PlanStatus {
  DRAFT
  READY
  BLOCKED
  FALLBACK
}

enum SafetyDecision {
  APPROVED
  APPROVED_WITH_EDITS
  BLOCKED
}

enum DailyReadinessLevel {
  RECOVER
  MAINTAIN
  PUSH
}

enum FeedbackOutcome {
  FOLLOWED
  PARTIAL
  SKIPPED
  TOO_HARD
  TOO_EASY
  DISLIKED_MEALS
  LOW_ENERGY
}

enum AiTaskType {
  DAILY_PLAN
  WEEKLY_REPORT
  COACH_CHAT
  SAFETY_REVIEW
  PERSONALIZATION_SUMMARY
}

model User {
  id                String   @id @default(cuid())
  email             String   @unique
  passwordHash      String
  firstName         String?
  lastName          String?
  timezone          String   @default("UTC")
  locale            String   @default("en")
  isMinor           Boolean  @default(false)
  safeMode          Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  profile           Profile?
  goal              Goal?
  nutritionPref     NutritionPreference?
  schedules         TrainingScheduleItem[]
  subscriptions     Subscription[]
  usageLedger       UsageLedger[]
  dailyPlans        DailyPlan[]
  feedback          DailyPlanFeedback[]
  aiLogs            AiGenerationLog[]
  safetyLogs        SafetyReviewLog[]
  weeklyReports     WeeklyReport[]
  whoopConnection   WhoopConnection?
  whoopMetrics      WhoopDailyMetric[]
  coachConversations CoachConversation[]
  embeddings        EmbeddingDocument[]
}

model Profile {
  id            String        @id @default(cuid())
  userId        String        @unique
  gender        String?
  dateOfBirth   DateTime
  heightCm      Float
  weightKg      Float
  activityLevel ActivityLevel
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Goal {
  id               String         @id @default(cuid())
  userId           String         @unique
  goalType         GoalType
  targetWeightKg   Float?
  targetTimelineDays Int?
  impactMode       GoalImpactMode?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model NutritionPreference {
  id            String   @id @default(cuid())
  userId        String   @unique
  dietType      DietType @default(NONE)
  mealsPerDay   Int
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  allergies      Allergy[]
  excludedFoods  ExcludedFood[]
  preferredFoods PreferredFood[]
}

model Allergy {
  id                   String   @id @default(cuid())
  nutritionPreferenceId String
  name                 String

  nutritionPreference NutritionPreference @relation(fields: [nutritionPreferenceId], references: [id], onDelete: Cascade)
}

model ExcludedFood {
  id                   String   @id @default(cuid())
  nutritionPreferenceId String
  name                 String

  nutritionPreference NutritionPreference @relation(fields: [nutritionPreferenceId], references: [id], onDelete: Cascade)
}

model PreferredFood {
  id                   String   @id @default(cuid())
  nutritionPreferenceId String
  name                 String

  nutritionPreference NutritionPreference @relation(fields: [nutritionPreferenceId], references: [id], onDelete: Cascade)
}

model TrainingScheduleItem {
  id                String         @id @default(cuid())
  userId            String
  dayOfWeek         Int
  localTime         String
  sportType         SportType
  durationMinutes   Int
  intensity         IntensityLevel
  description       String?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Subscription {
  id                  String           @id @default(cuid())
  userId              String
  plan                SubscriptionPlan @default(FREE)
  provider            String?
  providerCustomerId  String?
  providerSubscriptionId String?
  providerTransactionId  String?
  originalTransactionId  String?
  environment           String?
  providerProductId   String?
  status              SubscriptionStatus
  startsAt            DateTime?
  endsAt              DateTime?
  canceledAt          DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UsageLedger {
  id              String   @id @default(cuid())
  userId          String
  taskType        AiTaskType
  periodType      String
  periodKey       String
  requestCount    Int      @default(0)
  regenerationCount Int    @default(0)
  inputTokens     Int      @default(0)
  outputTokens    Int      @default(0)
  estimatedCost   Decimal  @default(0) @db.Decimal(10, 4)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, taskType, periodType, periodKey])
}

model DailyPlan {
  id                    String              @id @default(cuid())
  userId                String
  planLocalDate         String
  planTimezone          String
  status                PlanStatus
  readinessLevel        DailyReadinessLevel
  calorieTarget         Int?
  proteinGrams          Int?
  carbsGrams            Int?
  fatsGrams             Int?
  hydrationLiters       Float?
  trainingSummary       String?
  recoverySummary       String?
  explanation           String?
  planJson              Json
  createdByAi           Boolean             @default(true)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  user                  User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  meals                 DailyPlanMeal[]
  training              DailyPlanTraining?
  recovery              DailyPlanRecovery?
  feedback              DailyPlanFeedback[]
  safetyReviews         SafetyReviewLog[]

  @@unique([userId, planLocalDate, planTimezone])
}

model DailyPlanMeal {
  id            String   @id @default(cuid())
  dailyPlanId    String
  mealIndex      Int
  title          String
  timeLabel      String?
  calories       Int?
  proteinGrams   Int?
  carbsGrams     Int?
  fatsGrams      Int?
  notes          String?
  itemsJson      Json

  dailyPlan DailyPlan @relation(fields: [dailyPlanId], references: [id], onDelete: Cascade)
}

model DailyPlanTraining {
  id                  String   @id @default(cuid())
  dailyPlanId         String   @unique
  recommendation      String
  intensity           IntensityLevel
  durationMinutes     Int?
  readinessReason     String?
  detailsJson         Json

  dailyPlan DailyPlan @relation(fields: [dailyPlanId], references: [id], onDelete: Cascade)
}

model DailyPlanRecovery {
  id                 String   @id @default(cuid())
  dailyPlanId        String   @unique
  sleepFocus         String?
  hydrationFocus     String?
  mobilityFocus      String?
  recoveryActionsJson Json

  dailyPlan DailyPlan @relation(fields: [dailyPlanId], references: [id], onDelete: Cascade)
}

model DailyPlanFeedback {
  id            String          @id @default(cuid())
  userId        String
  dailyPlanId   String
  outcome       FeedbackOutcome
  note          String?
  createdAt     DateTime        @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  dailyPlan DailyPlan @relation(fields: [dailyPlanId], references: [id], onDelete: Cascade)
}

model AiGenerationLog {
  id                String     @id @default(cuid())
  userId            String?
  taskType          AiTaskType
  model             String
  requestJson       Json
  responseJson      Json?
  parsedJson        Json?
  inputTokens       Int?
  outputTokens      Int?
  estimatedCost     Decimal?   @db.Decimal(10, 4)
  success           Boolean    @default(false)
  retryCount        Int        @default(0)
  createdAt         DateTime   @default(now())

  user          User?             @relation(fields: [userId], references: [id], onDelete: SetNull)
  safetyReviews SafetyReviewLog[]
}

model SafetyReviewLog {
  id                String          @id @default(cuid())
  userId            String
  dailyPlanId       String?
  aiGenerationLogId String?
  decision          SafetyDecision
  reasonCodesJson   Json
  editsJson         Json?
  createdAt         DateTime        @default(now())

  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  dailyPlan       DailyPlan?       @relation(fields: [dailyPlanId], references: [id], onDelete: SetNull)
  aiGenerationLog AiGenerationLog? @relation(fields: [aiGenerationLogId], references: [id], onDelete: SetNull)

  @@index([aiGenerationLogId])
}

model WeeklyReport {
  id             String   @id @default(cuid())
  userId         String
  weekStartDate  DateTime
  reportJson     Json
  createdAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model WhoopConnection {
  id               String   @id @default(cuid())
  userId           String   @unique
  providerUserId   String?
  accessTokenEnc   String?
  refreshTokenEnc  String?
  connectedAt      DateTime?
  disconnectedAt   DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model WhoopDailyMetric {
  id                String   @id @default(cuid())
  userId            String
  metricDate        DateTime
  recoveryScore     Float?
  sleepScore        Float?
  strainScore       Float?
  restingHr         Float?
  hrv               Float?
  rawJson           Json
  createdAt         DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, metricDate])
}

model CoachConversation {
  id            String   @id @default(cuid())
  userId        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages CoachMessage[]
}

model CoachMessage {
  id               String   @id @default(cuid())
  conversationId   String
  role             String
  content          String
  contentJson      Json?
  createdAt        DateTime @default(now())

  conversation CoachConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}

model EmbeddingDocument {
  id             String   @id @default(cuid())
  userId         String
  sourceType     String
  sourceId       String
  content        String
  embeddingRef   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, sourceType])
}
```

## 9. REST API Contracts

Keep REST first. Avoid GraphQL in MVP.

Base prefix:

- `/v1`

### Auth

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/forgot-password`
- `POST /v1/auth/reset-password`
- `POST /v1/auth/change-password`

`POST /v1/auth/register`

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password",
  "timezone": "America/New_York",
  "locale": "en"
}
```

Response:

```json
{
  "user": {
    "id": "usr_123",
    "email": "user@example.com",
    "safeMode": false
  },
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

### Profile and onboarding

- `GET /v1/me`
- `PUT /v1/profile`
- `PUT /v1/goals`
- `PUT /v1/nutrition-preferences`
- `GET /v1/training-schedule`
- `POST /v1/training-schedule/items`
- `PATCH /v1/training-schedule/items/:id`
- `DELETE /v1/training-schedule/items/:id`
- `GET /v1/onboarding/status`

`PUT /v1/profile`

```json
{
  "firstName": "Alex",
  "lastName": "Smith",
  "gender": "female",
  "dateOfBirth": "1996-04-18",
  "heightCm": 168,
  "weightKg": 64,
  "activityLevel": "MODERATE"
}
```

Behavior:

- `safeMode` is backend-managed only.
- Client must never send or update `safeMode` directly.
- Backend derives age from `dateOfBirth` and current date.
- `ProfileService` derives `safeMode` from `dateOfBirth` when profile data changes and can recalculate it on demand.
- If derived age is under 18, `safeMode` is always `true`.

`PUT /v1/goals`

```json
{
  "goalType": "REDUCE_WEIGHT",
  "targetWeightKg": 58,
  "targetTimelineDays": 120,
  "impactMode": "NUTRITION_AND_TRAINING"
}
```

### Daily plans

- `GET /v1/daily-plans/today`
- `POST /v1/daily-plans/generate`
- `GET /v1/daily-plans/history`
- `GET /v1/daily-plans/:id`
- `POST /v1/daily-plans/:id/feedback`

`POST /v1/daily-plans/generate`

Request:

```json
{
  "forceRegenerate": false
}
```

MVP regeneration behavior:

- Keep one plan row per `userId + planLocalDate + planTimezone`.
- `forceRegenerate = false` returns the existing plan for that local date if one already exists.
- `forceRegenerate = true` replaces the existing plan contents in the same row for MVP instead of introducing versioning.
- Count regenerations separately in usage tracking through `regenerationCount`.
- Versioned historical plan revisions can be added later if product needs explainability or audit playback.

Response:

```json
{
  "planId": "plan_123",
  "status": "READY",
  "readinessLevel": "MAINTAIN",
  "plan": {
    "calorieTarget": 2100,
    "macros": {
      "proteinGrams": 130,
      "carbsGrams": 220,
      "fatsGrams": 65
    },
    "meals": [],
    "training": {},
    "recovery": {},
    "explanation": "..."
  },
  "safety": {
    "decision": "APPROVED"
  }
}
```

### Weekly reports

- `GET /v1/weekly-reports/latest`
- `POST /v1/weekly-reports/generate`

### Subscriptions and entitlements

- `GET /v1/subscription`
- `GET /v1/entitlements`
- `POST /v1/subscription/webhook/apple`
- `POST /v1/subscription/webhook/google`

`GET /v1/subscription`

- returns the currently resolved active subscription plus provider metadata and renewal dates

`GET /v1/entitlements`

- returns the feature matrix derived from the resolved active subscription, not raw subscription history rows

Entitlement resolution logic:

1. Load all subscription rows for the user ordered by `startsAt DESC, createdAt DESC`.
2. Filter to rows whose status is one of `TRIALING`, `ACTIVE`, or `GRACE_PERIOD`.
3. Exclude rows whose `startsAt` is in the future.
4. Exclude rows whose `endsAt` is in the past unless status is `GRACE_PERIOD`.
5. Choose the highest-priority eligible row.
6. If multiple eligible rows exist, prefer the row with the highest plan rank `PRO > PLUS > FREE`, then the latest `startsAt`.
7. If no eligible paid row exists, fall back to implicit `FREE` entitlements.
8. Derive feature flags from the resolved plan, never directly from provider payloads at request time.
9. `EntitlementService` must never trust client-provided subscription state.

Subscription event handling:

- App Store and Google Play server events should be normalized into subscription history rows.
- Provider event payloads should update `status`, `startsAt`, `endsAt`, `canceledAt`, transaction identifiers, and environment fields.
- Duplicate provider events should be handled idempotently using provider transaction identifiers where available.
- Client purchase state may trigger refresh flows, but authoritative entitlement changes must come from verified backend-side processing.

### WHOOP

- `POST /v1/whoop/connect`
- `POST /v1/whoop/disconnect`
- `GET /v1/whoop/status`
- `POST /v1/whoop/sync`
- `POST /v1/whoop/webhook` optional, pending provider verification

Rules:

- all WHOOP endpoints require `PRO` entitlement except status read for disconnected upsell UX
- main implementation path is OAuth connection plus manual sync and scheduled background sync

### Coach chat

- `POST /v1/coach-chat/messages`
- `GET /v1/coach-chat/conversations/:id`

Rules:

- Pro only
- every message moderated first
- every AI reply passes Safety Agent validation

### Admin

- `GET /v1/admin/ai-logs`
- `GET /v1/admin/safety-events`
- `GET /v1/admin/users/:id/support-view`

## 10. AI Task Design

Do not build a complex autonomous agent platform for MVP.

Use task-specific orchestration:

- `DailyPlanGenerationTask`
- `SafetyReviewTask`
- `WeeklyReportTask`
- `CoachChatReplyTask`
- `WhoopRecoveryAdaptationTask`
- `PersonalizationSummaryTask`

### OpenAI environment variables

- `OPENAI_API_KEY`
- `OPENAI_DEFAULT_MODEL`
- `OPENAI_PREMIUM_MODEL`
- `OPENAI_REASONING_MODEL`
- `OPENAI_SAFETY_MODEL`
- `OPENAI_MODERATION_MODEL`
- `OPENAI_EMBEDDING_MODEL`

### Model routing policy

- default model
  - standard daily plans
  - lightweight summaries
- premium model
  - Pro daily plans
  - WHOOP-adapted daily plans
  - coach chat
- reasoning model
  - weekly reports
  - complex adaptation
  - high-risk edge cases
- moderation model
  - moderation endpoint only
- safety model
  - optional structured safety rewrite or escalation support

### AI orchestration pipeline

1. Validate entitlement and usage limit.
2. Build deterministic planning context.
3. Apply hard safety constraints before prompting.
4. Call Responses API with structured output schema.
5. Validate schema.
6. Retry once on parse/schema failure.
7. Run Safety Agent validation.
8. If approved, persist and return.
9. If approved with edits, persist edited plan and return.
10. If blocked or second failure, return safe fallback plan.

## 11. AI JSON Schemas

Use shared Zod schemas in `packages/shared-schemas` and derive JSON schema from them.

### Daily plan schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "plan_meta",
    "calorie_guidance",
    "macro_guidance",
    "meals",
    "hydration",
    "training_recommendation",
    "recovery_recommendation",
    "coach_explanation",
    "warnings"
  ],
  "properties": {
    "plan_meta": {
      "type": "object",
      "additionalProperties": false,
      "required": ["plan_date", "readiness_level", "goal_alignment"],
      "properties": {
        "plan_date": { "type": "string", "format": "date" },
        "readiness_level": { "type": "string", "enum": ["RECOVER", "MAINTAIN", "PUSH"] },
        "goal_alignment": { "type": "string" }
      }
    },
    "calorie_guidance": {
      "type": "object",
      "additionalProperties": false,
      "required": ["target_calories", "reason"],
      "properties": {
        "target_calories": { "type": "integer", "minimum": 1000, "maximum": 6000 },
        "reason": { "type": "string" }
      }
    },
    "macro_guidance": {
      "type": "object",
      "additionalProperties": false,
      "required": ["protein_grams", "carbs_grams", "fats_grams"],
      "properties": {
        "protein_grams": { "type": "integer", "minimum": 0, "maximum": 400 },
        "carbs_grams": { "type": "integer", "minimum": 0, "maximum": 700 },
        "fats_grams": { "type": "integer", "minimum": 0, "maximum": 250 }
      }
    },
    "meals": {
      "type": "array",
      "minItems": 1,
      "maxItems": 8,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["meal_name", "timing", "foods", "approx_calories"],
        "properties": {
          "meal_name": { "type": "string" },
          "timing": { "type": "string" },
          "foods": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["name", "portion", "notes"],
              "properties": {
                "name": { "type": "string" },
                "portion": { "type": "string" },
                "notes": { "type": "string" }
              }
            }
          },
          "approx_calories": { "type": "integer", "minimum": 0, "maximum": 2000 },
          "notes": { "type": "string" }
        }
      }
    },
    "hydration": {
      "type": "object",
      "additionalProperties": false,
      "required": ["target_liters", "timing_notes"],
      "properties": {
        "target_liters": { "type": "number", "minimum": 0.5, "maximum": 8 },
        "timing_notes": { "type": "string" }
      }
    },
    "training_recommendation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["mode", "summary", "intensity", "duration_minutes"],
      "properties": {
        "mode": { "type": "string", "enum": ["RECOVER", "MAINTAIN", "PUSH"] },
        "summary": { "type": "string" },
        "intensity": { "type": "string", "enum": ["LOW", "MODERATE", "HIGH"] },
        "duration_minutes": { "type": "integer", "minimum": 0, "maximum": 240 },
        "pre_workout_food": { "type": "string" },
        "post_workout_food": { "type": "string" }
      }
    },
    "recovery_recommendation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["summary", "actions"],
      "properties": {
        "summary": { "type": "string" },
        "actions": {
          "type": "array",
          "minItems": 1,
          "maxItems": 6,
          "items": { "type": "string" }
        }
      }
    },
    "coach_explanation": { "type": "string" },
    "warnings": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 5
    }
  }
}
```

### Weekly report schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["week_start", "summary", "wins", "watchouts", "next_week_focus"],
  "properties": {
    "week_start": { "type": "string", "format": "date" },
    "summary": { "type": "string" },
    "wins": {
      "type": "array",
      "minItems": 1,
      "maxItems": 5,
      "items": { "type": "string" }
    },
    "watchouts": {
      "type": "array",
      "maxItems": 5,
      "items": { "type": "string" }
    },
    "next_week_focus": {
      "type": "array",
      "minItems": 1,
      "maxItems": 5,
      "items": { "type": "string" }
    }
  }
}
```

### Coach chat reply schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["reply", "tone", "follow_up_suggestion", "safety_flags"],
  "properties": {
    "reply": { "type": "string" },
    "tone": { "type": "string", "enum": ["SUPPORTIVE", "CALM", "PRACTICAL"] },
    "follow_up_suggestion": { "type": "string" },
    "safety_flags": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 6
    }
  }
}
```

## 12. Safety Agent Schema

The Safety Agent should review structured output, not invent a new plan from scratch.

Input to Safety Agent:

- user age
- safe mode flag
- subscription plan
- allergies
- excluded foods
- goal type
- target timeline
- readiness inputs
- WHOOP readiness signals if available
- generated daily plan JSON

### Safety review output schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "decision",
    "reason_codes",
    "blocked_fields",
    "safe_edits",
    "user_message"
  ],
  "properties": {
    "decision": {
      "type": "string",
      "enum": ["APPROVED", "APPROVED_WITH_EDITS", "BLOCKED"]
    },
    "reason_codes": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "EXTREME_CALORIE_RESTRICTION",
          "UNSAFE_WEIGHT_LOSS_RATE",
          "ALLERGEN_DETECTED",
          "EXCLUDED_FOOD_DETECTED",
          "UNSAFE_INTENSITY_FOR_RECOVERY",
          "MINOR_SAFETY_RESTRICTION",
          "MEDICAL_LANGUAGE_RISK",
          "BODY_SHAMING_LANGUAGE",
          "TRAIN_THROUGH_PAIN_RISK",
          "INVALID_OUTPUT"
        ]
      }
    },
    "blocked_fields": {
      "type": "array",
      "items": { "type": "string" }
    },
    "safe_edits": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path", "action", "value"],
        "properties": {
          "path": { "type": "string" },
          "action": { "type": "string", "enum": ["REPLACE", "REMOVE", "ADD_WARNING"] },
          "value": {}
        }
      }
    },
    "user_message": { "type": "string" }
  }
}
```

### Deterministic safety rules before and after Safety Agent

Implement hard rules in code:

- under 18 => safe mode always on
- no aggressive weight-loss timelines for minors
- calorie floor by age/safe mode policy
- deficit ceiling by goal policy
- no meal suggestions containing allergens or excluded foods
- if readiness is poor, training cannot be `HIGH`
- never encourage training through pain, dizziness, illness, or exhaustion
- never output diagnosis or medical treatment advice
- never shame user or use negative body-image language

### Safe fallback

If blocked or repeated failure:

- use template-based safe plan
- hydration guidance
- balanced meal framework
- low-to-moderate movement guidance
- recovery-first explanation
- support message encouraging professional guidance when appropriate

## 13. Subscription Entitlement Matrix

Keep entitlement logic backend-owned.

### Free

- onboarding
- profile and goals
- nutrition preferences
- training schedule
- basic daily plan
- limited daily plan generations
- short history
- no WHOOP
- no coach chat
- no advanced weekly reports

### Plus

- everything in Free
- more daily plan generations
- meal swaps
- shopping list later
- weekly reports
- reminders later
- longer history
- basic personalization
- no WHOOP
- no coach chat

### Pro

- everything in Plus
- WHOOP integration
- recovery-based adaptation
- sleep-based adaptation
- strain-based adaptation
- advanced weekly reports
- AI Coach chat
- adaptive nutrition and training recommendations
- future food photo analysis

### Entitlement matrix

| Feature | Free | Plus | Pro |
|---|---|---|---|
| Profile and goals | Yes | Yes | Yes |
| Training schedule | Yes | Yes | Yes |
| Nutrition preferences | Yes | Yes | Yes |
| Daily plan generation | Limited | Expanded | Expanded |
| Short history | Yes | Yes | Yes |
| Long history | No | Yes | Yes |
| Weekly reports | No | Yes | Yes |
| Meal swaps | No | Yes | Yes |
| WHOOP connect | No | No | Yes |
| Recovery-based adaptation | No | No | Yes |
| AI Coach chat | No | No | Yes |
| Advanced analytics | No | No | Yes |

## 14. Usage Limit Design

Keep limits simple and adjustable with config.

### Usage entities

- `daily_plan_generations_today`
- `daily_plan_generations_this_month`
- `weekly_reports_this_month`
- `coach_messages_today`
- `coach_messages_this_month`
- `whoop_sync_jobs_today`
- `estimated_ai_cost_this_month`

### Suggested MVP limits

Free:

- 1 new daily plan generation per day
- 10 daily plan generations per month
- 7 days of history
- no coach chat

Plus:

- 3 daily plan generations per day
- 90 daily plan generations per month
- 1 weekly report per week
- 90 days of history

Pro:

- 5 daily plan generations per day
- 150 daily plan generations per month
- 1 weekly report per week
- 20 coach messages per day
- WHOOP sync enabled
- 365 days of history

These should be config-driven and stored in one entitlement policy table or code config object.

### Usage guard behavior

Before each AI task:

1. resolve plan
2. resolve entitlement
3. check current usage counters
4. deny if over limit
5. estimate likely model cost if needed
6. record usage after completion

Concurrency-safe usage behavior:

- Track usage by `periodType` and `periodKey`, where `periodType` is `DAILY` or `MONTHLY`.
- Example keys:
  - daily: `2026-05-31`
  - monthly: `2026-05`
- Use a database upsert inside a transaction keyed by `@@unique([userId, taskType, periodType, periodKey])`.
- Increment counters atomically in the database rather than read-modify-write in application memory.
- For plan generation, increment `requestCount` for every generation attempt and increment `regenerationCount` when `forceRegenerate = true`.
- Race-condition prevention should rely on unique constraints plus atomic increment/update statements.
- If two requests race, one may win insert and the other should retry as update using the same unique key.

### Cost guard

Implement conservative cost controls:

- cap input context size
- prefer default model unless premium entitlement requires more
- limit retries to one
- truncate history passed to prompts
- summarize older feedback before inclusion
- use background jobs for heavy reports

## 15. Daily Plan Generation Design

### Inputs

- profile
- goal
- nutrition preferences
- allergies and exclusions
- training schedule for plan date
- recent feedback
- subscription plan
- safe mode
- WHOOP-derived readiness later

### Daily planner backend steps

1. fetch user context
2. validate onboarding completeness
3. resolve entitlements
4. resolve usage allowance
5. compute deterministic boundaries
6. build planning context object
7. route model
8. generate structured plan
9. validate schema
10. run Safety Agent
11. apply deterministic post-checks
12. persist plan, AI log, safety log
13. return mobile-ready response

### Planning context object

The prompt input should be a strict JSON context containing:

- `user_profile`
- `goal_context`
- `nutrition_constraints`
- `today_schedule`
- `recent_feedback_summary`
- `safety_constraints`
- `entitlements`
- `whoop_signals`

Avoid prompt-building from free-form concatenated strings where possible.

## 16. WHOOP Integration Design

WHOOP is not an MVP day-one feature, but the backend shape should allow it later.

### Pro-only rules

- connection endpoint requires Pro
- sync job requires Pro
- adaptation features require Pro
- downgrading from Pro disables sync and hides recovery-specific coaching

### Normalized WHOOP signals

Convert raw data into backend-owned signals:

- `recovery_band`: `LOW`, `MEDIUM`, `HIGH`
- `sleep_band`: `POOR`, `OK`, `GOOD`
- `strain_band`: `LOW`, `MODERATE`, `HIGH`
- `resting_hr_delta_band`
- `hrv_delta_band`
- `readiness_override`: `RECOVER`, `MAINTAIN`, `PUSH`

The AI model should consume these normalized signals instead of raw WHOOP payloads.

WHOOP privacy behavior:

- users must be able to disconnect WHOOP at any time
- app should support deleting stored WHOOP tokens and WHOOP-derived data on request
- disconnect should stop future sync jobs immediately

## 16A. Security Requirements

- Add API rate limiting at the NestJS layer.
- Apply stricter limits to auth, daily plan generation, and coach chat endpoints than to general profile reads.
- Auth endpoints should have aggressive anti-bruteforce limits.
- Daily plan generation should have rate limiting in addition to entitlement-based usage limits.
- Coach chat should have rate limiting plus entitlement checks.
- JWT secrets, database credentials, and provider secrets must come from environment variables only.
- Server must never trust client-provided subscription state or safe mode state.
- Add account deletion and data export requirements to the product backlog and API design now, even if full implementation lands after Sprint 1.

## 16B. Privacy Requirements

- Collect basic privacy consent during onboarding before enabling plan generation.
- Add a delete-account flow that deletes or schedules deletion of user profile data, subscription pointers, preferences, schedules, and AI history according to retention policy.
- Add an export-my-data flow that returns the user's core profile, goals, preferences, schedules, plans, and feedback in a portable format.
- Add disconnect-WHOOP and delete-WHOOP-data behavior as separate user actions.
- Privacy-sensitive deletion jobs should run through backend-controlled queues when full synchronous deletion is not practical.

## 17. Pro Recovery-Based Recommendation Design

Pro should mean real adaptation.

Example policy:

- low recovery + high recent strain => no push day
- poor sleep + hard workout scheduled => downgrade to maintain or recover
- good recovery + low recent strain + endurance goal => allow push day
- negative user feedback like `LOW_ENERGY` should bias next plan downward

These rules should be partly deterministic:

- backend determines allowed intensity range
- AI writes the human-facing nutrition, workout, and recovery plan within that range

## 18. AI Coach Chat Design

Keep chat narrow and useful.

Allowed jobs:

- explain today's plan
- suggest safe alternatives
- answer nutrition and training questions in the context of the user's plan
- encourage consistency and recovery

Not allowed:

- diagnosis
- medical advice
- eating disorder encouragement
- unsafe cutting or overtraining advice

### Chat pipeline

1. entitlement check for Pro
2. input moderation
3. assemble limited context
4. generate structured reply
5. safety review
6. persist conversation
7. return response

## 19. Embeddings-Based Personalization Design

Do not implement in early MVP. Keep design simple for phase 12.

Potential embedding sources:

- stable profile facts
- nutrition preferences
- repeated disliked foods
- successful meal patterns
- successful plan explanations
- summarized historical feedback

Use embeddings only to retrieve relevant personal context, not as the source of truth.

Truth should remain in primary relational tables.

## 20. Mobile App Blueprint

### Expo app architecture

- `app/`
  - Expo Router routes
- `src/features/`
  - `auth`
  - `onboarding`
  - `today-plan`
  - `history`
  - `schedule`
  - `preferences`
  - `subscription`
  - `coach-chat`
  - `profile`

### State strategy

- server state: `@tanstack/react-query`
- local form state: `react-hook-form` plus `zod`
- auth/session state: lightweight store such as Zustand

### Mobile screens for MVP

- Welcome
- Register/Login
- Profile setup
- Goal setup
- Nutrition preferences
- Training schedule
- Today
- Plan details
- History
- Profile/Settings
- Subscription paywall

### Mobile UI principles

- Today screen first
- premium but calm tone
- simple cards with clear recommendation hierarchy
- no overwhelming analytics in MVP
- show readiness state prominently
- explain plan in a short practical way

## 21. Queue and Job Design

BullMQ queues:

- `daily-plan`
- `weekly-report`
- `whoop-sync`
- `notifications`
- `embedding-refresh`

Jobs to implement first:

- pre-generate today plan at local morning time
- generate weekly report
- backfill usage counters if needed

Avoid overbuilding job choreography. Most MVP work can stay request-driven plus a few scheduled jobs.

## 22. 12-Week MVP Roadmap

### Week 1

- monorepo bootstrap
- Expo app bootstrap
- NestJS app bootstrap
- Prisma and Postgres setup
- Redis and BullMQ setup
- shared schema package setup
- auth skeleton

### Week 2

- registration and login
- JWT auth guards
- user/profile models
- onboarding status endpoint
- profile mobile flows

### Week 3

- goals module
- dangerous goal validation
- nutrition preferences module
- allergies and exclusions persistence
- training schedule CRUD

### Week 4

- safety rules foundation
- safe mode enforcement
- calorie and intensity boundary engine
- usage ledger foundation
- entitlement resolution foundation

### Week 5

- OpenAI gateway service
- model router
- daily plan schema package
- daily plan generation endpoint
- AI logging

### Week 6

- Safety Agent integration
- post-generation validation
- fallback plan templates
- end-to-end daily plan flow on mobile

### Week 7

- daily plan history endpoints
- feedback loop endpoints
- feedback-aware prompt context
- Today and History screen refinement

### Week 8

- subscription models
- entitlement middleware
- paywall placeholders in mobile
- feature gating for Free vs Plus vs Pro

### Week 9

- weekly reports backend
- weekly report UI
- job-based scheduled generation
- Plus feature rollout

### Week 10

- WHOOP integration backend skeleton
- Pro-only connection flow
- normalized WHOOP metric storage
- no advanced adaptation yet beyond storage and readiness derivation

### Week 11

- Pro recovery-based recommendation logic
- readiness overrides from WHOOP plus feedback
- coach chat backend and mobile MVP
- moderation and safety enforcement for chat

### Week 12

- stabilization
- analytics hooks
- cost guard tuning
- test hardening
- launch checklist
- defer embeddings unless schedule and quality are on track

Embeddings-based personalization should likely move to post-MVP unless the first 11 steps are already stable.

## 23. Testing Strategy

Keep testing targeted and practical.

### Backend unit tests

Focus on deterministic logic:

- safe mode activation
- dangerous goal validation
- calorie boundary calculations
- intensity ceilings by readiness
- entitlement resolution
- usage limit checks
- WHOOP readiness normalization

### Backend integration tests

Test with real database containers or test DB:

- auth flows
- onboarding flows
- daily plan generation orchestration with mocked OpenAI
- Safety Agent pipeline
- subscription gating
- WHOOP Pro-only restrictions
- coach chat moderation and safety flow

### Contract tests

Use shared schemas:

- validate request/response shapes between mobile and backend
- validate AI JSON parse contracts
- validate fallback payloads

### AI regression tests

Create fixture-based prompt tests with mocked model outputs:

- valid safe plan
- allergen violation
- unsafe weight-loss plan
- minor user with aggressive goal
- poor recovery but high-intensity suggestion
- coach chat with risky user question

Do not rely only on live model tests.

### Mobile tests

- component tests for onboarding and Today cards
- screen tests for auth, onboarding, Today, history
- a few end-to-end flows using Detox or Maestro

Recommended E2E scenarios:

- new user onboarding to first plan
- weight-loss user with safe mode off
- minor user with safe mode enforced
- Free user hitting usage limit
- Pro user with WHOOP-connected readiness downgrade

### Non-functional tests

- latency checks for daily plan endpoint
- retry/fallback behavior under model failure
- queue job retry behavior
- auth and rate limit checks

## 24. Launch Readiness Checklist

- no mobile-side OpenAI usage anywhere
- all AI model names loaded from environment
- all user-visible AI output passes Safety Agent
- all structured outputs validated
- fallback plans verified
- usage guard turned on
- Pro-only WHOOP gating verified
- moderation wired for coach chat and risky free text
- audit logs visible in admin/support tooling

## 25. Recommended First Implementation Slice

If starting immediately, implement this thin vertical slice first:

1. register/login
2. profile setup
3. goal setup
4. nutrition preferences
5. training schedule
6. one `generate today plan` endpoint
7. one basic safe fallback
8. one Today screen in mobile

That slice proves the architecture before subscriptions, WHOOP, reports, or chat add complexity.
