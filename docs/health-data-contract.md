# Health Data Contract

This document describes the Sprint 7 backend health data contracts.

The contract stores connection metadata and daily health summaries. It intentionally avoids raw health samples.

Batch 2 implemented these contracts with migration `add_health_integration_foundation`.

## Enums

```ts
export enum HealthProvider {
  APPLE_HEALTH = "APPLE_HEALTH",
  HEALTH_CONNECT = "HEALTH_CONNECT",
}

export enum HealthConnectionStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  ERROR = "ERROR",
}
```

## Proposed Models

```prisma
model HealthConnection {
  id                 String                 @id @default(cuid())
  userId             String
  provider           HealthProvider
  status             HealthConnectionStatus @default(DISCONNECTED)
  consentedAt         DateTime?
  disconnectedAt      DateTime?
  lastSyncAt          DateTime?
  permissionsGranted  Json?
  errorReason         String?
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId, status])
  @@index([provider, status])
}

model HealthDailySummary {
  id                  String         @id @default(cuid())
  userId              String
  localDate            String
  timezone             String
  sourceProvider       HealthProvider
  steps                Int?
  sleepMinutes         Int?
  activeEnergyKcal     Int?
  workoutCount         Int?
  workoutMinutes       Int?
  averageHeartRate     Int?
  restingHeartRate     Int?
  weightKg             Decimal?
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, localDate, sourceProvider])
  @@index([userId, localDate])
  @@index([sourceProvider, localDate])
}
```

Implementation note: `weightKg` is stored as Prisma `Decimal` and returned from the API as a number or `null`.

## Ownership Rules

- All health records belong to one authenticated user.
- Users can only read, write, disconnect, or delete their own health data.
- Admin access is out of scope.
- Native platform provider identity should never be trusted without the authenticated backend user context.

## Validation Ranges

Suggested MVP ranges:

- `localDate`: `YYYY-MM-DD`
- `timezone`: valid IANA timezone string
- `steps`: 0 to 100000
- `sleepMinutes`: 0 to 1440
- `activeEnergyKcal`: 0 to 10000
- `workoutCount`: 0 to 20
- `workoutMinutes`: 0 to 1440
- `averageHeartRate`: 30 to 220
- `restingHeartRate`: 30 to 220
- `weightKg`: 20 to 400

Values outside these ranges should be rejected or ignored with a safe validation error.

## Why localDate + timezone

Health summaries are day-based from the user's perspective. A UTC date can split sleep, workouts, and steps across the wrong day.

Use:

- `localDate` for user-facing plan date
- `timezone` for interpreting the day boundary
- `sourceProvider` for provider-specific summaries

This mirrors the existing DailyPlan local-date strategy and avoids timezone bugs.

## Why Summaries Are Safer Than Raw Samples

Summaries reduce privacy and storage risk:

- fewer data points
- easier user explanation
- easier deletion
- lower risk in logs/tests
- enough for conservative protocol selection

Raw samples should be deferred until there is a clear product need and a stronger privacy review.
