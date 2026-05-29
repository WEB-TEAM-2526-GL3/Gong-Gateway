import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  CreateKongConsumerDto,
  CreateKongRouteDto,
  CreateKongServiceDto,
  UpdateKongConsumerDto,
  UpdateKongRouteDto,
  UpdateKongServiceDto,
} from './dto/index.js';
import { GatewayService } from './gateway.service.js';

@Controller('gateway')
@UseGuards(JwtAuthGuard)
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('services')
  createService(@Body() body: CreateKongServiceDto) {
    return this.gatewayService.createService(body);
  }

  @Get('services')
  listServices() {
    return this.gatewayService.listServices();
  }

  @Get('services/:id')
  getService(@Param('id') id: string) {
    return this.gatewayService.getService(id);
  }

  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() body: UpdateKongServiceDto) {
    return this.gatewayService.updateService({ ...body, id });
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteService(@Param('id') id: string) {
    return this.gatewayService.deleteService(id);
  }

  @Post('services/:serviceId/api-key')
  addServiceApiKey(
    @Param('serviceId') serviceId: string,
    @Body('apiKey') apiKey: string,
  ) {
    return this.gatewayService.addBearerTokenToService(serviceId, apiKey);
  }

  @Post('services/:serviceId/header')
  addServiceHeader(
    @Param('serviceId') serviceId: string,
    @Body('headerName') headerName: string,
    @Body('headerValue') headerValue: string,
  ) {
    return this.gatewayService.addHeaderToService(
      serviceId,
      headerName,
      headerValue,
    );
  }

  @Post('services/:serviceId/routes')
  createRoute(
    @Param('serviceId') serviceId: string,
    @Body() body: CreateKongRouteDto,
  ) {
    return this.gatewayService.createRoute(serviceId, body);
  }

  @Get('routes')
  listRoutes() {
    return this.gatewayService.listRoutes();
  }

  @Get('routes/:id')
  getRoute(@Param('id') id: string) {
    return this.gatewayService.getRoute(id);
  }

  @Patch('routes/:id')
  updateRoute(@Param('id') id: string, @Body() body: UpdateKongRouteDto) {
    return this.gatewayService.updateRoute({ ...body, id });
  }

  @Delete('routes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoute(@Param('id') id: string) {
    return this.gatewayService.deleteRoute(id);
  }

  @Post('consumers')
  createConsumer(@Body() body: CreateKongConsumerDto) {
    return this.gatewayService.createConsumer(body);
  }

  @Get('consumers')
  listConsumers() {
    return this.gatewayService.listConsumers();
  }

  @Get('consumers/:id')
  getConsumer(@Param('id') id: string) {
    return this.gatewayService.getConsumer(id);
  }

  @Patch('consumers/:id')
  updateConsumer(@Param('id') id: string, @Body() body: UpdateKongConsumerDto) {
    return this.gatewayService.updateConsumer({ ...body, id });
  }

  @Delete('consumers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConsumer(@Param('id') id: string) {
    return this.gatewayService.deleteConsumer(id);
  }

  @Post('routes/:routeId/consumers/:consumerId')
  allowConsumerForRoute(
    @Param('routeId') routeId: string,
    @Param('consumerId') consumerId: string,
  ) {
    return this.gatewayService.addConsumerToRoute(routeId, consumerId);
  }

  @Delete('routes/:routeId/consumers/:consumerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeConsumerFromRoute(
    @Param('routeId') routeId: string,
    @Param('consumerId') consumerId: string,
  ) {
    return this.gatewayService.removeConsumerFromRoute(routeId, consumerId);
  }
}
