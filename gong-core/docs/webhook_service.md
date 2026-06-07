# WebhookService

## Purpose

`WebhookService` est la facade de notification sortante de Gong Gateway.
Il centralise la configuration des webhooks, l'emission des evenements internes
vers des URLs externes, et l'historique des tentatives d'envoi.

Les autres modules ne doivent pas appeler Slack, Discord, PagerDuty ou tout autre
systeme externe directement. Ils doivent passer par `WebhookService`, soit via
l'endpoint REST principal `POST /webhooks/emit`, soit plus tard par injection du
service NestJS quand les modules seront dans la meme application.

## Role Dans L'Architecture

`WebhookService` ne gere pas les incidents, Kong, l'auth globale, les budgets ou
les providers. Il recoit des evenements metier deja construits par les autres
modules et les transmet aux webhooks actifs abonnes au type d'evenement.

Exemples de producteurs attendus :

- `IncidentModule` : incident cree, acquitte, resolu.
- `FallbackService` : fallback active, provider down, provider recovered.
- `BudgetService` : budget warning, budget exceeded.
- Business Logic Layer : actions metier ou evenements d'administration.

## Endpoint Principal

```http
POST /webhooks/emit
Content-Type: application/json
```

Request :

```json
{
  "eventType": "INCIDENT_CREATED",
  "source": "IncidentModule",
  "payload": {
    "incidentId": "inc_001",
    "reason": "OpenAI timeout",
    "status": "OPEN",
    "createdAt": "2026-05-26T10:00:00Z"
  }
}
```

Response :

```json
{
  "eventType": "INCIDENT_CREATED",
  "matchedWebhooks": 1,
  "deliveries": [
    {
      "id": "del_001",
      "webhookId": "wh_001",
      "status": "SUCCESS",
      "attemptCount": 1
    }
  ]
}
```

Si un webhook externe echoue, `/webhooks/emit` ne leve pas une erreur globale.
La reponse contient une delivery `FAILED` pour ce webhook, et les autres
webhooks continuent d'etre traites.

## Providers

La V1 supporte trois providers :

```text
GENERIC
DISCORD
SLACK
```

`GENERIC` est le provider par defaut. Les payloads existants qui ne precisent
pas `provider` continuent donc de fonctionner, notamment avec webhook.site.

## Payload Sortant GENERIC

Pour chaque webhook `GENERIC`, Gong envoie :

```json
{
  "event": "INCIDENT_CREATED",
  "source": "IncidentModule",
  "timestamp": "2026-05-26T10:00:00.000Z",
  "data": {
    "incidentId": "inc_001",
    "reason": "OpenAI timeout",
    "status": "OPEN"
  }
}
```

Headers ajoutes :

```text
Content-Type: application/json
X-Gong-Event: INCIDENT_CREATED
X-Gong-Signature: sha256=<hmac>   # seulement si un secret est configure
```

## Discord Provider

Discord requiert un payload specifique compatible avec Discord Webhook.
`GENERIC` reste le provider par defaut, et les tests webhook.site continuent de
fonctionner avec `provider: "GENERIC"` ou sans champ `provider`.

Create Discord webhook config :

```json
{
  "name": "Discord Gong Alerts",
  "provider": "DISCORD",
  "url": "https://discord.com/api/webhooks/xxx/yyy",
  "eventTypes": ["INCIDENT_CREATED", "FALLBACK_ACTIVATED", "BUDGET_WARNING"],
  "isActive": true,
  "maxRetries": 3
}
```

Emit example :

```json
{
  "eventType": "INCIDENT_CREATED",
  "source": "IncidentModule",
  "payload": {
    "incidentId": "inc_001",
    "reason": "OpenAI timeout",
    "status": "OPEN"
  }
}
```

Generated Discord payload :

```json
{
  "content": "[INCIDENT_CREATED] OpenAI timeout",
  "embeds": [
    {
      "title": "INCIDENT_CREATED",
      "description": "OpenAI timeout",
      "fields": [
        {
          "name": "Source",
          "value": "IncidentModule",
          "inline": true
        },
        {
          "name": "Status",
          "value": "OPEN",
          "inline": true
        }
      ]
    }
  ]
}
```

La generation du resume Discord prend, par ordre de priorite :

1. `payload.reason`
2. `payload.message`
3. `payload.error`
4. `payload.status + payload.serviceName`
5. `JSON.stringify(payload).slice(0, 300)`

L'URL Discord Webhook doit etre traitee comme un secret operationnel : ne pas la
publier dans les logs, tickets publics ou commits.

## Slack Provider

Slack Incoming Webhooks requiert un payload compatible Slack avec `text` et
`blocks`. L'Incoming Webhook Slack determine deja le channel cible : ne pas
envoyer `channel`, `username` ou `icon_emoji` dans cette V1.

`GENERIC` reste le provider par defaut, webhook.site continue de fonctionner
avec `provider: "GENERIC"` ou sans champ `provider`, et `DISCORD` reste
inchangé.

Create Slack webhook config :

```json
{
  "name": "Slack Gong Alerts",
  "provider": "SLACK",
  "url": "https://hooks.slack.com/services/xxx/yyy/zzz",
  "eventTypes": ["INCIDENT_CREATED", "FALLBACK_ACTIVATED", "BUDGET_WARNING"],
  "isActive": true,
  "maxRetries": 3
}
```

Emit example :

```json
{
  "eventType": "INCIDENT_CREATED",
  "source": "IncidentModule",
  "payload": {
    "incidentId": "inc_001",
    "reason": "OpenAI timeout",
    "status": "OPEN"
  }
}
```

Generated Slack payload :

```json
{
  "text": "[INCIDENT_CREATED] OpenAI timeout",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*INCIDENT_CREATED*\\nOpenAI timeout"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "Source: IncidentModule"
        }
      ]
    }
  ]
}
```

La generation du resume Slack prend, par ordre de priorite :

1. `payload.reason`
2. `payload.message`
3. `payload.error`
4. `payload.status + " - " + payload.serviceName`
5. `JSON.stringify(payload).slice(0, 300)`

L'URL Slack Incoming Webhook doit etre gardee secrete : elle donne le droit de
poster dans le channel configure.

Les reponses publiques de l'API ne renvoient pas l'URL Slack brute. Gong
garde l'URL complete en memoire pour envoyer les notifications, mais retourne
une valeur masquee :

```json
{
  "provider": "SLACK",
  "url": "https://hooks.slack.com/services/***"
}
```

## Exemples D'Integration

### IncidentModule

```json
{
  "eventType": "INCIDENT_CREATED",
  "source": "IncidentModule",
  "payload": {
    "incidentId": "inc_001",
    "serviceId": "chat-service",
    "providerId": "openai",
    "reason": "OpenAI timeout",
    "status": "OPEN",
    "createdAt": "2026-05-26T10:00:00Z"
  }
}
```

### Event Bridge Interne

`IncidentModule` emet aussi un evenement interne `incident.created`.
`WebhookService` l'ecoute via le module NestJS et le transforme en un
`INCIDENT_CREATED` transmis aux webhooks actifs.

Payload minimal transfere vers les webhooks :

- `incidentId`
- `reason`
- `status`
- `timestamp`
- `cachedClientId`
- `cachedProviderId`
- `limitRuleId` si present

### FallbackService

```json
{
  "eventType": "FALLBACK_ACTIVATED",
  "source": "FallbackService",
  "payload": {
    "serviceId": "chat-service",
    "fromProvider": "openai",
    "toProvider": "gemini",
    "reason": "timeout",
    "activatedAt": "2026-05-26T10:01:00Z"
  }
}
```

### BudgetService

```json
{
  "eventType": "BUDGET_WARNING",
  "source": "BudgetService",
  "payload": {
    "serviceId": "chat-service",
    "currentSpend": 82.5,
    "budgetLimit": 100,
    "thresholdPercent": 80
  }
}
```

## Event Types Supportes

```text
INCIDENT_CREATED
INCIDENT_ACKNOWLEDGED
INCIDENT_RESOLVED
FALLBACK_ACTIVATED
PROVIDER_DOWN
PROVIDER_RECOVERED
BUDGET_WARNING
BUDGET_EXCEEDED
ERROR_RATE_HIGH
ADMIN_ACTION
```

Endpoint de decouverte :

```http
GET /webhooks/event-types
```

Response :

```json
{
  "data": [
    "INCIDENT_CREATED",
    "INCIDENT_ACKNOWLEDGED",
    "INCIDENT_RESOLVED",
    "FALLBACK_ACTIVATED",
    "PROVIDER_DOWN",
    "PROVIDER_RECOVERED",
    "BUDGET_WARNING",
    "BUDGET_EXCEEDED",
    "ERROR_RATE_HIGH",
    "ADMIN_ACTION"
  ]
}
```

## Endpoints Admin

| Methode  | Endpoint                | Role                              |
| -------- | ----------------------- | --------------------------------- |
| `POST`   | `/webhooks`             | Creer une configuration webhook   |
| `GET`    | `/webhooks`             | Lister les webhooks               |
| `GET`    | `/webhooks/event-types` | Lister les types d'evenements     |
| `GET`    | `/webhooks/:id`         | Recuperer un webhook              |
| `PATCH`  | `/webhooks/:id`         | Modifier un webhook               |
| `DELETE` | `/webhooks/:id`         | Desactiver logiquement un webhook |
| `POST`   | `/webhooks/:id/test`    | Envoyer un payload de test        |
| `POST`   | `/webhooks/emit`        | Emettre un evenement interne      |
| `GET`    | `/webhook-deliveries`   | Consulter l'historique des envois |

Les routes statiques `/webhooks/event-types` et `/webhooks/emit` sont declarees
avant les routes dynamiques `/:id` pour eviter toute capture incorrecte.

Les endpoints de gestion admin sont proteges en V1 par une cle temporaire dans
le header :

```http
X-Gong-Admin-Key: <WEBHOOK_ADMIN_KEY>
```

La valeur attendue vient de la variable d'environnement `WEBHOOK_ADMIN_KEY`.
Cette protection est volontairement simple pour la V1. Elle ne remplace pas un
futur `AuthModule` avec JWT/roles. L'endpoint `POST /webhooks/emit` reste le
contrat interne pour les modules producteurs.

## Creer Un Webhook

```http
POST /webhooks
Content-Type: application/json
X-Gong-Admin-Key: <WEBHOOK_ADMIN_KEY>
```

Request :

```json
{
  "name": "Slack Incidents",
  "provider": "GENERIC",
  "url": "https://hooks.slack.com/services/xxx",
  "eventTypes": ["INCIDENT_CREATED", "INCIDENT_RESOLVED"],
  "isActive": true,
  "secret": "optional-hmac-secret",
  "maxRetries": 3
}
```

Response publique :

```json
{
  "id": "wh_001",
  "name": "Slack Incidents",
  "provider": "GENERIC",
  "url": "https://hooks.slack.com/services/***",
  "eventTypes": ["INCIDENT_CREATED", "INCIDENT_RESOLVED"],
  "isActive": true,
  "hasSecret": true,
  "maxRetries": 3,
  "createdAt": "2026-05-26T10:00:00.000Z",
  "updatedAt": "2026-05-26T10:00:00.000Z"
}
```

Le champ `secret` n'est jamais retourne. Les reponses publiques exposent
uniquement `hasSecret`.

## Lister Les Webhooks

```http
GET /webhooks
GET /webhooks?isActive=true
GET /webhooks?eventType=INCIDENT_CREATED
X-Gong-Admin-Key: <WEBHOOK_ADMIN_KEY>
```

Response :

```json
{
  "data": [
    {
      "id": "wh_001",
      "name": "Slack Incidents",
      "provider": "GENERIC",
      "url": "https://hooks.slack.com/services/***",
      "eventTypes": ["INCIDENT_CREATED"],
      "isActive": true,
      "hasSecret": true,
      "maxRetries": 3,
      "createdAt": "2026-05-26T10:00:00.000Z",
      "updatedAt": "2026-05-26T10:00:00.000Z"
    }
  ]
}
```

## Modifier Ou Desactiver

```http
PATCH /webhooks/wh_001
Content-Type: application/json
X-Gong-Admin-Key: <WEBHOOK_ADMIN_KEY>
```

```json
{
  "isActive": false,
  "eventTypes": ["FALLBACK_ACTIVATED"]
}
```

`DELETE /webhooks/:id` ne supprime pas physiquement la configuration. Il fait
une desactivation logique en mettant `isActive = false`.

## Tester Un Webhook

```http
POST /webhooks/wh_001/test
Content-Type: application/json
X-Gong-Admin-Key: <WEBHOOK_ADMIN_KEY>
```

```json
{
  "payload": {
    "message": "Test depuis Gong Gateway"
  }
}
```

Cet endpoint envoie un evenement `ADMIN_ACTION` vers l'URL configuree et cree
une delivery.

## Deliveries

Chaque tentative d'envoi cree une `WebhookDelivery` :

```json
{
  "id": "del_001",
  "webhookId": "wh_001",
  "eventType": "INCIDENT_CREATED",
  "source": "IncidentModule",
  "payload": {
    "incidentId": "inc_001"
  },
  "status": "SUCCESS",
  "attemptCount": 1,
  "responseStatus": 200,
  "responseBody": "ok",
  "createdAt": "2026-05-26T10:00:00.000Z",
  "deliveredAt": "2026-05-26T10:00:00.100Z"
}
```

Filtres supportes :

```http
GET /webhook-deliveries
GET /webhook-deliveries?status=FAILED
GET /webhook-deliveries?eventType=INCIDENT_CREATED
GET /webhook-deliveries?webhookId=wh_001
X-Gong-Admin-Key: <WEBHOOK_ADMIN_KEY>
```

Statuts possibles :

```text
PENDING
SUCCESS
FAILED
```

`PENDING` est reserve pour une future implementation asynchrone. La V1 execute
les tentatives pendant la requete et enregistre directement `SUCCESS` ou
`FAILED`.

## HMAC

Si un webhook possede un `secret`, Gong signe le corps JSON sortant avec
HMAC SHA-256 :

```text
X-Gong-Signature: sha256=<hex digest>
```

Le recepteur peut recalculer la signature avec le meme secret et comparer le
digest. Le `secret` est stocke en memoire dans la V1, mais il n'est jamais
retourne dans les reponses HTTP publiques.

## Retry

`maxRetries` controle le nombre de nouvelles tentatives apres l'essai initial.

Exemple :

```text
maxRetries = 0 -> 1 tentative totale
maxRetries = 3 -> 4 tentatives totales
```

La V1 utilise un backoff court pour rester testable rapidement. Une future
version pourra deleguer les retries a une queue.

## Limites Actuelles

- Repository en memoire uniquement.
- Donnees perdues au redemarrage du backend.
- Pas encore de DB applicative.
- Pas encore d'ORM TypeORM/Prisma.
- Pas encore d'AuthModule/JWT complet avec utilisateurs et roles.
- Endpoints admin proteges provisoirement par `X-Gong-Admin-Key`.
- Pas encore d'EventBus.
- Pas encore de queue asynchrone pour les retries.
- Pas encore d'integration directe avec `IncidentModule`, `AdminModule` ou
  `BudgetService`, car ces modules ne sont pas encore presents.

## Commandes De Verification

Depuis `gong-core/` :

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx tsc --noEmit -p tsconfig.json
npx eslint "src/webhooks/**/*.ts" "test/webhooks.e2e-spec.ts"
```

Si `npm run build` echoue avec `EPERM` sur `dist` sous Windows/OneDrive alors
que `tsc` passe, il s'agit probablement d'un fichier genere verrouille et non
d'une erreur TypeScript.
