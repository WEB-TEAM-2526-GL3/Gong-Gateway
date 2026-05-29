# Users Module

## Purpose

`UsersModule` owns admin user persistence and user status changes. It is an
internal module consumed by `AuthModule`; it does not expose its own HTTP
controller.

## Key Files

| File | Role |
| --- | --- |
| `users.module.ts` | Registers the TypeORM repository and exports `UsersService`. |
| `users.service.ts` | Creates admin users and updates active/inactive status. |
| `entities/user.entity.ts` | TypeORM `users` table. |
| `dto/create-admin-user.input.ts` | Internal input shape for user creation. |
| `enum/user-role.enum.ts` | User role enum. |
| `enum/user-status.enum.ts` | User status enum. |

## Public Service API

`UsersService` extends `GenericService<UserEntity, string>` and adds:

| Method | Input | Output |
| --- | --- | --- |
| `createAdminUser(input)` | `{ email, fullName, passwordHash }` | Created active admin user. |
| `updateStatus(id, status)` | User id and `ACTIVE` or `INACTIVE` | Updated user or `null`. |
| `deactivateUser(id)` | User id | User with status `INACTIVE` or `null`. |
| `reactivateUser(id)` | User id | User with status `ACTIVE` or `null`. |

Inherited generic methods include `findAll`, `findOne`, `findOneBy`, `create`,
`update`, `delete`, and pagination helpers.

## Entity

Table: `users`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key generated in `UsersService`. |
| `email` | string | Unique. |
| `fullName` | string | Stored as `full_name`. |
| `passwordHash` | string | Stored as `password_hash`. |
| `role` | enum | Currently only `ADMIN`. |
| `status` | enum | `ACTIVE` or `INACTIVE`. |
| `createdAt` | timestamp | Created automatically. |
| `updatedAt` | timestamp | Updated automatically. |

## Functionality

- Rejects duplicate emails with `409 Conflict`.
- Creates only admin users.
- New users are active by default.
- Deactivation and reactivation are status updates, not physical deletes.

## Inputs And Outputs

This module receives already-hashed passwords from `AuthService`.
It returns full `UserEntity` objects to internal callers. Controllers using this
module should remove `passwordHash` before returning data to clients.
