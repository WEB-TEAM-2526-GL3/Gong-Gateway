export interface ServiceEntity {
  id?: string;
  name?: string;
  url?: string;
  host?: string;
  port?: number;
  protocol?: string;
  path?: string;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}
