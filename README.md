# Mini E-commerce Platform

A microservices e-commerce application deployed on Kubernetes with Helm and delivered through a Jenkins CI/CD pipeline. It is built to practice container builds, Helm packaging and automated deployments on a local minikube cluster.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, nginx |
| Services | Node.js (product service, order service) |
| Database | PostgreSQL 17 (StatefulSet) |
| Packaging | Helm 3 |
| CI/CD | Jenkins on Kubernetes, Kaniko, Docker Hub |
| Platform | Kubernetes (minikube) |

## Architecture

```
Browser -> frontend (nginx, NodePort :8080)
              |-- /api/products -> product-service (:3001) -> products_db
              '-- /api/orders   -> order-service   (:3002) -> orders_db
                                      '-- reserves stock via product-service
                          PostgreSQL (one server, two databases)
```

- **Frontend** serves the UI and proxies `/api/products` and `/api/orders` to the backends.
- **Product service** manages the catalog and inventory.
- **Order service** creates and lists orders, and reserves stock through the product service.
- **PostgreSQL** hosts `products_db` and `orders_db`. Each service owns its own database.

## Repository layout

```
.
├── frontend/              React app, Dockerfile, nginx configuration
├── services/
│   ├── product-service/   API, tests, Dockerfile
│   └── order-service/     API, Dockerfile
├── my-app/                Helm chart
│   ├── values.yaml
│   ├── files/init.sql     database schema and seed data
│   └── templates/         Deployments, Services, Postgres StatefulSet, init ConfigMap
├── docs/jenkins.md        CI/CD setup and troubleshooting
├── Jenkinsfile            pipeline definition
└── .dockerignore
```

The services share one npm workspace with a single `package-lock.json` at the repository root, so **all images are built from the repository root**.

## Prerequisites

- minikube, `kubectl` and Helm 3
- A Docker Hub account for the image repositories (`soltanahmed1960/devops-app-*`)
- Jenkins running in the cluster (see [docs/jenkins.md](docs/jenkins.md))

## Quick start

### 1. Create the namespace and secrets

```bash
minikube start
kubectl create namespace mini-ecommerce
```

The chart reads database credentials from existing secrets and does not create them. Use the key name your templates expect (`DATABASE_URL` below):

```bash
kubectl create secret generic product-service-env -n mini-ecommerce \
  --from-literal=DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/products_db

kubectl create secret generic order-service-env -n mini-ecommerce \
  --from-literal=DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/orders_db
```

### 2. Install the chart

```bash
helm upgrade --install mini-ecommerce ./my-app -n mini-ecommerce
kubectl get pods -n mini-ecommerce
```

Expected pods: `frontend`, `order-service`, `product-service` and `postgres-0`, all `Running`.

### 3. Open the application

```bash
kubectl get svc -n mini-ecommerce
minikube service <frontend-service-name> -n mini-ecommerce --url
```

## Configuration

Key values in `my-app/values.yaml`:

| Value | Default | Description |
|---|---|---|
| `frontend.image.repository` | `soltanahmed1960/devops-app-frontend` | Frontend image |
| `order.image.repository` | `soltanahmed1960/devops-app-order` | Order service image |
| `product.image.repository` | `soltanahmed1960/devops-app-product` | Product service image |
| `*.image.tag` | `latest` | Overridden with the commit hash by the pipeline |
| `frontend.service.type` | `NodePort` | Frontend exposure |
| `product.existingSecret` | `product-service-env` | Secret with the product database URL |
| `order.existingSecret` | `order-service-env` | Secret with the order database URL |
| `imagePullSecrets` | `[]` | Set if the Docker Hub repositories are private |

## Database initialization

`my-app/files/init.sql` creates `shop_user`, both databases, the tables and sample products. It is mounted into PostgreSQL through a ConfigMap.

The script runs **only when the data directory is empty**. Redeploying keeps the existing `data-postgres-0` volume, so schema changes are not applied automatically. To recreate the database (this deletes all data):

```bash
kubectl delete statefulset postgres -n mini-ecommerce
kubectl delete pvc data-postgres-0 -n mini-ecommerce
helm upgrade --install mini-ecommerce ./my-app -n mini-ecommerce
```

Uninstalling the release also leaves the volume behind, so delete the PVC for a clean start.

## CI/CD

Every build of the `main` branch runs three stages in a temporary Kubernetes agent pod:

1. **Test**: runs the product service tests with `npm ci && npm test`.
2. **Build & Push**: builds the three images with Kaniko and pushes them to Docker Hub, tagged with the short commit hash.
3. **Deploy**: runs `helm upgrade --install` with the new tags, using `--atomic --wait` so failed releases roll back.

Setup instructions, required permissions, troubleshooting and planned improvements are in [docs/jenkins.md](docs/jenkins.md).

## API reference

### Product service (`:3001`)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/products` | List products |
| GET | `/api/products/:id` | Get a product |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |
| POST | `/internal/products/:id/reserve` | Reserve stock for an order |
| POST | `/internal/products/:id/release` | Release a reservation |

### Order service (`:3002`)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/orders` | List orders |
| GET | `/api/orders/:id` | Get an order |
| POST | `/api/orders` | Create an order |

Example order request, sent through the frontend URL:

```bash
curl -X POST <frontend-url>/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Ahmed","items":[{"productId":1,"quantity":2}]}'
```

## Limitations

- This is a learning project, not a production commerce system. It has no authentication, payments, shipping or customer accounts.
- Checkout reserves stock and then saves the order, releasing the stock if saving fails. This is not a distributed transaction, so a crash between the two steps can leave a reservation that needs reconciliation.
- The product API accepts create, update and delete requests without authentication, and nginx forwards them. Add authentication or restrict those methods before exposing the application beyond a local environment.
- The example credentials are for development only. Use real Secrets for any shared environment, and never commit `.env` files.