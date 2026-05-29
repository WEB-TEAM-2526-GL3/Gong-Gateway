import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

import { UserRole } from '../users/enum/user-role.enum';
import { UserStatus } from '../users/enum/user-status.enum';
import { IncidentLogAction } from '../incidents/enum/incident-log-action.enum';
import { IncidentSeverity } from '../incidents/enum/incident-severity.enum';
import { IncidentStatus } from '../incidents/enum/incident-status.enum';
import { MonitoringRuleType } from '../monitoring/entities/monitoring-rule.entity';
import { WebhookDeliveryStatus } from '../webhooks/types/webhook-delivery-status.enum';
import { WebhookEventType } from '../webhooks/types/webhook-event-type.enum';
import { WebhookProvider } from '../webhooks/types/webhook-provider.enum';

registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(UserStatus, { name: 'UserStatus' });
registerEnumType(IncidentLogAction, { name: 'IncidentLogAction' });
registerEnumType(IncidentSeverity, { name: 'IncidentSeverity' });
registerEnumType(IncidentStatus, { name: 'IncidentStatus' });
registerEnumType(MonitoringRuleType, { name: 'MonitoringRuleType' });
registerEnumType(WebhookDeliveryStatus, { name: 'WebhookDeliveryStatus' });
registerEnumType(WebhookEventType, { name: 'WebhookEventType' });
registerEnumType(WebhookProvider, { name: 'WebhookProvider' });

@ObjectType('User')
export class UserGql {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  fullName!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field(() => UserStatus, { nullable: true })
  status?: UserStatus;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt?: Date;
}

@ObjectType('AuthPayload')
export class AuthPayloadGql {
  @Field()
  accessToken!: string;

  @Field()
  tokenType!: string;

  @Field()
  expiresIn!: string;

  @Field(() => UserGql)
  user!: UserGql;
}

@InputType()
export class RegisterInput {
  @Field()
  email!: string;

  @Field()
  fullName!: string;

  @Field()
  password!: string;

  @Field()
  ceoSecret!: string;
}

@InputType()
export class LoginInput {
  @Field()
  email!: string;

  @Field()
  password!: string;
}

@ObjectType('GatewayService')
export class GatewayServiceGql {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  url?: string;

  @Field({ nullable: true })
  host?: string;

  @Field(() => Int, { nullable: true })
  port?: number;

  @Field({ nullable: true })
  protocol?: string;

  @Field({ nullable: true })
  path?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@ObjectType('GatewayRoute')
export class GatewayRouteGql {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => [String], { nullable: true })
  paths?: string[];

  @Field(() => [String], { nullable: true })
  hosts?: string[];

  @Field(() => [String], { nullable: true })
  methods?: string[];

  @Field({ nullable: true })
  stripPath?: boolean;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@ObjectType('GatewayConsumer')
export class GatewayConsumerGql {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field({ nullable: true })
  username?: string;

  @Field({ nullable: true })
  customId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field({ nullable: true })
  apiKey?: string;
}

@ObjectType('GatewayPlugin')
export class GatewayPluginGql {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  enabled?: boolean;

  @Field({ nullable: true })
  configJson?: string;
}

@InputType()
export class GatewayRouteInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => [String])
  paths!: string[];

  @Field({ nullable: true })
  stripPath?: boolean;

  @Field(() => [String], { nullable: true })
  methods?: string[];

  @Field(() => [String], { nullable: true })
  hosts?: string[];
}

@InputType()
export class GatewayRouteUpdateInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => [String], { nullable: true })
  paths?: string[];

  @Field({ nullable: true })
  stripPath?: boolean;

  @Field(() => [String], { nullable: true })
  methods?: string[];

  @Field(() => [String], { nullable: true })
  hosts?: string[];
}

@InputType()
export class GatewayServiceInput {
  @Field()
  name!: string;

  @Field()
  url!: string;

  @Field(() => GatewayRouteInput, { nullable: true })
  route?: GatewayRouteInput;
}

@InputType()
export class GatewayServiceUpdateInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  url?: string;
}

@InputType()
export class GatewayConsumerInput {
  @Field()
  username!: string;

  @Field({ nullable: true })
  customId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@InputType()
export class GatewayConsumerUpdateInput {
  @Field({ nullable: true })
  username?: string;

  @Field({ nullable: true })
  customId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@InputType()
export class AddServiceHeaderInput {
  @Field()
  headerName!: string;

  @Field()
  headerValue!: string;
}

@ObjectType('Incident')
export class IncidentGql {
  @Field(() => ID)
  id!: string;

  @Field()
  serviceId!: string;

  @Field()
  providerId!: string;

  @Field(() => IncidentSeverity)
  severity!: IncidentSeverity;

  @Field()
  reason!: string;

  @Field(() => IncidentStatus)
  status!: IncidentStatus;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt?: Date | null;
}

@ObjectType('IncidentLog')
export class IncidentLogGql {
  @Field(() => Int)
  id!: number;

  @Field()
  incidentId!: string;

  @Field()
  adminId!: string;

  @Field()
  adminName!: string;

  @Field(() => IncidentLogAction)
  action!: IncidentLogAction;

  @Field()
  detailsJson!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType('IncidentSnapshot')
export class IncidentSnapshotGql {
  @Field(() => IncidentGql)
  incident!: IncidentGql;

  @Field(() => [IncidentLogGql])
  logs!: IncidentLogGql[];
}

@InputType()
export class CreateIncidentInput {
  @Field()
  serviceId!: string;

  @Field()
  providerId!: string;

  @Field(() => IncidentSeverity)
  severity!: IncidentSeverity;

  @Field()
  reason!: string;

  @Field()
  adminId!: string;

  @Field()
  adminName!: string;
}

@InputType()
export class IncidentActionInput {
  @Field()
  incidentId!: string;

  @Field()
  adminId!: string;

  @Field()
  adminName!: string;

  @Field({ nullable: true })
  notes?: string;
}

@InputType()
export class SendIncidentMessageInput {
  @Field()
  incidentId!: string;

  @Field()
  adminId!: string;

  @Field()
  adminName!: string;

  @Field()
  message!: string;
}

@ObjectType('MonitoringRule')
export class MonitoringRuleGql {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  serviceName!: string;

  @Field(() => String, { nullable: true })
  providerId?: string | null;

  @Field(() => MonitoringRuleType)
  type!: MonitoringRuleType;

  @Field(() => Float, { nullable: true })
  errorRateThreshold?: number | null;

  @Field(() => Int, { nullable: true })
  latencyThresholdMs?: number | null;

  @Field()
  metricWindow!: string;

  @Field(() => Int)
  cooldownMinutes!: number;

  @Field()
  isActive!: boolean;

  @Field(() => IncidentSeverity)
  severity!: IncidentSeverity;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastTriggeredAt?: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('MonitoringCheckResult')
export class MonitoringCheckResultGql {
  @Field()
  ruleId!: string;

  @Field()
  ruleName!: string;

  @Field()
  serviceName!: string;

  @Field(() => MonitoringRuleType)
  type!: MonitoringRuleType;

  @Field()
  triggered!: boolean;

  @Field(() => Float)
  currentValue!: number;

  @Field(() => Float)
  threshold!: number;

  @Field({ nullable: true })
  reason?: string;

  @Field(() => GraphQLISODateTime)
  checkedAt!: Date;
}

@ObjectType('MonitoringStatusReport')
export class MonitoringStatusReportGql {
  @Field(() => GraphQLISODateTime)
  checkedAt!: Date;

  @Field(() => Int)
  totalRules!: number;

  @Field(() => Int)
  activeRules!: number;

  @Field(() => Int)
  triggeredRules!: number;

  @Field(() => [MonitoringCheckResultGql])
  results!: MonitoringCheckResultGql[];
}

@InputType()
export class CreateMonitoringRuleInput {
  @Field()
  name!: string;

  @Field()
  serviceName!: string;

  @Field({ nullable: true })
  providerId?: string;

  @Field(() => MonitoringRuleType)
  type!: MonitoringRuleType;

  @Field(() => Float, { nullable: true })
  errorRateThreshold?: number;

  @Field(() => Int, { nullable: true })
  latencyThresholdMs?: number;

  @Field({ nullable: true })
  metricWindow?: string;

  @Field(() => Int, { nullable: true })
  cooldownMinutes?: number;

  @Field(() => IncidentSeverity, { nullable: true })
  severity?: IncidentSeverity;
}

@InputType()
export class UpdateMonitoringRuleInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  serviceName?: string;

  @Field({ nullable: true })
  providerId?: string;

  @Field(() => MonitoringRuleType, { nullable: true })
  type?: MonitoringRuleType;

  @Field(() => Float, { nullable: true })
  errorRateThreshold?: number;

  @Field(() => Int, { nullable: true })
  latencyThresholdMs?: number;

  @Field({ nullable: true })
  metricWindow?: string;

  @Field(() => Int, { nullable: true })
  cooldownMinutes?: number;

  @Field(() => IncidentSeverity, { nullable: true })
  severity?: IncidentSeverity;

  @Field({ nullable: true })
  isActive?: boolean;
}

@InputType()
export class MetricsScopeInput {
  @Field({ nullable: true })
  consumerId?: string;

  @Field({ nullable: true })
  serviceId?: string;
}

@ObjectType('LatencyMetrics')
export class LatencyMetricsGql {
  @Field(() => Float)
  p50!: number;

  @Field(() => Float)
  p95!: number;

  @Field(() => Float)
  p99!: number;
}

@ObjectType('StatusCodeMetric')
export class StatusCodeMetricGql {
  @Field()
  code!: string;

  @Field(() => Float)
  count!: number;
}

@ObjectType('GatewayMetrics')
export class GatewayMetricsGql {
  @Field(() => Float)
  totalRequests!: number;

  @Field(() => Float)
  requestsPerSecond!: number;

  @Field(() => [StatusCodeMetricGql])
  statusCodes!: StatusCodeMetricGql[];

  @Field(() => LatencyMetricsGql)
  latency!: LatencyMetricsGql;
}

@ObjectType('Webhook')
export class WebhookGql {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => WebhookProvider)
  provider!: WebhookProvider;

  @Field()
  url!: string;

  @Field(() => [WebhookEventType])
  eventTypes!: WebhookEventType[];

  @Field()
  isActive!: boolean;

  @Field()
  hasSecret!: boolean;

  @Field(() => Int)
  maxRetries!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('WebhookDelivery')
export class WebhookDeliveryGql {
  @Field(() => ID)
  id!: string;

  @Field()
  webhookId!: string;

  @Field(() => WebhookEventType)
  eventType!: WebhookEventType;

  @Field({ nullable: true })
  source?: string;

  @Field()
  payloadJson!: string;

  @Field(() => WebhookDeliveryStatus)
  status!: WebhookDeliveryStatus;

  @Field(() => Int)
  attemptCount!: number;

  @Field(() => Int, { nullable: true })
  responseStatus?: number;

  @Field({ nullable: true })
  responseBody?: string;

  @Field({ nullable: true })
  error?: string;

  @Field(() => Int, { nullable: true })
  durationMs?: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  deliveredAt?: Date;
}

@ObjectType('WebhookEmitDeliverySummary')
export class WebhookEmitDeliverySummaryGql {
  @Field(() => ID)
  id!: string;

  @Field()
  webhookId!: string;

  @Field(() => WebhookDeliveryStatus)
  status!: WebhookDeliveryStatus;

  @Field(() => Int)
  attemptCount!: number;
}

@ObjectType('WebhookEmitResult')
export class WebhookEmitResultGql {
  @Field(() => WebhookEventType)
  eventType!: WebhookEventType;

  @Field(() => Int)
  matchedWebhooks!: number;

  @Field(() => [WebhookEmitDeliverySummaryGql])
  deliveries!: WebhookEmitDeliverySummaryGql[];
}

@InputType()
export class CreateWebhookInput {
  @Field()
  name!: string;

  @Field(() => WebhookProvider, { nullable: true })
  provider?: WebhookProvider;

  @Field()
  url!: string;

  @Field(() => [WebhookEventType])
  eventTypes!: WebhookEventType[];

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  secret?: string;

  @Field(() => Int, { nullable: true })
  maxRetries?: number;
}

@InputType()
export class UpdateWebhookInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => WebhookProvider, { nullable: true })
  provider?: WebhookProvider;

  @Field({ nullable: true })
  url?: string;

  @Field(() => [WebhookEventType], { nullable: true })
  eventTypes?: WebhookEventType[];

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  secret?: string;

  @Field(() => Int, { nullable: true })
  maxRetries?: number;
}

@InputType()
export class EmitWebhookEventInput {
  @Field(() => WebhookEventType)
  eventType!: WebhookEventType;

  @Field({ nullable: true })
  source?: string;

  @Field()
  payloadJson!: string;
}

@ObjectType('MessengerInboundEvent')
export class MessengerInboundEventGql {
  @Field(() => ID)
  id!: string;

  @Field({ nullable: true })
  senderId?: string;

  @Field({ nullable: true })
  recipientId?: string;

  @Field({ nullable: true })
  messageText?: string;

  @Field({ nullable: true })
  postbackPayload?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  timestamp?: Date;

  @Field(() => GraphQLISODateTime)
  receivedAt!: Date;
}

@ObjectType('MessengerRecipient')
export class MessengerRecipientGql {
  @Field()
  senderId!: string;

  @Field({ nullable: true })
  lastMessageText?: string;

  @Field(() => GraphQLISODateTime)
  lastSeenAt!: Date;
}

@ObjectType('DashboardOverview')
export class DashboardOverviewGql {
  @Field(() => UserGql)
  me!: UserGql;

  @Field(() => [IncidentGql])
  openIncidents!: IncidentGql[];

  @Field(() => MonitoringStatusReportGql, { nullable: true })
  monitoringStatus?: MonitoringStatusReportGql | null;

  @Field(() => [GatewayServiceGql])
  gatewayServices!: GatewayServiceGql[];
}
