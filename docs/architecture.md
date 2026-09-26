# Arquitectura inicial

Frontend y backend están desacoplados mediante REST bajo `/api/v1`. La aplicación Angular concentra el layout, navegación y consumo HTTP; NestJS concentra validación, documentación y acceso a datos mediante Prisma.

Los módulos de negocio futuros se incorporarán como módulos independientes: `events`, `booths`, `bars`, `cup-types`, `stocks`, `stock-movements`, `cash`, `delivery-notes`, `signatures`, `incidents`, `reports`, `notifications` y `audit-log`.

