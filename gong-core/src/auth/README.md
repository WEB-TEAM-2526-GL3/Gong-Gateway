# Auth Module

## Purpose

`AuthModule` owns Gong admin authentication. It creates admin users, validates
credentials, signs JWT access tokens, protects authenticated routes, and validates
the CEO secret used for sensitive admin actions.

## Key Files

| File                    | Role                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `auth.module.ts`        | Registers JWT, Passport, controller, strategy, and services.       |
| `auth.controller.ts`    | Exposes the `/auth` HTTP API.                                      |
| `auth.service.ts`       | Implements register, login, logout, and JWT response creation.     |
| `jwt.strategy.ts`       | Validates Bearer tokens and loads active users from the database.  |
| `jwt-auth.guard.ts`     | Reusable Nest guard for JWT-protected routes.                      |
| `ceo-secret.service.ts` | Constant-time validation for `CEO_SECRET`.                         |
| `dto/*.ts`              | Validated input contracts for register, login, and admin deletion. |
| `interfaces/*.ts`       | JWT payload and authenticated request user shapes.                 |

## HTTP API

Base path: `/auth`

| Method   | Path          | Auth | Input                                      | Output                                          |
| -------- | ------------- | ---- | ------------------------------------------ | ----------------------------------------------- |
| `POST`   | `/register`   | No   | `{ email, fullName, password, ceoSecret }` | JWT auth response and public user data.         |
| `POST`   | `/login`      | No   | `{ email, password }`                      | JWT auth response and public user data.         |
| `GET`    | `/me`         | JWT  | None                                       | Current authenticated user from the token.      |
| `POST`   | `/logout`     | JWT  | None                                       | Message telling the client to remove the token. |
| `GET`    | `/admins`     | JWT  | None                                       | List of safe admin user records.                |
| `DELETE` | `/admins/:id` | JWT  | `{ ceoSecret }`                            | Deactivates another admin account.              |

The auth response shape is:

```json
{
  "accessToken": "jwt",
  "tokenType": "Bearer",
  "expiresIn": "100h",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "fullName": "Admin",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

## Functionality

- Registration requires a valid `CEO_SECRET`.
- Passwords are hashed with `bcrypt` before persistence.
- Login rejects missing users, inactive users, and invalid passwords.
- JWT payload contains user id, email, full name, and role.
- `JwtStrategy` rejects tokens for missing or inactive users.
- Admin deletion is a deactivation, not a physical delete.
- A logged-in admin cannot deactivate their own account.

## Dependencies

- Uses `UsersService` from `UsersModule` for persistence.
- Uses `@nestjs/jwt` and `passport-jwt` for token auth.
- Reads `JWT_SECRET`, `JWT_EXPIRES_IN`, and `CEO_SECRET` from environment.

## Persistence

This module persists through the `users` table owned by `UsersModule`.
It does not store sessions. JWT logout is client-side only.

## Notes

All protected endpoints expect:

```http
Authorization: Bearer <accessToken>
```

`CEO_SECRET` must be configured, otherwise CEO-secret validation throws an
application error.
