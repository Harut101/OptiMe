import { Module } from '@nestjs/common';

import { AiModelRoutingModule } from '../ai-model-routing/ai-model-routing.module';
import { AiOperationLogsService } from './ai-operation-logs.service';
import { AiRequestTelemetryService } from './ai-request-telemetry.service';

@Module({
  imports: [AiModelRoutingModule],
  providers: [AiOperationLogsService, AiRequestTelemetryService],
  exports: [AiOperationLogsService, AiRequestTelemetryService]
})
export class AiOperationLogsModule {}
