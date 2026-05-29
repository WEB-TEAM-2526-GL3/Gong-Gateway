# Sentinel Gateway

Sentinel Gateway est une plateforme de pilotage et de supervision pour une API Gateway. Le projet rassemble Kong, Prometheus, un backend NestJS, une interface GraphQL, un dashboard unifié et une salle d'incident temps réel.

L'objectif est de donner à une équipe une vue claire sur le trafic, les services exposés, les incidents, les alertes de monitoring, les webhooks et les intégrations externes, sans multiplier les outils ou les interfaces.

## Vue D'ensemble

Le projet est organisé autour de deux applications principales :

| Dossier | Rôle |
| --- | --- |
| `sentinel-core` | Backend NestJS, API REST, GraphQL, SSE metrics, Socket.IO incident room, intégrations Kong/Prometheus/Webhooks/Messenger. |
| `incident-room` | Frontend React/Vite dédié à la collaboration temps réel autour des incidents. |

L'infrastructure locale est décrite dans `docker-compose.yml` :

| Service | Port | Usage |
| --- | ---: | --- |
| Sentinel Core | `3000` | API backend, dashboard unifié, GraphQL, SSE. |
| Incident Room dev | `5173` | Frontend React/Vite de la salle d'incident. |
| Kong Proxy | `8000` | Point d'entrée du trafic applicatif. |
| Kong Admin API | `8001` | Administration Kong utilisée par Sentinel. |
| Prometheus | `9090` | Collecte et requêtage des métriques Kong. |
| Sentinel PostgreSQL | `5433` | Base de données Sentinel. |
| Kong PostgreSQL | `5432` | Base de données Kong. |

## Fonctionnalités Principales

- Authentification admin avec JWT.
- Gestion des admins et activation/désactivation de comptes.
- Pilotage Kong : services, routes, consumers, clés API et plugins.
- Incidents : création, listing, historique et statuts.
- Incident Room : présence, chat, acknowledge, resolve et flux temps réel via Socket.IO.
- Monitoring : règles d'alerte, checks manuels, incidents générés depuis les seuils.
- Metrics : collecte Prometheus, cache backend, SSE temps réel et courbes live dans le dashboard.
- Webhooks : configuration, delivery tracking et formats Slack/Discord/générique.
- Messenger : réception et consultation des événements entrants.
- GraphQL : façade unifiée pour simplifier le développement frontend.

## Interfaces

Après démarrage du backend :

| Interface | URL |
| --- | --- |
| Dashboard unifié | `http://localhost:3000/dashboard` |
| Apollo GraphQL | `http://localhost:3000/graphql` |
| Metrics SSE | `http://localhost:3000/metrics/sse` |
| REST incidents | `http://localhost:3000/incidents` |
| Incident Room dev | `http://localhost:5173` |

Le dashboard unifié utilise GraphQL pour les données et les mutations classiques. Les métriques live utilisent SSE. La salle d'incident utilise Socket.IO.

## Démarrage Local

Prérequis :

- Docker et Docker Compose.
- Node.js et npm.

Installer et lancer l'infrastructure :

```powershell
docker compose up -d
```

Lancer le backend :

```powershell
cd sentinel-core
npm install
npm run start:dev
```

Ouvrir le dashboard :

```text
http://localhost:3000/dashboard
```

Lancer la salle d'incident en mode développement :

```powershell
cd incident-room
npm install
npm run dev
```

Puis ouvrir :

```text
http://localhost:5173
```

Le bouton "Open Incident Room" du dashboard essaie d'abord d'ouvrir une version embarquée sous `/incident-room/`, puis bascule vers `localhost:5173` si elle n'est pas disponible.

## Configuration

Le backend lit sa configuration depuis `sentinel-core/.env`.

Variables importantes :

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=sentinel
DB_PASSWORD=sentinel
DB_DATABASE=sentinel_gateway

SENTINEL_CORS_ORIGIN=http://localhost:5173
PROMETHEUS_URL=http://localhost:9090
JWT_SECRET=change_me
CEO_SECRET=change_this_ceo_secret
```

Les valeurs locales sont prévues pour le développement. Les secrets doivent être remplacés avant tout usage hors environnement local.

## GraphQL

GraphQL est exposé sur :

```text
POST /graphql
```

Apollo Sandbox est disponible dans le navigateur :

```text
http://localhost:3000/graphql
```

Le frontend envoie le token JWT dans l'en-tête :

```http
Authorization: Bearer <accessToken>
```

GraphQL sert de façade unique pour :

- auth et admins ;
- gateway services/routes/consumers ;
- incidents ;
- monitoring ;
- metrics ;
- webhooks ;
- messenger.

## Realtime

Le projet utilise deux mécanismes temps réel :

| Mécanisme | Usage |
| --- | --- |
| SSE `/metrics/sse` | Flux des métriques Prometheus et changements de santé. |
| Socket.IO `/incident-room` | Collaboration autour des incidents et nouveau flux d'incidents. |

Les métriques SSE alimentent les cartes et les courbes live du dashboard. Socket.IO permet à l'Incident Room de recevoir les nouveaux incidents sans bouton refresh.

## Tests Et Validation

Backend :

```powershell
cd sentinel-core
npm test
npx tsc --noEmit -p tsconfig.build.json
```

Tests ciblés utiles :

```powershell
npm test -- sentinel-graphql.resolver --runInBand
npm test -- prometheus.service metrics.service --runInBand
```

Frontend Incident Room :

```powershell
cd incident-room
npm run build
```

Dashboard statique :

```powershell
cd sentinel-core
node --check public\app.js
```

## Documentation Des Modules

Chaque module backend possède une documentation dédiée :

- `sentinel-core/src/auth/README.md`
- `sentinel-core/src/users/README.md`
- `sentinel-core/src/gateway/README.md`
- `sentinel-core/src/incidents/README.md`
- `sentinel-core/src/monitoring/README.md`
- `sentinel-core/src/metrics/README.md`
- `sentinel-core/src/webhooks/README.md`
- `sentinel-core/src/messenger/README.md`

Des notes supplémentaires sont disponibles dans `sentinel-core/docs/`.

## Notes De Développement

- `sentinel-core` est l'application centrale et doit rester propriétaire de la logique métier.
- GraphQL simplifie la consommation côté frontend, mais ne remplace pas les flux temps réel.
- Les événements backend restent découplés des messages frontend.
- Kong reçoit le trafic réel sur `localhost:8000`.
- Sentinel administre Kong via `localhost:8001`.
- Prometheus collecte les métriques Kong depuis `/metrics`.

