export const INCIDENT_CREATED_EVENT = 'incident.created' as const;

export interface IncidentCreatedEvent {
  id: string;
  reason: 'dead' | 'requestLimit' | 'tokenLimit';
  timestamp: Date;
}
