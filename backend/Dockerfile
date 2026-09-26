FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
