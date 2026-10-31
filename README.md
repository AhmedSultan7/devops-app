# Mini E-commerce Platform

A small, runnable microservices application for practicing Docker, Kubernetes, Helm and Jenkins.

## Architecture

- **React + Vite frontend** — product catalog, cart and checkout.
- **Product service** (`:3001`) — product catalog and inventory.
- **Order service** (`:3002`) — order creation and order history.
- **PostgreSQL** — one PostgreSQL server with two separate databases:
  - `products_db`, owned by the product service
  - `orders_db`, owned by the order service

The order service calls the product service to reserve stock. The frontend calls both services through `/api/products` and `/api/orders`.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 14 or newer (not needed if you run everything with Docker)
- Docker 24 or newer (only for the Docker setup below)

## 1. Create the databases

Run the SQL initialization script as a PostgreSQL administrator:

```bash
psql -U postgres -f db/init.sql
```

The script creates `shop_user`, `products_db`, `orders_db`, tables and sample products.
For a non-local environment, change the example credentials in `db/init.sql` and use matching environment variables.

## 2. Install dependencies

From the repository root:

```bash
npm install
```

## 3. Configure services

The defaults are suitable for local development with the databases created above. To override them, copy each example:

```bash
cp services/product-service/.env.example services/product-service/.env
cp services/order-service/.env.example services/order-service/.env
```

The order service's `PRODUCT_SERVICE_URL` defaults to `http://localhost:3001`.

## 4. Start everything

In one terminal:

```bash
npm run dev
```

Open the frontend at http://localhost:5173.

Service endpoints:
- Product service: http://localhost:3001
- Order service: http://localhost:3002
- Product health: http://localhost:3001/health
- Order health: http://localhost:3002/health

## 5. Try the API

```bash
# List products
curl http://localhost:3001/api/products

# Create an order (use an existing product ID)
curl -X POST http://localhost:3002/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Ahmed","items":[{"productId":1,"quantity":2}]}'

# List orders
curl http://localhost:3002/api/orders
```

## Running with Docker

Every deployable has its own Dockerfile:

```
frontend/Dockerfile
frontend/nginx.conf.template
services/product-service/Dockerfile
services/order-service/Dockerfile
```

The services share one npm workspace and one `package-lock.json`, so **build every image from the repository root**. In the container setup, nginx serves the built frontend and proxies `/api/products` and `/api/orders` to the two services, replacing the Vite dev proxy.

### Build the images

```bash
docker build -f services/product-service/Dockerfile -t shop-product-service:1.0 .
docker build -f services/order-service/Dockerfile   -t shop-order-service:1.0 .
docker build -f frontend/Dockerfile                 -t shop-frontend:1.0 .
```

### Run the containers

Run these from the repository root, in this order:

```bash
docker network create shopnet

# 1. PostgreSQL. db/init.sql creates both databases on the first start.
docker run -d --name postgres --network shopnet \
  -e POSTGRES_PASSWORD=change-me-admin \
  -v pgdata:/var/lib/postgresql/data \
  -v "$PWD/db/init.sql":/docker-entrypoint-initdb.d/init.sql:ro \
  postgres:16

# Wait about 10 seconds for the database to initialize, then:

# 2. Backend services
docker run -d --name product-service --network shopnet \
  -e DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/products_db \
  shop-product-service:1.0

docker run -d --name order-service --network shopnet \
  -e DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/orders_db \
  -e PRODUCT_SERVICE_URL=http://product-service:3001 \
  shop-order-service:1.0

# 3. Frontend (host port 8081 -> container port 8080)
docker run -d --name frontend --network shopnet -p 8081:8080 shop-frontend:1.0
```

Open the app at http://localhost:8081.

### Verify

```bash
docker ps                                  # the backends should show (healthy)
curl http://localhost:8081/api/products    # returns the seeded products
```

### Container configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | product, order | none | PostgreSQL connection string |
| `PORT` | product, order | `3001` / `3002` | Listening port |
| `PRODUCT_SERVICE_URL` | order, frontend | `http://product-service:3001` | Address of the product service |
| `ORDER_SERVICE_URL` | frontend | `http://order-service:3002` | Address of the order service |

Pass secrets at run time with `-e` or `--env-file`. The `.dockerignore` keeps `.env` files out of the images.

### Docker notes

- `db/init.sql` runs only when the `pgdata` volume is empty. To re-initialize the database: `docker rm -f postgres && docker volume rm pgdata`.
- If port 8081 is already in use, change the host side of `-p 8081:8080`.
- The database credentials above are for local development only.
- The frontend container's nginx resolves the service names at startup, so start the backends before the frontend.
- To stop and remove everything: `docker rm -f frontend order-service product-service postgres`.

## Tests

```bash
npm test
```

Tests use mocked database pools and do not require PostgreSQL.

## API summary

### Product service

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/products` | List products |
| GET | `/api/products/:id` | Get product |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/internal/products/:id/reserve` | Reserve stock for an order |
| POST | `/internal/products/:id/release` | Compensate a reservation |

Product creation body:

```json
{"name":"Mechanical Keyboard","description":"Hot-swappable keyboard","price":79.99,"stock":15,"imageUrl":""}
```

### Order service

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/orders` | List orders |
| GET | `/api/orders/:id` | Get order |
| POST | `/api/orders` | Create order |

Order creation body:

```json
{"customerName":"Ahmed","items":[{"productId":1,"quantity":2}]}
```

## Notes and limitations

- This is a learning application, not a production commerce system.
- Checkout uses a simple reserve-then-save workflow with compensating stock release if order persistence fails. It is not a distributed transaction; a process crash between operations can require reconciliation.
- There is no authentication, payment processing, shipping, or customer account management.
- Product images are optional URLs. The UI uses a generated placeholder when no image URL is supplied.
- Each service owns a separate database. Do not let the order service query the product database directly.
- For Kubernetes, configure `PRODUCT_SERVICE_URL` to the in-cluster product Service DNS name and configure the frontend API paths through Ingress routing. The frontend image proxies `/api/*` itself through `PRODUCT_SERVICE_URL` and `ORDER_SERVICE_URL`; if the Ingress handles that routing instead, the nginx proxy rules can be removed.
- The product API accepts create, update and delete requests without authentication, and the frontend's nginx forwards them. Restrict those methods or add authentication before exposing the app beyond a local or demo environment.