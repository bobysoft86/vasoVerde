# Vaso Verde

Base técnica de la plataforma ERP/PWA para la gestión de vasos reutilizables en eventos.

## Requisitos

- Node.js 22 LTS o superior (se recomienda una versión LTS par)
- npm 10+
- Docker Desktop con Docker Compose

## Arranque desde cero

```bash
cp .env.example .env
docker compose up -d --wait
cd backend && npm install
npm run prisma:migrate
npx prisma db seed
npm run start:dev
```

En otra terminal:

```bash
cd frontend
npm install
npm start
```

URLs: frontend `http://localhost:4200`, API `http://localhost:3000/api/v1`, Swagger `http://localhost:3000/api/docs`, health `http://localhost:3000/api/v1/health`.

## Comandos útiles

Backend: `npm run start:dev`, `npm run lint`, `npm run test`, `npm run prisma:migrate`.

Prisma: `npx prisma db seed` para cargar datos de desarrollo y `npx prisma studio` para inspeccionar las relaciones.

Frontend: `npm start`, `npm run lint`, `npm test`.

## Estructura

- `frontend/`: Angular standalone, Material, PWA, layout responsive y features.
- `backend/`: NestJS versionado, configuración, Prisma, health, auth y users.
- `docker-compose.yml`: MySQL 8 con volumen persistente y healthcheck.
- `docs/`: decisiones y arquitectura futura.

La Fase 5 deja disponible el inventario reconstruible por movimientos: tipos de vaso, stock por ubicación, entregas, recogidas, cargas iniciales, pérdidas, roturas y trazabilidad. La Fase 6 añade albaranes ligados 1:1 a movimientos elegibles, firmas PNG táctiles, PDF protegido y envío SMTP opcional. La Fase 8 añade dashboards agregados, alertas, reporting y exportación CSV. Ver [`docs/delivery-notes.md`](docs/delivery-notes.md) y [`docs/dashboard-reporting.md`](docs/dashboard-reporting.md).

## Fase 3: autenticación y usuarios

Credenciales de desarrollo: `admin@ecocups.demo` / `Demo1234!`. El refresh token se mantiene en cookie `httpOnly`; el access token vive en memoria del frontend.

Rutas Angular: `/login`, `/dashboard`, `/events`, `/events/:eventId`, `/events/:eventId/stock`, `/events/:eventId/movements` y `/admin/users`.

Endpoints principales: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `PATCH /api/v1/auth/change-password`, `GET|POST|PATCH /api/v1/users`, CRUD de `/api/v1/events`, `/api/v1/events/:eventId/booths`, `/api/v1/events/:eventId/bars`, tipos de vaso, stock/movimientos y albaranes bajo `/api/v1/events/:eventId`. Para email SMTP configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y opcionalmente `SMTP_SECURE=true`.
