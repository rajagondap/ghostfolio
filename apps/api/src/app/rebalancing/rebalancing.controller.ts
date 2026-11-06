import { HasPermission } from '@ghostfolio/api/decorators/has-permission.decorator';
import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import { TransformDataSourceInRequestInterceptor } from '@ghostfolio/api/interceptors/transform-data-source-in-request/transform-data-source-in-request.interceptor';
import { TransformDataSourceInResponseInterceptor } from '@ghostfolio/api/interceptors/transform-data-source-in-response/transform-data-source-in-response.interceptor';
import {
  CalculateRebalancingDto,
  CreateRebalancingModelDto,
  UpdateRebalancingModelDto
} from '@ghostfolio/common/dtos';
import {
  RebalancingCalculationResponse,
  RebalancingModel,
  RebalancingModelsResponse
} from '@ghostfolio/common/interfaces';
import { isRestrictedView, permissions } from '@ghostfolio/common/permissions';
import { scopes } from '@ghostfolio/common/scopes';
import type {
  ImpersonationContext,
  RequestWithUser
} from '@ghostfolio/common/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Put,
  UseInterceptors
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

import { RebalancingService } from './rebalancing.service';

@Controller('rebalancing')
export class RebalancingController {
  public constructor(
    private readonly rebalancingService: RebalancingService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  @HasPermission(permissions.readRebalancingModels)
  @Post('calculate')
  @RequiresScope(scopes.rebalancingRead)
  @UseInterceptors(TransformDataSourceInRequestInterceptor)
  @UseInterceptors(TransformDataSourceInResponseInterceptor)
  public async calculate(
    @Body() calculateRebalancingDto: CalculateRebalancingDto,
    @Impersonation() { userId }: ImpersonationContext
  ): Promise<RebalancingCalculationResponse> {
    if (isRestrictedView(this.request.user)) {
      // The trades consist of absolute values, which the restricted view hides
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.rebalancingService.calculate({
      calculateRebalancingDto,
      userId,
      user: this.request.user
    });
  }

  @HasPermission(permissions.createRebalancingModel)
  @Post()
  @RequiresScope(scopes.rebalancingCreate)
  @UseInterceptors(TransformDataSourceInRequestInterceptor)
  public async createRebalancingModel(
    @Body() createRebalancingModelDto: CreateRebalancingModelDto,
    @Impersonation() { userId }: ImpersonationContext
  ): Promise<RebalancingModel> {
    return this.rebalancingService.create({
      createRebalancingModelDto,
      userId
    });
  }

  @Delete(':id')
  @HasPermission(permissions.deleteRebalancingModel)
  @RequiresScope(scopes.rebalancingDelete)
  public async deleteRebalancingModel(
    @Impersonation() { userId }: ImpersonationContext,
    @Param('id') id: string
  ): Promise<void> {
    return this.rebalancingService.remove({ id, userId });
  }

  @Get(':id')
  @HasPermission(permissions.readRebalancingModels)
  @RequiresScope(scopes.rebalancingRead)
  @UseInterceptors(TransformDataSourceInResponseInterceptor)
  public async getRebalancingModel(
    @Impersonation() { userId }: ImpersonationContext,
    @Param('id') id: string
  ): Promise<RebalancingModel> {
    return this.rebalancingService.findOne({ id, userId });
  }

  @Get()
  @HasPermission(permissions.readRebalancingModels)
  @RequiresScope(scopes.rebalancingRead)
  @UseInterceptors(TransformDataSourceInResponseInterceptor)
  public async getRebalancingModels(
    @Impersonation() { userId }: ImpersonationContext
  ): Promise<RebalancingModelsResponse> {
    const models = await this.rebalancingService.findAll({ userId });

    return { models };
  }

  @HasPermission(permissions.updateRebalancingModel)
  @Put(':id')
  @RequiresScope(scopes.rebalancingUpdate)
  @UseInterceptors(TransformDataSourceInRequestInterceptor)
  public async updateRebalancingModel(
    @Body() updateRebalancingModelDto: UpdateRebalancingModelDto,
    @Impersonation() { userId }: ImpersonationContext,
    @Param('id') id: string
  ): Promise<RebalancingModel> {
    return this.rebalancingService.update({
      id,
      updateRebalancingModelDto,
      userId
    });
  }
}
