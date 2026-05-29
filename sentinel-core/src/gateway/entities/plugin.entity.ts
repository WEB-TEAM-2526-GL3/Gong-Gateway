export interface PluginEntity {
  id?: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}
