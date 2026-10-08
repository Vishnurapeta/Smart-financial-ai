# ==============================================================================
# SMARTFIN AI — BACKEND SERVICE DOCKERFILE
# Multi-stage production container build
# ==============================================================================

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

# Use non-root node user for security
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
