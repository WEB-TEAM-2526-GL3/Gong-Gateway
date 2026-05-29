# Incident Module

## What `IncidentModule` Exports

`IncidentModule` exports the services other modules need to record incidents:

- `IncidentService`

## What It Does

`IncidentModule` is the incident-handling boundary for the application.
It receives domain events and records incidents.

It does not detect anomalies itself. It reacts to events from other modules.

### `IncidentService`

Use this service when you need to turn a domain signal into an incident record.

It is responsible for:

- Listening to operational events from other modules
- Creating incident records
- Emitting `incident.created`

## Public API

### `IncidentService`

- `getIncidents(clientId)` — Returns the incident history for a client
- `getIncidents()` — Returns the full incident history

## Events Consumed

`IncidentService` listens to domain events emitted by other modules.

- `monitoring.threshold.exceeded` — Creates incidents when monitoring detects a breached threshold

## Events Emitted

`IncidentService` emits one domain event after an incident is stored:

- `incident.created` — Payload is the saved incident record

## How Other Modules Should Use It

- Emit monitoring or health events when you want the incident module to record them.
- Subscribe to `incident.created` if you need to react after an incident is persisted.
- Use `IncidentService` only for incident history and event-driven incident creation.

## Notes

- Incident records are append-only in the current design.
- Incident records use the shared generic CRUD service.
- The monitoring module now bridges into incidents through events instead of direct coupling.
