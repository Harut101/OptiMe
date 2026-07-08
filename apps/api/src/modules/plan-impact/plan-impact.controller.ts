import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvaluatePlanImpactDto } from './dto/evaluate-plan-impact.dto';
import { PlanImpactService } from './plan-impact.service';

@UseGuards(JwtAuthGuard)
@Controller('plan-impact')
export class PlanImpactController {
  constructor(private readonly planImpactService: PlanImpactService) {}

  @Post('evaluate')
  evaluate(@CurrentUser() user: AuthenticatedUser, @Body() dto: EvaluatePlanImpactDto) {
    return this.planImpactService.evaluate(user.userId, dto);
  }
}
