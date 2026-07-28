import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/environment.validation';
import { AuthModule } from './modules/auth/auth.module';
import { DailyPlanCheckInsModule } from './modules/daily-plan-check-ins/daily-plan-check-ins.module';
import { DailyPlansModule } from './modules/daily-plans/daily-plans.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { FoodCatalogModule } from './modules/food-catalog/food-catalog.module';
import { FoodAvailabilityModule } from './modules/food-availability/food-availability.module';
import { FoodLogsModule } from './modules/food-logs/food-logs.module';
import { GoalsModule } from './modules/goals/goals.module';
import { HealthModule } from './modules/health/health.module';
import { NutritionPreferencesModule } from './modules/nutrition-preferences/nutrition-preferences.module';
import { NutritionTargetsModule } from './modules/nutrition-targets/nutrition-targets.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PlanCheckpointModule } from './modules/plan-checkpoint/plan-checkpoint.module';
import { PlanImpactModule } from './modules/plan-impact/plan-impact.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ProgressiveProfileModule } from './modules/progressive-profile/progressive-profile.module';
import { ProtocolModule } from './modules/protocol/protocol.module';
import { SafetyAgentModule } from './modules/safety-agent/safety-agent.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TrainingPreferencesModule } from './modules/training-preferences/training-preferences.module';
import { TrainingOverridesModule } from './modules/training-overrides/training-overrides.module';
import { TrainingScheduleModule } from './modules/training-schedule/training-schedule.module';
import { UsageModule } from './modules/usage/usage.module';
import { UsersModule } from './modules/users/users.module';
import { WeightModule } from './modules/weight/weight.module';
import { WorkoutSessionsModule } from './modules/workout-sessions/workout-sessions.module';
import { PrismaModule } from './prisma/prisma.module';

const isTestEnvironment = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: isTestEnvironment,
      validate: isTestEnvironment ? undefined : validateEnvironment
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EntitlementsModule,
    ExercisesModule,
    FoodCatalogModule,
    FoodAvailabilityModule,
    ProfilesModule,
    GoalsModule,
    HealthModule,
    NutritionPreferencesModule,
    NutritionTargetsModule,
    PlanCheckpointModule,
    PlanImpactModule,
    TrainingScheduleModule,
    TrainingOverridesModule,
    TrainingPreferencesModule,
    ProgressiveProfileModule,
    ProtocolModule,
    OnboardingModule,
    SafetyAgentModule,
    SettingsModule,
    UsageModule,
    WeightModule,
    DailyPlanCheckInsModule,
    FoodLogsModule,
    DailyPlansModule,
    WorkoutSessionsModule
  ]
})
export class AppModule {}
