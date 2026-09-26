# Estructura operativa de eventos — Fase 4

Esta fase habilita la organización de la operación alrededor del evento. No incluye todavía inventario, albaranes, caja, firmas ni RFID.

## Alcance

- Eventos: listado por empresa, búsqueda, detalle, alta y edición.
- Casetas (`Booth`) y barras (`Bar`), con códigos únicos dentro del evento.
- Asignación de usuarios mediante `EventUser` y roles `EVENT_MANAGER`, `BAR_MANAGER`, `OPERATOR` y `VIEWER`.
- Ubicación automática de tipo `EVENT_WAREHOUSE` al crear un evento.
- Ubicaciones automáticas de tipo `BOOTH` y `BAR`; se mantienen activas o se marcan como desactivadas junto a su entidad operativa.

## Reglas de acceso

- `ADMIN` y `SUPER_ADMIN` pueden consultar todos los eventos de su empresa y crear eventos.
- Un usuario normal solo ve los eventos asignados mediante `EventUser`.
- El administrador y el `EVENT_MANAGER` pueden editar la estructura de su evento.
- El resto de usuarios asignados tiene acceso de consulta.
- Las bajas son lógicas: `active=false` y `deletedAt`, sin borrar físicamente la entidad.

## API principal

```text
GET    /api/v1/events
GET    /api/v1/events/:eventId
POST   /api/v1/events
PATCH  /api/v1/events/:eventId

GET    /api/v1/events/:eventId/booths
POST   /api/v1/events/:eventId/booths
PATCH  /api/v1/events/:eventId/booths/:boothId

GET    /api/v1/events/:eventId/bars
POST   /api/v1/events/:eventId/bars
PATCH  /api/v1/events/:eventId/bars/:barId

GET    /api/v1/events/:eventId/users
POST   /api/v1/events/:eventId/users
PATCH  /api/v1/events/:eventId/users/:userId
DELETE /api/v1/events/:eventId/users/:userId
```

El detalle del evento devuelve contadores de casetas, barras y usuarios, además del almacén de evento. La siguiente fase puede construir sobre esta estructura para implementar movimientos y stock calculado.
