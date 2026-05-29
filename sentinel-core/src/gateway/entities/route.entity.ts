export interface RouteEntity {
  id?: string;
  name?: string;
  paths?: string[];
  hosts?: string[];
  methods?: string[];
  stripPath?: boolean;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}
