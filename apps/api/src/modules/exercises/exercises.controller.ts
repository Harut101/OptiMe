import { Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto';
import { resolveExerciseLocale } from './exercise-locale';
import { ExercisesService } from './exercises.service';

@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  list(@Query() query: ListExercisesQueryDto, @Headers('accept-language') acceptLanguage?: string) {
    return this.exercisesService.list(query, resolveExerciseLocale(acceptLanguage));
  }

  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string, @Headers('accept-language') acceptLanguage?: string) {
    return this.exercisesService.getByIdOrSlug(idOrSlug, resolveExerciseLocale(acceptLanguage));
  }
}
