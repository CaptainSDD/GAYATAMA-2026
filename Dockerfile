# API image for Cloud Run. Build from the repository root:
#
#   gcloud run deploy gayatama-api --source . --region asia-southeast2
#
# The API depends on @gayatama/scoring, a private workspace package that is not
# published to npm, so the image installs and builds the workspace, then keeps
# only what the API needs at runtime.

FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/scoring/package.json packages/scoring/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/scoring packages/scoring
COPY apps/api apps/api
RUN npm run build -w @gayatama/scoring \
 && npm run build -w @gayatama/api \
 && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/scoring/package.json ./packages/scoring/
COPY --from=build /app/packages/scoring/dist ./packages/scoring/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/data ./apps/api/data

WORKDIR /app/apps/api
USER node
# Cloud Run provides PORT (8080 by default).
CMD ["node", "dist/main.js"]
