# Incidents Module

## Purpose

`IncidentsModule` owns incident records, incident logs, the incident lifecycle,
the incident SSE stream, and the realtime Socket.IO incident room.

It can create incidents directly through REST or automatically when the
monitoring module emits a threshold event.

## Key Files

| File | Role |
| --- | --- |
| `incidents.module.ts` | Registers entities, controller, service, and Socket.IO gateway. |
| `incidents.controller.ts` | Exposes REST and SSE endpoints under `/incidents`. |
| `incidents.service.ts` | Creates incidents, stores logs, handles status changes, listens to monitoring events. |
| `incident-room.gateway.ts` | Socket.IO namespace for room join, presence, chat, acknowledge, and resolve. |
| `entities/incident.entity.ts` | TypeORM `incidents` table. |
| `entities/incident-log.entity.ts` | TypeORM `incident_logs` table. |
| `dto/*.ts` | Validated REST and Socket.IO input contracts. |
| `enum/*.ts` | Incident status, severity, and log action enums. |

## REST API

Base path: `/incidents`

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| `POST` | `/` | `{ serviceId, providerId, severity, reason, adminId, adminName }` | Incident snapshot. |
| `GET` | `/` | Optional query `{ status }` | Array of incidents. |
| `GET` | `/:id` | Path id | Incident snapshot. |
| `GET` | `/sse` | SSE connection | `incident-created` server events. |

An incident snapshot is:

```ts
{
  incident: IncidentEntity;
  logs: IncidentLogEntity[];
}
```

## Socket.IO API

Namespace:

```text
/incident-room
```

### Client Events

| Event | Payload | Behavior |
| --- | --- | --- |
| `joinIncident` | `{ incidentId, adminId, adminName }` | Joins the incident room, stores presence, returns snapshot. |
| `leaveIncident` | `{ incidentId, adminId }` | Leaves the room and removes presence. |
| `sendMessage` | `{ incidentId, adminId, adminName, message }` | Appends a message log and broadcasts it. |
| `ackIncident` | `{ incidentId, adminId, adminName, notes? }` | Sets status to `ACKNOWLEDGED` and broadcasts snapshot. |
| `resolveIncident` | `{ incidentId, adminId, adminName, notes? }` | Sets status to `RESOLVED` and broadcasts snapshot. |

### Server Events

| Event | Payload |
| --- | --- |
| `incidentJoined` | Incident snapshot plus `presence`. |
| `presenceUpdated` | `{ incidentId, admins }`. |
| `incidentMessage` | New `IncidentLogEntity`. |
| `incidentUpdated` | Updated incident snapshot. |
| `incidentError` | `{ incidentId, message }`. |

## Events

### Consumed

`IncidentsService` listens for:

```text
monitoring.threshold.exceeded
```

When received, it creates a system-owned incident.

### Emitted

After an incident is created, the service emits:

```text
incident.created
```

Payload:

```ts
{
  id: string;
  reason: string;
  timestamp: Date;
}
```

The SSE endpoint and the webhook listener consume this event.

## Persistence

### `incidents`

Stores:

- `id`
- `serviceId`
- `providerId`
- `severity`
- `reason`
- `status`
- `createdAt`
- `updatedAt`
- `resolvedAt`

### `incident_logs`

Stores:

- `id`
- `incidentId`
- `adminId`
- `adminName`
- `action`
- `details`
- `createdAt`

Logs are append-style records for created, message, acknowledged, and resolved
actions.

## Notes

- Current REST and Socket.IO incident endpoints are not protected with JWT in
  the code.
- Socket presence is in memory and resets when the backend restarts.
- The service currently allows resolving any non-missing incident; it does not
  enforce a strict status transition guard beyond setting the new status.
