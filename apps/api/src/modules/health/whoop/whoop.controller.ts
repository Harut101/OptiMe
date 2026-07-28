import { Controller, Get, Post, Query, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticatedUser, CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WhoopCallbackQueryDto } from './dto/whoop-callback-query.dto';
import { WhoopConnectionService } from './whoop-connection.service';
import { WhoopExceptionFilter } from './whoop-exception.filter';
import { WhoopSyncService } from './whoop-sync.service';

@UseFilters(WhoopExceptionFilter)
@Controller('whoop')
export class WhoopController {
  constructor(
    private readonly connection: WhoopConnectionService,
    private readonly sync: WhoopSyncService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  connect(@CurrentUser() user: AuthenticatedUser) {
    return this.connection.createAuthorization(user.userId);
  }

  @Get('callback')
  callback(@Query() query: WhoopCallbackQueryDto) {
    return this.connection.completeAuthorization({
      state: query.state,
      ...(query.code ? { code: query.code } : {}),
      ...(query.error ? { error: query.error } : {})
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.connection.getStatus(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  syncToday(@CurrentUser() user: AuthenticatedUser) {
    return this.sync.syncToday(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.connection.disconnect(user.userId);
  }
}
