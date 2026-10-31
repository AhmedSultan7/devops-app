# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY services/product-service/package.json services/product-service/
COPY services/order-service/package.json services/order-service/

RUN npm ci -w @shop/frontend

COPY frontend/ ./frontend/
RUN npm run build

# ---------- Runtime stage ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine

ENV PRODUCT_SERVICE_URL=http://product-service:3001 \
    ORDER_SERVICE_URL=http://order-service:3002

COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080