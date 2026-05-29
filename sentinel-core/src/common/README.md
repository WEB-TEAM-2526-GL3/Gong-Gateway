# Common Module

## Purpose

`CommonModule` contains small cross-cutting helpers that can be shared by other
modules. It is marked as a global Nest module, although it currently registers no
providers.

## Key Files

| File | Role |
| --- | --- |
| `common.module.ts` | Global module placeholder. |
| `generic.service.ts` | Generic TypeORM CRUD helper used by several services. |
| `notification.service.ts` | Logging-only notification stub for future integrations. |
| `sanitize.ts` | Utility for creating Kong-safe names. |

## GenericService

`GenericService<T, ID>` wraps a TypeORM repository and provides common data
operations:

- `findAll`
- `create`
- `createMany`
- `findOne`
- `findOneNullable`
- `findBy`
- `findOneBy`
- `count`
- `update`
- `softdelete`
- `restore`
- `delete`
- `exists`
- `paginate`

It is currently extended by:

- `UsersService`
- `IncidentsService`

## NotificationService

`NotificationService.notify()` accepts:

```ts
{
  type: string;
  payload: any;
}
```

Current behavior is only a Nest logger message. It does not send real email,
Slack, Discord, or webhook notifications.

## Sanitizer

`sanitizeKongName(raw)` transforms a string into a Kong-friendly identifier:

- lowercases
- replaces non-alphanumeric characters with `-`
- collapses repeated dashes
- trims leading and trailing dashes

## Inputs And Outputs

This module has no HTTP API. It provides code-level helpers only.

Inputs are method parameters from other modules. Outputs are returned values,
database operations performed through TypeORM, or log messages.
