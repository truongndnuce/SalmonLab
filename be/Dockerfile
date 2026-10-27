# Build context is the repository root:  docker build -f be/Dockerfile -t salmon-api .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY be ./be
RUN pnpm install --frozen-lockfile --filter @salmon/be...
RUN pnpm --filter @salmon/shared build \
 && pnpm --filter @salmon/be exec prisma generate \
 && pnpm --filter @salmon/be build

FROM node:22-alpine
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
# Dev dependencies stay: the prisma CLI is needed at start-up to apply migrations.
COPY --from=build /repo ./
WORKDIR /repo/be
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
# Apply pending migrations, then start. Safe to run on every boot (deploy is idempotent).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
