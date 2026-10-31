# ---------- Dependencies stage ----------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/order-service/package.json services/order-service/
COPY services/product-service/package.json services/product-service/
COPY frontend/package.json frontend/

RUN npm ci --omit=dev -w @shop/order-service

# ---------- Runtime stage ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3002

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY services/order-service/ ./services/order-service/

USER node
WORKDIR /app/services/order-service
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "src/server.js"]