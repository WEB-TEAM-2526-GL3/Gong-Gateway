export interface IncidentCreatedNotificationPayload extends Record<
  string,
  unknown
> {
  incidentId: string;
  reason: string;
  status: 'OPEN';
  timestamp: string;
}
