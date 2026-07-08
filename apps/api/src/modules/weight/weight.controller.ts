import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWeightLogDto } from './dto/create-weight-log.dto';
import { WeightService } from './weight.service';

@UseGuards(JwtAuthGuard)
@Controller('weight')
export class WeightController {
  constructor(private readonly weightService: WeightService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.weightService.getSummary(user.userId);
  }

  @Get('logs')
  listLogs(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.weightService.listLogs(user.userId, limit ? Number(limit) : undefined);
  }

  @Post('logs')
  createLog(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWeightLogDto) {
    return this.weightService.createManualLog(user.userId, dto);
  }
}
