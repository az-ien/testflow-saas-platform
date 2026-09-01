FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app
USER root

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc

RUN groupadd -r worker && useradd -r -g worker worker \
  && mkdir -p /tmp/testflow-artifacts \
  && chown -R worker:worker /app /tmp/testflow-artifacts
USER worker

CMD ["node", "dist/workers/aiWorker.js"]
