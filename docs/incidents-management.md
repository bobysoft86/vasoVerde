# Avisos e incidencias

Los miembros de un evento pueden registrar avisos e incidencias desde la pestaña **Avisos e incidencias** del evento. Un aviso es informativo; una incidencia necesita seguimiento hasta su resolución.

Cada registro incluye categoría, prioridad, título, descripción opcional y ubicación opcional. Los estados son abierta, en curso, resuelta y cancelada. Los responsables del evento y administradores pueden asignar un miembro del evento, cambiar prioridad y estado. Los miembros pueden añadir comentarios de seguimiento. Los cambios de estado, prioridad y asignación también aparecen en el historial.

## Endpoints

- `GET /api/v1/events/:eventId/incidents`: lista del evento para miembros autorizados.
- `POST /api/v1/events/:eventId/incidents`: crear un aviso o incidencia.
- `PATCH /api/v1/events/:eventId/incidents/:incidentId`: asignación y gestión, solo responsables y administradores.
- `POST /api/v1/events/:eventId/incidents/:incidentId/comments`: añadir seguimiento.
- `GET /api/v1/events/:eventId/incidents/assignees`: miembros disponibles, solo responsables y administradores.

La migración `20261009140000_incident_management` añade tipo, prioridad, asignación e historial de comentarios a los registros de incidencias.
