import { Module } from '@nestjs/common';

import { ProtocolSelectorService } from './protocol-selector.service';

@Module({
  providers: [ProtocolSelectorService],
  exports: [ProtocolSelectorService]
})
export class ProtocolModule {}
