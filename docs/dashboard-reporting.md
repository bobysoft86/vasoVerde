# Fase 8 — Dashboard y reporting

## Endpoints

- `GET /api/v1/dashboard`: resumen global de la empresa; reservado a `ADMIN` y `SUPER_ADMIN`.
- `GET /api/v1/events/:eventId/dashboard`: dashboard agregado del evento.
- `GET /api/v1/events/:eventId/alerts`: alertas calculadas.
- `GET /api/v1/events/:eventId/reports/stock` y `.csv`.
- `GET /api/v1/events/:eventId/reports/stock-movements`.
- `GET /api/v1/events/:eventId/reports/cash` y `.csv`.
- `GET /api/v1/events/:eventId/reports/delivery-notes`.

Todos derivan `companyId` del usuario autenticado y validan el acceso al evento. La información económica del evento solo se devuelve a administradores y `EVENT_MANAGER`.

## Fórmulas

- **Stock actual**: suma de movimientos `POSTED` por ubicación y condición. En una devolución, la condición es la observada al recoger y se descuenta del total disponible del origen.
- **En circulación**: stock positivo en ubicaciones de tipo `BOOTH` o `BAR`; se excluyen almacenes.
- **Pérdidas**: suma de cantidades de movimientos `LOSS` del rango consultado.
- **Roturas**: suma de cantidades de movimientos `BREAKAGE` del rango consultado.
- **Recaudación**: suma de `CashMovement.COLLECTION`.
- **Gastos**: suma de `CashMovement.EXPENSE`.
- **Retiradas**: suma de `CashMovement.WITHDRAWAL`.
- **Diferencias**: suma de la diferencia de cierre de las sesiones `CashSession` del rango.
- **Cajas abiertas/cerradas**: conteo de sesiones por estado.

## Alertas

Las alertas son dinámicas, no persistidas. `LOW_STOCK_THRESHOLD` configura el umbral de vasos limpios por ubicación y por defecto vale `100`; por debajo de la mitad se eleva a `CRITICAL`. También se generan avisos por albaranes pendientes de firma.

## Angular

- `/dashboard`: KPIs globales, stock y alertas.
- `/events/:eventId/overview`: KPIs del evento, alertas, stock por tipo y acciones rápidas.
- `/events/:eventId/reports`: exportación de stock y caja CSV.

Los CSV se generan en backend con BOM UTF-8 y separador `;` para compatibilidad con Excel/LibreOffice.

## Decisiones de rendimiento

El dashboard de evento utiliza un endpoint agregado y limita actividad/albaranes recientes. No se añade Redis ni un data warehouse. La suma de stock se hace sobre los movimientos del evento y se reconstruye por ubicación para mantener coherencia con el módulo de inventario.

## Caja operativa

Cada `CashSession` pertenece a una ubicación del evento y registra el fondo inicial, movimientos, arqueo final y diferencia. `REFUND` representa específicamente el euro devuelto por un vaso; no se mezcla con gastos ni retiradas. Las sesiones se gestionan desde `/events/:eventId/cash`.
