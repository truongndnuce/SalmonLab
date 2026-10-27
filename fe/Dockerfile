# Build context is the repository root:  docker build -f fe/Dockerfile -t salmon-web .
# `next build` prerenders pages from the API, so the API must be reachable while building:
#   --build-arg API_INTERNAL_URL=http://<api-host>:4000/api/v1   (see infra/docker-compose.prod.yml)
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY fe ./fe
RUN pnpm install --frozen-lockfile --filter @salmon/fe...
ARG API_INTERNAL_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG WIDGETS_BASE_URL
ARG MEDIA_ORIGIN
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    WIDGETS_BASE_URL=$WIDGETS_BASE_URL MEDIA_ORIGIN=$MEDIA_ORIGIN
RUN pnpm --filter @salmon/shared build && pnpm --filter @salmon/fe build

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/fe/.next/standalone ./
COPY --from=build /repo/fe/.next/static ./fe/.next/static
# og images read Lora font files from node_modules relative to the working directory
COPY --from=build /repo/fe/node_modules/@fontsource/lora/files ./fe/node_modules/@fontsource/lora/files
WORKDIR /app/fe
# ISR writes its cache under .next/cache at runtime
RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/robots.txt || exit 1
CMD ["node", "server.js"]
