import { Module } from '@nestjs/common';

import { ExercisesModule } from '../exercises/exercises.module';
import { ExerciseSelectionService } from './exercise-selection.service';

@Module({
  imports: [ExercisesModule],
  providers: [ExerciseSelectionService],
  exports: [ExerciseSelectionService]
})
export class ExerciseSelectionModule {}
