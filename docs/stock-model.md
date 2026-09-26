# Modelo de stock — Fase 5

## Fuente de verdad

`StockMovement` y `StockMovementItem` son la única fuente de verdad. No se ha creado `StockBalance`: el saldo se reconstruye sumando las líneas que entran en una ubicación y restando las que salen, únicamente para movimientos `POSTED`.

Una línea siempre contiene un entero positivo, un `CupType` y una condición (`CLEAN`, `DIRTY` o `DAMAGED`). `LOST` se conserva en el schema histórico por compatibilidad, pero las operaciones nuevas de pérdida usan el movimiento `LOSS` sin destino. `BREAKAGE` funciona igual.

## Direcciones y tipos

`INITIAL_LOAD` y los ajustes de entrada usan solo destino; `LOSS`, `BREAKAGE` y los ajustes de salida usan solo origen. `TRANSFER`, `DELIVERY`, `RETURN`, `CLEANING_SEND` y `CLEANING_RETURN` requieren ambos. El enum existente conserva `ADJUSTMENT`; su dirección se determina por los campos origen/destino para no romper las migraciones ya aplicadas.

Los movimientos normales conservan la condición. La limpieza cambia la condición entre dos movimientos: `CLEANING_SEND` admite `DIRTY` y `CLEANING_RETURN` admite `CLEAN`.

## Atomicidad y concurrencia

La creación valida empresa, evento, ubicación, vaso, condición y stock dentro de una transacción Prisma. Antes de calcular el stock origen se bloquea su fila `Location` con `SELECT ... FOR UPDATE`; dos operaciones concurrentes sobre la misma ubicación se serializan y la segunda vuelve a validar el saldo. Si no hay cantidad suficiente se devuelve `Insufficient stock` con vaso, condición, disponible y solicitado. Las recogidas (`RETURN`) desde barras externas no se bloquean por saldo insuficiente: la barra puede haber recibido vasos por canales que no controlamos y la cantidad recogida puede superar el stock registrado allí.

Los movimientos confirmados no tienen endpoint de edición ni borrado. Una corrección se realiza mediante otro movimiento de ajuste; la UI no ofrece cancelación de históricos.

## Flujo de ejemplo

```text
INITIAL_LOAD
      ↓
Almacén de evento
      ↓ DELIVERY
Caseta
      ↓ DELIVERY
Barra
      ↓ RETURN (CLEAN / DIRTY)
Caseta
```

## Endpoints

```text
GET  /api/v1/cup-types
POST /api/v1/cup-types
PATCH /api/v1/cup-types/:id

GET  /api/v1/events/:eventId/locations
GET  /api/v1/events/:eventId/stock
GET  /api/v1/events/:eventId/locations/:locationId/stock
GET  /api/v1/events/:eventId/stock-movements
GET  /api/v1/events/:eventId/stock-movements/:movementId
POST /api/v1/events/:eventId/stock-movements
```

El histórico está paginado y permite filtrar tipo, origen, destino, vaso y fechas. El resumen de evento agrega por tipo de vaso y condición; el detalle por ubicación evita una respuesta gigante por defecto.
