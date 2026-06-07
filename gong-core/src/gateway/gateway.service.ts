import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { client as kongClient } from './kong-client/client.gen.js';
import type {
  Services as KongService,
  Routes as KongRoute,
  Consumers as KongConsumer,
  Plugins as KongPlugin,
} from './kong-client/types.gen.js';
import type {
  CreateKongConsumerDto,
  UpdateKongConsumerDto,
  CreateKongRouteDto,
  UpdateKongRouteDto,
  CreateKongServiceDto,
  UpdateKongServiceDto,
} from './dto/index.ts';

export interface KongAuthConsumer {
  consumer: KongConsumer;
  apiKey: string;
}

@Injectable()
export class GatewayService {
  private async raw<T>(opts: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    path?: Record<string, unknown>;
    body?: unknown;
  }): Promise<T> {
    try {
      const res = await kongClient.request<T, unknown, true, 'fields'>({
        method: opts.method,
        url: opts.url,
        path: opts.path,
        body: opts.body,
        responseStyle: 'fields',
        throwOnError: true,
      });

      return res.data as T;
    } catch (err: unknown) {
      throw new HttpException(
        { message: 'Kong request failed', detail: (err as Error).message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Services
  async createService(body: CreateKongServiceDto): Promise<KongService> {
    const service = await this.raw<KongService>({
      method: 'POST',
      url: '/services',
      body: {
        name: body.name,
        url: body.url,
      },
    });

    if (!body.route) {
      return service;
    }

    await this.createRoute(service.name ?? body.name, body.route);

    return service;
  }

  getService(id: string): Promise<KongService> {
    return this.raw<KongService>({
      method: 'GET',
      url: '/services/{services}',
      path: { services: id },
    });
  }

  async listServices(): Promise<KongService[]> {
    const result = await this.raw<{ data: KongService[] }>({
      method: 'GET',
      url: '/services',
    });

    return result.data ?? [];
  }

  updateService(body: UpdateKongServiceDto): Promise<KongService> {
    return this.raw<KongService>({
      method: 'PATCH',
      url: '/services/{services}',
      path: { services: body.id },
      body: {
        url: body.url,
        name: body.name,
      },
    });
  }

  deleteService(id: string): Promise<void> {
    return this.raw<void>({
      method: 'DELETE',
      url: '/services/{services}',
      path: { services: id },
    });
  }

  addHeaderToService(
    serviceId: string,
    headerName: string,
    headerValue: string,
  ): Promise<KongPlugin> {
    return this.raw<KongPlugin>({
      method: 'POST',
      url: '/services/{services}/plugins',
      path: { services: serviceId },
      body: {
        name: 'request-transformer',
        config: {
          add: {
            headers: [`${headerName}: ${headerValue}`],
          },
        },
      },
    });
  }

  addBearerTokenToService(
    serviceId: string,
    bearerToken: string,
  ): Promise<KongPlugin> {
    return this.addHeaderToService(
      serviceId,
      'Authorization',
      `Bearer ${bearerToken}`,
    );
  }

  // Routes
  createRoute(
    serviceName: string,
    body: CreateKongRouteDto,
  ): Promise<KongRoute> {
    return this.raw<KongRoute>({
      method: 'POST',
      url: '/services/{services}/routes',
      path: { services: serviceName },
      body: {
        hosts: body.hosts,
        methods: body.methods,
        name: body.name,
        paths: body.paths,
        strip_path: body.stripPath,
      },
    });
  }

  getRoute(id: string): Promise<KongRoute> {
    return this.raw<KongRoute>({
      method: 'GET',
      url: '/routes/{routes}',
      path: { routes: id },
    });
  }

  async listRoutes(): Promise<KongRoute[]> {
    const result = await this.raw<{ data: KongRoute[] }>({
      method: 'GET',
      url: '/routes',
    });

    return result.data ?? [];
  }

  updateRoute(body: UpdateKongRouteDto): Promise<KongRoute> {
    return this.raw<KongRoute>({
      method: 'PATCH',
      url: '/routes/{routes}',
      path: { routes: body.id },
      body: {
        hosts: body.hosts,
        methods: body.methods,
        name: body.name,
        paths: body.paths,
        strip_path: body.stripPath,
      },
    });
  }

  deleteRoute(id: string): Promise<void> {
    return this.raw<void>({
      method: 'DELETE',
      url: '/routes/{routes}',
      path: { routes: id },
    });
  }

  async protectRouteWithAcl(routeId: string): Promise<KongPlugin> {
    const group = this.routeAclGroup(routeId);

    const result = await this.raw<{
      data: Array<{ name?: string; config?: { allow?: string[] } }>;
    }>({
      method: 'GET',
      url: '/routes/{routes}/plugins',
      path: { routes: routeId },
    });

    let existing: KongPlugin | undefined;

    for (const plugin of result.data ?? []) {
      if (plugin.name === 'acl' && plugin.config?.allow?.includes(group)) {
        existing = plugin as KongPlugin;
        break;
      }
    }

    if (existing) {
      return existing;
    }

    return this.raw<KongPlugin>({
      method: 'POST',
      url: '/routes/{routes}/plugins',
      path: { routes: routeId },
      body: {
        name: 'acl',
        config: {
          allow: [group],
        },
      },
    });
  }

  async addConsumerToRoute(routeId: string, consumerId: string): Promise<void> {
    await this.protectRouteWithAcl(routeId);

    await this.raw<void>({
      method: 'POST',
      url: '/consumers/{consumers}/acls',
      path: { consumers: consumerId },
      body: {
        group: this.routeAclGroup(routeId),
      },
    });
  }

  async removeConsumerFromRoute(
    routeId: string,
    consumerId: string,
  ): Promise<void> {
    const group = this.routeAclGroup(routeId);

    const result = await this.raw<{
      data: Array<{ id?: string; group?: string }>;
    }>({
      method: 'GET',
      url: '/consumers/{consumers}/acls',
      path: { consumers: consumerId },
    });

    const aclId = result.data?.find((acl) => acl.group === group)?.id;

    if (!aclId) {
      return;
    }

    await this.raw<void>({
      method: 'DELETE',
      url: '/consumers/{consumers}/acls/{acls}',
      path: {
        consumers: consumerId,
        acls: aclId,
      },
    });
  }

  private routeAclGroup(routeId: string): string {
    return `route_${routeId}`;
  }

  // Consumers
  async createConsumer(body: CreateKongConsumerDto): Promise<KongAuthConsumer> {
    const payload: Record<string, unknown> = { username: body.username };
    const customId = body.customId;
    if (customId) payload.custom_id = customId;
    if (body.tags) payload.tags = body.tags;
    const consumer = await this.raw<KongConsumer>({
      method: 'POST',
      url: '/consumers',
      body: payload,
    });

    const apiKeyResult = await this.raw<{ key: string }>({
      method: 'POST',
      url: '/consumers/{consumers}/key-auth',
      path: { consumers: consumer.username ?? body.username },
    });

    return {
      consumer,
      apiKey: apiKeyResult.key,
    };
  }

  async getConsumer(id: string): Promise<KongAuthConsumer> {
    const consumer = await this.raw<KongConsumer>({
      method: 'GET',
      url: '/consumers/{consumers}',
      path: { consumers: id },
    });

    const apiKeys = await this.raw<{ data: Array<{ key?: string }> }>({
      method: 'GET',
      url: '/consumers/{consumers}/key-auth',
      path: { consumers: id },
    });

    return {
      consumer,
      apiKey: apiKeys.data[0]?.key ?? '',
    };
  }

  async listConsumers(): Promise<KongAuthConsumer[]> {
    const consumers = await this.raw<{ data: KongConsumer[] }>({
      method: 'GET',
      url: '/consumers',
    });

    return Promise.all(
      (consumers.data ?? []).map((consumer) =>
        consumer.username
          ? this.getConsumer(consumer.id ?? consumer.username ?? '')
          : Promise.resolve({ consumer, apiKey: '' }),
      ),
    );
  }

  async updateConsumer(body: UpdateKongConsumerDto): Promise<KongAuthConsumer> {
    const consumerId = body.id;
    const payload: Record<string, unknown> = { username: body.username };
    const customId = body.customId;
    if (customId) payload.custom_id = customId;

    await this.raw<KongConsumer>({
      method: 'PATCH',
      url: '/consumers/{consumers}',
      path: { consumers: consumerId },
      body: payload,
    });

    return this.getConsumer(consumerId);
  }

  deleteConsumer(id: string): Promise<void> {
    return this.raw<void>({
      method: 'DELETE',
      url: '/consumers/{consumers}',
      path: { consumers: id },
    });
  }
}
