# Dockerfile for Decagon API
# Used by Fly.io for deployment

FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy package files + root tsconfig (packages extend it)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/x402/package.json packages/x402/
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/x402 packages/x402
COPY packages/core packages/core
COPY apps/api apps/api

# Build packages in order
RUN pnpm --filter @decagon/x402 build
RUN pnpm --filter @decagon/core build
RUN pnpm --filter @decagon/api build

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 4000

# Run the API
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
