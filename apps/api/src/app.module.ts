import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './modules/auth/auth.module';
import { DailyPlansModule } from './modules/daily-plans/daily-plans.module';
import { GoalsModule } from './modules/goals/goals.module';
import { NutritionPreferencesModule } from './modules/nutrition-preferences/nutrition-preferences.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { TrainingScheduleModule } from './modules/training-schedule/training-schedule.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    GoalsModule,
    NutritionPreferencesModule,
    TrainingScheduleModule,
    OnboardingModule,
    DailyPlansModule
  ]
})
export class AppModule {}
