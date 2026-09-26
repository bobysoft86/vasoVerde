# Fase 6 — Albaranes

Un `StockMovement` representa la realidad del inventario. Un `DeliveryNote` es su documento histórico y puede existir una sola vez por movimiento (`StockMovement 1 — 0..1 DeliveryNote`). Solo `DELIVERY`, `RETURN` y `TRANSFER` generan albarán; pérdidas, roturas y ajustes quedan fuera de esta fase.

```text
StockMovement
     ↓
DeliveryNote (PENDING_SIGNATURE)
     ↓
Firma DELIVERED_BY + firma RECEIVED_BY
     ↓
SIGNED → PDF guardado → descarga / email
```

## Numeración

`DocumentSequence` mantiene una secuencia por empresa, evento y tipo documental. La fila se actualiza dentro de una transacción y con incremento atómico; el valor consumido se transforma en `EVENT-CODE-ALB-000001`. El frontend nunca proporciona ni puede editar el número.

## Estados e inmutabilidad

- `DRAFT`: reservado para futuras ediciones controladas.
- `PENDING_SIGNATURE`: creado y pendiente de las dos firmas.
- `SIGNED`: contiene entrega y recepción; no se puede editar ni cancelar.
- `CANCELLED`: solo se permite antes de completar las firmas y no revierte el movimiento.

Al firmar se fija la hora del servidor. La combinación `deliveryNoteId + type` evita dos firmas del mismo tipo.

## Firmas y almacenamiento

El frontend captura PNG mediante canvas, con soporte de puntero, ratón y táctil. El backend limita el archivo a PNG de 2 MB, lo almacena fuera de MySQL y solo guarda `imagePath`. `StorageService` encapsula el filesystem y valida que las rutas estén bajo `STORAGE_PATH` (por defecto `backend/storage`), dejando preparada la sustitución por S3/MinIO/R2.

## Condición en las devoluciones

En un `RETURN`, la condición de cada línea (`CLEAN`, `DIRTY` o `DAMAGED`) es la condición observada al recoger el vaso y la que se registra en el destino. La validación de origen usa el total disponible de ese tipo de vaso, independientemente de su condición previa. El cálculo consume primero la condición solicitada y después otras condiciones disponibles, manteniendo el stock por condición coherente. Cuando el origen es una barra externa, la recogida puede superar el saldo registrado, porque no controlamos las entradas que esa empresa recibe por otros canales.

## PDF

Se usa PDFKit en backend. El PDF final se genera automáticamente al pasar a `SIGNED`, se guarda en `storage/delivery-notes` y puede regenerarse bajo demanda si falta. La descarga pasa por el endpoint protegido del evento; nunca se expone la carpeta de almacenamiento.

## Email

`POST /api/v1/events/:eventId/delivery-notes/:id/email` usa Nodemailer y SMTP. Variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y opcional `SMTP_SECURE=true`. Sin `SMTP_HOST` responde `Email service not configured`. Cada destinatario deja un `DeliveryNoteEmail` con estado y error, y el envío correcto genera `AuditLog`.

## Endpoints

- `POST /api/v1/events/:eventId/delivery-notes`
- `GET /api/v1/events/:eventId/delivery-notes`
- `GET /api/v1/events/:eventId/delivery-notes/:id`
- `POST /api/v1/events/:eventId/delivery-notes/:id/signatures` (`multipart/form-data`: `signature`, `type`, `signerName`)
- `GET /api/v1/events/:eventId/delivery-notes/:id/pdf`
- `POST /api/v1/events/:eventId/delivery-notes/:id/email`
- `POST /api/v1/events/:eventId/delivery-notes/:id/cancel`

La creación desde el formulario de stock usa `generateDeliveryNote`. En esta primera versión el movimiento se confirma en su transacción y después se crea el documento; si la creación documental falla, el movimiento no se duplica y puede generar el albarán desde el histórico.

## Angular

- `/events/:eventId/delivery-notes`
- `/events/:eventId/delivery-notes/:id`

El detalle muestra las líneas originales del movimiento, permite firmar cada papel desde móvil/tablet y solo presenta PDF/email cuando el documento está firmado.

## Límites deliberados

No se implementan caja, cobros, TPV, RFID, facturación, contabilidad ni aprobación compleja. El PDF no incorpora todavía logo configurable ni paginación avanzada para documentos de muchas líneas.
