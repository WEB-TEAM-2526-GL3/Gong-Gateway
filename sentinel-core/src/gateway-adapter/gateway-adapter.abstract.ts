import type {
  KongApiKey,
  KongConsumer,
  KongNodeInfo,
  KongPlugin,
  KongRoute,
  KongService,
} from './kong/kong-adapter.types';

// not used yet, but will be useful when we support multiple gateway types in the future
// not yet decoupled from Kong
export abstract class GatewayAdapter {
  abstract init(): Promise<void>;

  abstract createService(name: string, url: string): Promise<KongService>;
  abstract getService(name: string): Promise<KongService>;
  abstract listServices(): Promise<KongService[]>;
  abstract deleteService(name: string): Promise<void>;
  abstract updateServiceUrl(name: string, newUrl: string): Promise<void>;

  abstract createRoute(
    serviceName: string,
    paths: string[],
    options?: {
      stripPath?: boolean;
      methods?: string[];
      hosts?: string[];
      name?: string;
    },
  ): Promise<KongRoute>;
  abstract listRoutes(serviceName?: string): Promise<KongRoute[]>;
  abstract getRoute(routeIdOrName: string): Promise<KongRoute>;
  abstract updateRoute(
    routeIdOrName: string,
    options: {
      name?: string;
      paths?: string[];
      stripPath?: boolean;
      methods?: string[];
      hosts?: string[];
    },
  ): Promise<KongRoute>;
  abstract deleteRoute(routeIdOrName: string): Promise<void>;

  abstract createConsumer(username: string): Promise<KongConsumer>;
  abstract createApiKey(
    consumerUsername: string,
    key?: string,
  ): Promise<KongApiKey>;
  abstract enableKeyAuth(serviceName: string): Promise<void>;

  abstract ping(): Promise<KongNodeInfo>;

  abstract addPluginToService(
    serviceName: string,
    plugin: {
      name: string;
      config?: Record<string, unknown>;
    },
  ): Promise<KongPlugin>;
  abstract listPlugins(serviceName?: string): Promise<KongPlugin[]>;
  abstract deletePlugin(pluginId: string): Promise<void>;
}
