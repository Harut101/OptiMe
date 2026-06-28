import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import {
  AuthenticatedUser,
  CurrentUser
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectHealthDto } from './dto/connect-health.dto';
import { CreateMockWearableSnapshotDto } from './dto/create-mock-wearable-snapshot.dto';
import { DeleteHealthDataDto } from './dto/delete-health-data.dto';
import { DisconnectHealthDto } from './dto/disconnect-health.dto';
import { GetDailySummaryQueryDto } from './dto/get-daily-summary-query.dto';
import { GetWearableSnapshotQueryDto } from './dto/get-wearable-snapshot-query.dto';
import { HealthSourceParamDto } from './dto/health-source-param.dto';
import { UpdateHealthConnectionStatusDto } from './dto/update-health-connection-status.dto';
import { UpsertHealthDailySummaryDto } from './dto/upsert-health-daily-summary.dto';
import { UpsertWearableSnapshotDto } from './dto/upsert-wearable-snapshot.dto';
import { HealthService } from './health.service';

@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.healthService.getStatus(user.userId);
  }

  @Get('connections')
  getConnections(@CurrentUser() user: AuthenticatedUser) {
    return this.healthService.getConnections(user.userId);
  }

  @Patch('connections/:source/status')
  updateConnectionStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: HealthSourceParamDto,
    @Body() dto: UpdateHealthConnectionStatusDto
  ) {
    return this.healthService.updateConnectionStatus(user.userId, params.source, dto);
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

  @Get('wearable-snapshots/today')
  getTodayWearableSnapshot(@CurrentUser() user: AuthenticatedUser) {
    return this.healthService.getTodayWearableSnapshot(user.userId);
  }

  @Get('wearable-snapshots')
  getWearableSnapshotByDate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetWearableSnapshotQueryDto
  ) {
    return this.healthService.getWearableSnapshotByDate(user.userId, query.date);
  }

  @Post('wearable-snapshots/mock')
  createMockWearableSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMockWearableSnapshotDto
  ) {
    return this.healthService.createMockWearableSnapshot(user.userId, dto);
  }

  @Post('wearable-snapshots')
  upsertWearableSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertWearableSnapshotDto
  ) {
    return this.healthService.upsertWearableSnapshot(user.userId, dto);
  }

  @Post('daily-summary')
  upsertDailySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertHealthDailySummaryDto
  ) {
    return this.healthService.upsertDailySummary(user.userId, dto);
  }
}
