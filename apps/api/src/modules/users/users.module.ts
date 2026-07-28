import { Module } from '@nestjs/common';

import { WhoopModule } from '../health/whoop/whoop.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [WhoopModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
