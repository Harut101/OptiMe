# Sprint 1 Migration Instructions

Run these after dependencies are installed and Postgres is running.

```powershell
docker compose up -d postgres
pnpm install
pnpm --filter @optime/api prisma:generate
pnpm --filter @optime/api prisma:migrate -- --name sprint_1_initial
```

The migration should include only the Sprint 1 tables:

- `User`
- `Profile`
- `Goal`
- `NutritionPreference`
- `Allergy`
- `ExcludedFood`
- `PreferredFood`
- `TrainingScheduleItem`
- `DailyPlan`

Do not add subscription, usage, payment, WHOOP, AI, coach, weekly report, admin, or embedding tables in Sprint 1.
