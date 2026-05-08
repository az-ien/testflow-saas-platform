FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Install Node deps
COPY workers/test-executor/package*.json ./
RUN npm ci

# Copy worker source
COPY workers/test-executor/tsconfig.json ./
COPY workers/test-executor/src ./src

# Build
RUN npx tsc

# Non-root user
RUN groupadd -r worker && useradd -r -g worker worker
RUN chown -R worker:worker /app
USER worker

CMD ["node", "dist/worker.js"]
