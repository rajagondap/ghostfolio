import { ImportModule } from '@ghostfolio/api/app/import/import.module';
import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { TransformDataSourceInRequestModule } from '@ghostfolio/api/interceptors/transform-data-source-in-request/transform-data-source-in-request.module';
import { TransformDataSourceInResponseModule } from '@ghostfolio/api/interceptors/transform-data-source-in-response/transform-data-source-in-response.module';
import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { ExchangeRateDataModule } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { RebalancingController } from './rebalancing.controller';
import { RebalancingService } from './rebalancing.service';

@Module({
  controllers: [RebalancingController],
  exports: [RebalancingService],
  imports: [
    DataProviderModule,
    ExchangeRateDataModule,
    ImpersonationModule,
    // Provides the maximum number of activities to import of the user only
    ImportModule,
    PortfolioModule,
    PrismaModule,
    TransformDataSourceInRequestModule,
    TransformDataSourceInResponseModule
  ],
  providers: [RebalancingService]
})
export class RebalancingModule {}
