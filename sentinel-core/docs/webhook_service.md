| Méthode  | Endpoint                | Rôle                                             | Exemple d’utilisation                                                                          |
| -------- | ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `POST`   | `/webhooks`             | Créer un webhook                                 | L’admin ajoute un webhook Slack pour recevoir les alertes d’incident.                          |
| `GET`    | `/webhooks`             | Lister les webhooks                              | Le frontend affiche tous les webhooks configurés dans la page Admin.                           |
| `GET`    | `/webhooks/:id`         | Récupérer un webhook précis                      | L’admin ouvre le détail du webhook Slack avec l’id `wh_123`.                                   |
| `PATCH`  | `/webhooks/:id`         | Modifier un webhook                              | L’admin change l’URL du webhook ou désactive temporairement les alertes.                       |
| `DELETE` | `/webhooks/:id`         | Désactiver un webhook                            | L’admin supprime logiquement un webhook Discord devenu inutile.                                |
| `POST`   | `/webhooks/:id/test`    | Tester un webhook                                | Le frontend envoie un message de test pour vérifier que Slack reçoit bien la notification.     |
| `POST`   | `/webhooks/emit`        | Envoyer un événement vers les webhooks concernés | `IncidentModule` appelle cet endpoint quand un incident est créé.                              |
| `GET`    | `/webhooks/event-types` | Lister les types d’événements disponibles        | Le frontend récupère la liste `INCIDENT_CREATED`, `FALLBACK_ACTIVATED`, `BUDGET_WARNING`, etc. |
| `GET`    | `/webhook-deliveries`   | Consulter l’historique des envois                | L’admin vérifie si une notification envoyée vers Slack a réussi ou échoué.                     |

Version plus concrète avec exemples de requêtes :

| Méthode  | Endpoint                | Exemple                                                                                                                                                                        |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST`   | `/webhooks`             | Créer un webhook Slack : `{ "name": "Slack Incidents", "url": "https://hooks.slack.com/services/xxx", "eventType": "INCIDENT_CREATED", "isActive": true }`                     |
| `GET`    | `/webhooks`             | Récupérer tous les webhooks : `/webhooks`                                                                                                                                      |
| `GET`    | `/webhooks/:id`         | Récupérer un webhook : `/webhooks/wh_123`                                                                                                                                      |
| `PATCH`  | `/webhooks/:id`         | Modifier un webhook : `/webhooks/wh_123` avec `{ "isActive": false }`                                                                                                          |
| `DELETE` | `/webhooks/:id`         | Désactiver un webhook : `/webhooks/wh_123`                                                                                                                                     |
| `POST`   | `/webhooks/:id/test`    | Tester un webhook : `/webhooks/wh_123/test`                                                                                                                                    |
| `POST`   | `/webhooks/emit`        | Envoyer un événement : `{ "eventType": "INCIDENT_CREATED", "source": "IncidentModule", "payload": { "incidentId": "inc_001", "reason": "OpenAI timeout", "status": "OPEN" } }` |
| `GET`    | `/webhooks/event-types` | Retourner les types possibles : `INCIDENT_CREATED`, `INCIDENT_RESOLVED`, `FALLBACK_ACTIVATED`, `BUDGET_WARNING`                                                                |
| `GET`    | `/webhook-deliveries`   | Voir les envois : `/webhook-deliveries?status=FAILED`                                                                                                                          |
