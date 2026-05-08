FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

USER root

# Runtime tools for public test repositories that use pytest, TestNG, or Maven/Selenium.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    openjdk-17-jdk-headless \
    maven \
    python3 \
    python3-venv \
    python3-pip \
  && corepack enable \
  && rm -rf /var/lib/apt/lists/*

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
