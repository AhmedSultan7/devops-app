# ---------- Dependencies stage ----------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/product-service/package.json services/product-service/
COPY services/order-service/package.json services/order-service/
COPY frontend/package.json frontend/

RUN npm ci --omit=dev -w @shop/product-service

# ---------- Runtime stage ----------
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY services/product-service/ ./services/product-service/

USER node
WORKDIR /app/services/product-service

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "src/server.js"]