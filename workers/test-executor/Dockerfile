FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Install Node deps
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src

# Share models from backend (symlinked or copied)
COPY ../backend/src/models ./src/models
COPY ../backend/src/config ./src/config

RUN npx tsc

# Non-root user
RUN groupadd -r worker && useradd -r -g worker worker
RUN chown -R worker:worker /app
USER worker

CMD ["node", "dist/worker.js"]
