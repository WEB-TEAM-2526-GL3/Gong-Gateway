import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface WebhookResponseBody {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  hasSecret: boolean;
  maxRetries: number;
  secret?: string;
}

interface ListResponseBody<T> {
  data: T[];
}

interface EmitResponseBody {
  eventType: string;
  matchedWebhooks: number;
  deliveries: unknown[];
}

describe('WebhooksController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /webhooks creates a webhook without exposing the secret', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks')
      .send({
        name: 'Slack Incidents',
        url: 'https://hooks.slack.com/services/xxx',
        eventTypes: ['INCIDENT_CREATED', 'INCIDENT_RESOLVED'],
        isActive: true,
        secret: 'optional-hmac-secret',
        maxRetries: 3,
      })
      .expect(201);

    const body = response.body as WebhookResponseBody;

    expect(body).toMatchObject({
      id: 'wh_001',
      name: 'Slack Incidents',
      url: 'https://hooks.slack.com/services/xxx',
      eventTypes: ['INCIDENT_CREATED', 'INCIDENT_RESOLVED'],
      isActive: true,
      hasSecret: true,
      maxRetries: 3,
    });
    expect(body.secret).toBeUndefined();
  });

  it('GET /webhooks lists webhooks with query filters', async () => {
    await request(app.getHttpServer())
      .post('/webhooks')
      .send({
        name: 'Budget Alerts',
        url: 'https://example.com/webhook',
        eventTypes: ['BUDGET_WARNING'],
        isActive: true,
      });

    const response = await request(app.getHttpServer())
      .get('/webhooks?isActive=true&eventType=BUDGET_WARNING')
      .expect(200);

    const body = response.body as ListResponseBody<WebhookResponseBody>;

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: 'wh_001',
      name: 'Budget Alerts',
      eventTypes: ['BUDGET_WARNING'],
      isActive: true,
      hasSecret: false,
    });
  });

  it('GET /webhooks/event-types returns supported event types', async () => {
    const response = await request(app.getHttpServer())
      .get('/webhooks/event-types')
      .expect(200);

    const body = response.body as ListResponseBody<string>;

    expect(body.data).toEqual(
      expect.arrayContaining([
        'INCIDENT_CREATED',
        'INCIDENT_ACKNOWLEDGED',
        'INCIDENT_RESOLVED',
        'FALLBACK_ACTIVATED',
        'PROVIDER_DOWN',
        'PROVIDER_RECOVERED',
        'BUDGET_WARNING',
        'BUDGET_EXCEEDED',
        'ERROR_RATE_HIGH',
        'ADMIN_ACTION',
      ]),
    );
  });

  it('POST /webhooks/emit returns zero matches when no webhook is subscribed', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/emit')
      .send({
        eventType: 'INCIDENT_CREATED',
        source: 'IncidentModule',
        payload: {
          incidentId: 'inc_001',
          reason: 'OpenAI timeout',
          status: 'OPEN',
        },
      })
      .expect(200);

    const body = response.body as EmitResponseBody;

    expect(body).toEqual({
      eventType: 'INCIDENT_CREATED',
      matchedWebhooks: 0,
      deliveries: [],
    });
  });

  it('DELETE /webhooks/:id deactivates a webhook', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/webhooks')
      .send({
        name: 'Incident Notifications',
        url: 'https://example.com/incidents',
        eventTypes: ['INCIDENT_CREATED'],
        isActive: true,
      })
      .expect(201);

    const createdWebhook = createResponse.body as WebhookResponseBody;

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/webhooks/${createdWebhook.id}`)
      .expect(200);

    const deletedWebhook = deleteResponse.body as WebhookResponseBody;

    expect(deletedWebhook).toMatchObject({
      id: createdWebhook.id,
      isActive: false,
    });

    const listResponse = await request(app.getHttpServer())
      .get('/webhooks?isActive=true')
      .expect(200);

    const listBody = listResponse.body as ListResponseBody<WebhookResponseBody>;

    expect(listBody.data).toHaveLength(0);
  });
});
