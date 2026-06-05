import { Module } from '@nestjs/common';

import { AiOperationLogsService } from './ai-operation-logs.service';

@Module({
  providers: [AiOperationLogsService],
  exports: [AiOperationLogsService]
})
export class AiOperationLogsModule {}
