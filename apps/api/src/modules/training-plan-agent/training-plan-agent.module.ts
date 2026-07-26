import { Module } from '@nestjs/common';

import { ExerciseSelectionModule } from '../exercise-selection/exercise-selection.module';
import { TrainingPlanAgentService } from './training-plan-agent.service';

@Module({
  imports: [ExerciseSelectionModule],
  providers: [TrainingPlanAgentService],
  exports: [TrainingPlanAgentService]
})
export class TrainingPlanAgentModule {}
