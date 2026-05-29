# Gateway Module

## Purpose

`GatewayModule` is Sentinel's control surface for Kong. It exposes JWT-protected
REST endpoints that create and manage Kong services, routes, consumers, headers,
API keys, and route-level consumer access.

This module does not proxy traffic itself. Real traffic goes through Kong on
port `8000`; this module talks to Kong Admin API on port `8001`.

## Key Files

| File | Role |
| --- | --- |
| `gateway.module.ts` | Registers the controller and service. |
| `gateway.controller.ts` | Exposes the `/gateway` REST API. |
| `gateway.service.ts` | Calls Kong Admin API through the generated client. |
| `dto/*.ts` | Input contracts for services, routes, consumers, and plugins. |
| `entities/*.ts` | TypeScript interface shapes for Kong resources. |
| `kong-client/` | Generated OpenAPI client for Kong Admin API. |

## HTTP API

Base path: `/gateway`

All routes require:

```http
Authorization: Bearer <accessToken>
```

### Services

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| `POST` | `/services` | `{ name, url, route? }` | Created Kong service. |
| `GET` | `/services` | None | Array of Kong services. |
| `GET` | `/services/:id` | Path id/name | Kong service. |
| `PATCH` | `/services/:id` | `{ name?, url?, route? }` | Updated Kong service. |
| `DELETE` | `/services/:id` | Path id/name | `204 No Content`. |
| `POST` | `/services/:serviceId/api-key` | `{ apiKey }` | Kong request-transformer plugin. |
| `POST` | `/services/:serviceId/header` | `{ headerName, headerValue }` | Kong request-transformer plugin. |

If `POST /services` receives a nested `route`, the service is created first and
then a route is created for it.

### Routes

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| `POST` | `/services/:serviceId/routes` | `{ name?, paths, stripPath?, methods?, hosts? }` | Created Kong route. |
| `GET` | `/routes` | None | Array of Kong routes. |
| `GET` | `/routes/:id` | Path id/name | Kong route. |
| `PATCH` | `/routes/:id` | Route update fields | Updated Kong route. |
| `DELETE` | `/routes/:id` | Path id/name | `204 No Content`. |

### Consumers And Route Access

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| `POST` | `/consumers` | `{ username, customId?, tags? }` | `{ consumer, apiKey }`. |
| `GET` | `/consumers` | None | Array of `{ consumer, apiKey }`. |
| `GET` | `/consumers/:id` | Path id/name | `{ consumer, apiKey }`. |
| `PATCH` | `/consumers/:id` | `{ username?, customId?, tags? }` | Updated `{ consumer, apiKey }`. |
| `DELETE` | `/consumers/:id` | Path id/name | `204 No Content`. |
| `POST` | `/routes/:routeId/consumers/:consumerId` | None | Adds ACL group access. |
| `DELETE` | `/routes/:routeId/consumers/:consumerId` | None | Removes ACL group access. |

Consumer creation also creates a Kong `key-auth` credential and returns the key.

## Functionality

- Wraps Kong Admin API calls behind `GatewayService.raw()`.
- Converts Nest DTO field names to Kong payload names, for example `stripPath`
  to `strip_path`.
- Adds service headers using Kong `request-transformer` plugins.
- Adds bearer tokens by adding an `Authorization: Bearer <token>` header plugin.
- Protects routes with Kong ACL plugins and consumer ACL group membership.
- Converts Kong errors into `400 Bad Request` responses with a generic
  `Kong request failed` message and the original error detail.

## Persistence

This module has no Sentinel database tables. The source of truth for resources
created here is Kong's database.

## External Dependency

The generated client currently uses:

```text
http://localhost:8001
```

as the Kong Admin API base URL.

## Notes

Some older repository docs and HTTP examples still mention `/kong/...`.
The implemented controller path in the current code is `/gateway/...`.
