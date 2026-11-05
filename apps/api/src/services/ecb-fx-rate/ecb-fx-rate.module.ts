import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { EcbFxRateService } from './ecb-fx-rate.service';

@Module({
  imports: [PrismaModule],
  providers: [EcbFxRateService],
  exports: [EcbFxRateService]
})
export class EcbFxRateModule {}
