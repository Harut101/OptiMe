import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectHealthDto } from './dto/connect-health.dto';
import { DeleteHealthDataDto } from './dto/delete-health-data.dto';
import { DisconnectHealthDto } from './dto/disconnect-health.dto';
import { GetDailySummaryQueryDto } from './dto/get-daily-summary-query.dto';
import { UpsertHealthDailySummaryDto } from './dto/upsert-health-daily-summary.dto';
import { HealthService } from './health.service';

@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.healthService.getStatus(user.userId);
  }

  @Post('connect')
  connect(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConnectHealthDto) {
    return this.healthService.connect(user.userId, dto);
  }

  @Post('disconnect')
  disconnect(@CurrentUser() user: AuthenticatedUser, @Body() dto: DisconnectHealthDto) {
    return this.healthService.disconnect(user.userId, dto);
  }

  @Delete('data')
  deleteData(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteHealthDataDto) {
    return this.healthService.deleteData(user.userId, dto);
  }

  @Get('daily-summary')
  getDailySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetDailySummaryQueryDto
  ) {
    return this.healthService.getDailySummary(user.userId, query.localDate);
  }

  @Post('daily-summary')
  upsertDailySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertHealthDailySummaryDto
  ) {
    return this.healthService.upsertDailySummary(user.userId, dto);
  }
}

