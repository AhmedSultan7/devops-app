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
- PostgreSQL 14 or newer

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
- For Kubernetes, configure `PRODUCT_SERVICE_URL` to the in-cluster product Service DNS name and configure the frontend API paths through Ingress routing.
