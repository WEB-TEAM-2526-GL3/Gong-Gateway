import { Body, Controller, Get, Post } from '@nestjs/common';
import { KongAdapterService } from './kong-adapter.service';

@Controller('kong')
export class KongController {
  constructor(private readonly kong: KongAdapterService) {}

  @Get('health')
  async health() {
    return this.kong.ping();
  }

  @Get('services')
  async listServices() {
    return this.kong.listServices();
  }

  @Post('services')
  async createService(@Body() body: { name: string; url: string }) {
    return this.kong.createService(body.name, body.url);
  }

  @Post('routes')
  async createRoute(
    @Body()
    body: {
      serviceName: string;
      paths: string[];
      name?: string;
      stripPath?: boolean;
      methods?: string[];
      hosts?: string[];
    },
  ) {
    return this.kong.createRoute(body.serviceName, body.paths, {
      name: body.name,
      stripPath: body.stripPath,
      methods: body.methods,
      hosts: body.hosts,
    });
  }

  @Post('init')
  async init() {
    await this.kong.init();
    return {
      message: 'Kong initialized successfully',
    };
  }
}
