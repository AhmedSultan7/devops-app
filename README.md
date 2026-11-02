# Mini E-commerce Platform

A small microservices application used to practice Docker, Kubernetes, Helm and Jenkins CI/CD. It runs locally with npm, in Docker, or on Kubernetes (minikube) through a Helm chart that Jenkins builds and deploys.

## Architecture

```
Browser -> frontend (nginx, :8080)
              |-- /api/products -> product-service (:3001) -> products_db
              '-- /api/orders   -> order-service   (:3002) -> orders_db
                                      '-- reserves stock via product-service
                          PostgreSQL (one server, two databases)
```

- **Frontend**: React + Vite, served by nginx. nginx proxies `/api/products` and `/api/orders` to the two services.
- **Product service** (`:3001`): product catalog and inventory.
- **Order service** (`:3002`): order creation and history. Calls the product service to reserve stock.
- **PostgreSQL**: one server with two databases, `products_db` (product service) and `orders_db` (order service).

## Repository layout

```
.
├── frontend/                 React app, Dockerfile, nginx.conf.template
├── services/
│   ├── product-service/      Dockerfile, src/, tests/
│   └── order-service/        Dockerfile, src/
├── my-app/                   Helm chart
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── files/init.sql        database schema and seed data (single source of truth)
│   └── templates/            Deployments, Services, Postgres StatefulSet, init ConfigMap
├── Jenkinsfile               CI/CD pipeline
├── .dockerignore
└── package.json              npm workspace root (one package-lock.json)
```

## Requirements

- Node.js 20+ and npm 10+
- Docker 24+
- For Kubernetes: minikube, `kubectl`, Helm 3
- For local runs without Docker: PostgreSQL 14+

## 1. Run locally with npm

Create the databases (run as a PostgreSQL administrator):

```bash
psql -U postgres -f my-app/files/init.sql
```

The script creates `shop_user`, `products_db`, `orders_db`, the tables and sample products. Change the example credentials before using it anywhere other than a local machine.

Install and start:

```bash
npm install
cp services/product-service/.env.example services/product-service/.env
cp services/order-service/.env.example services/order-service/.env
npm run dev
```

The frontend is at http://localhost:5173. Health checks: http://localhost:3001/health and http://localhost:3002/health.

## 2. Run with Docker

The services share one npm workspace and one `package-lock.json`, so **build every image from the repository root**. Each Dockerfile is selected with `-f`:

```bash
docker build -f services/product-service/Dockerfile -t shop-product-service:1.0 .
docker build -f services/order-service/Dockerfile   -t shop-order-service:1.0 .
docker build -f frontend/Dockerfile                 -t shop-frontend:1.0 .
```

Run the containers in this order:

```bash
docker network create shopnet

# 1. PostgreSQL (init.sql runs on first start only)
docker run -d --name postgres --network shopnet \
  -e POSTGRES_PASSWORD=change-me-admin \
  -v pgdata:/var/lib/postgresql/data \
  -v "$PWD/my-app/files/init.sql":/docker-entrypoint-initdb.d/init.sql:ro \
  postgres:16

# Wait about 10 seconds, then:

# 2. Backends
docker run -d --name product-service --network shopnet \
  -e DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/products_db \
  shop-product-service:1.0

docker run -d --name order-service --network shopnet \
  -e DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/orders_db \
  -e PRODUCT_SERVICE_URL=http://product-service:3001 \
  shop-order-service:1.0

# 3. Frontend (host 8081 -> container 8080)
docker run -d --name frontend --network shopnet -p 8081:8080 shop-frontend:1.0
```

Open http://localhost:8081 and verify with `curl http://localhost:8081/api/products`.

Notes:

- `init.sql` runs only when the `pgdata` volume is empty. To re-initialize: `docker rm -f postgres && docker volume rm pgdata`.
- Start the backends before the frontend, because nginx resolves the service names at startup.
- Clean up with `docker rm -f frontend order-service product-service postgres`.

## 3. Deploy to Kubernetes with Helm

The chart in `my-app/` deploys the frontend, the two services and a PostgreSQL StatefulSet. The default namespace and release name are both `mini-ecommerce`.

### Prerequisites

```bash
minikube start
kubectl create namespace mini-ecommerce
```

Create the application secrets first. The chart references them with `existingSecret` and does not create them. Use the key names that your templates read (the examples below assume `DATABASE_URL`):

```bash
kubectl create secret generic product-service-env -n mini-ecommerce \
  --from-literal=DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/products_db

kubectl create secret generic order-service-env -n mini-ecommerce \
  --from-literal=DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/orders_db
```

### Install

```bash
helm upgrade --install mini-ecommerce ./my-app -n mini-ecommerce
```

Check the result:

```bash
kubectl get pods -n mini-ecommerce
helm list -n mini-ecommerce
```

Expected pods: `frontend`, `order-service`, `product-service` and `postgres-0`, all `Running`.

### Open the app

The frontend Service is a NodePort:

```bash
kubectl get svc -n mini-ecommerce
minikube service <frontend-service-name> -n mini-ecommerce --url
```

### Configuration

Main values in `my-app/values.yaml`:

| Value | Default | Purpose |
|---|---|---|
| `frontend.image.repository` | `soltanahmed1960/devops-app-frontend` | Frontend image |
| `order.image.repository` | `soltanahmed1960/devops-app-order` | Order service image |
| `product.image.repository` | `soltanahmed1960/devops-app-product` | Product service image |
| `*.image.tag` | `latest` | Overridden with the commit hash by the pipeline |
| `frontend.service.type` | `NodePort` | How the frontend is exposed |
| `product.existingSecret` / `order.existingSecret` | `product-service-env` / `order-service-env` | Secrets holding the database URLs |
| `frontend.env.*` | in-cluster service URLs | Where nginx proxies API calls |
| `imagePullSecrets` | `[]` | Set to a pull secret if the Docker Hub repos are private |

### Database initialization

`my-app/files/init.sql` is loaded into a ConfigMap and mounted into Postgres. As with Docker, it runs **only when the data directory is empty**. After changing the schema, recreate the database:

```bash
kubectl delete statefulset postgres -n mini-ecommerce
kubectl delete pvc data-postgres-0 -n mini-ecommerce
helm upgrade --install mini-ecommerce ./my-app -n mini-ecommerce
```

This deletes all database contents.

## 4. CI/CD with Jenkins

Jenkins runs inside the cluster (installed with the official Helm chart as the release `myjenkins` in the `default` namespace). The `Jenkinsfile` uses the Jenkins Kubernetes plugin: each build starts a temporary agent pod and deletes it afterwards.

### Pipeline stages

| Stage | Container | What it does |
|---|---|---|
| Test | `node` | `npm ci && npm test` for the product service |
| Build & Push | `kaniko` | Builds the three images from the repo root and pushes them to Docker Hub, tagged with the first 7 characters of the commit hash |
| Deploy | `helm` | `helm upgrade --install` with `--set *.image.tag=<commit>`, using `--atomic --wait` |

The agent pod also contains the `jnlp` container that the plugin adds automatically. All containers share the same workspace.

### One-time setup

Docker Hub credentials for Kaniko (use an access token, in the namespace where agent pods run):

```bash
kubectl create secret docker-registry dockerhub-cred -n default \
  --docker-username=<dockerhub-user> \
  --docker-password=<access-token>
```

Permission for Jenkins' ServiceAccount to deploy into the application namespace:

```bash
kubectl create rolebinding jenkins-deployer \
  --clusterrole=edit --serviceaccount=default:myjenkins -n mini-ecommerce
```

Verify it:

```bash
kubectl auth can-i create statefulsets \
  --as=system:serviceaccount:default:myjenkins -n mini-ecommerce
```

### Create the job

1. In Jenkins choose **New Item**, name it `mini-ecommerce` and select **Pipeline**.
2. Under **Pipeline** set **Definition** to *Pipeline script from SCM*, **SCM** to *Git*, the repository URL, branch `*/main` and script path `Jenkinsfile`.
3. Save and click **Build Now**.

Pushes can trigger builds automatically with a GitHub webhook (needs a public URL, for example through ngrok) or with *Poll SCM*.

### Troubleshooting the pipeline

| Symptom | Likely cause |
|---|---|
| Agent pod stuck in `ContainerCreating` | `dockerhub-cred` secret missing in `default` |
| Build & Push cannot find `package-lock.json` | Build context must be the repo root, not the service folder |
| Deploy fails with `Forbidden` | RoleBinding missing in `mini-ecommerce` |
| Pods in `ImagePullBackOff` | Image tag not pushed, or Docker Hub repo is private without a pull secret |
| Release rolled back after 3 minutes | Pods not ready: rerun `helm upgrade` without `--atomic` and run `kubectl describe pod` |

## Tests

```bash
npm test
```

Tests use mocked database pools and do not need PostgreSQL.

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
| POST | `/internal/products/:id/release` | Release a reservation |

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

```json
{"customerName":"Ahmed","items":[{"productId":1,"quantity":2}]}
```

Example:

```bash
curl http://localhost:3001/api/products

curl -X POST http://localhost:3002/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Ahmed","items":[{"productId":1,"quantity":2}]}'
```

### Environment variables

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | product, order | none | PostgreSQL connection string |
| `PORT` | product, order | `3001` / `3002` | Listening port |
| `PRODUCT_SERVICE_URL` | order, frontend | `http://product-service:3001` | Product service address |
| `ORDER_SERVICE_URL` | frontend | `http://order-service:3002` | Order service address |

Pass secrets at run time (`-e`, `--env-file`, or Kubernetes Secrets). The `.dockerignore` keeps `.env` files out of the images.

## Notes and limitations

- This is a learning project, not a production commerce system. There is no authentication, payment, shipping or customer account management.
- Checkout reserves stock first and saves the order second, releasing the stock if saving fails. It is not a distributed transaction, so a crash between the two steps can leave a reservation that needs reconciliation.
- Each service owns its database. The order service must not query the product database directly.
- The product API accepts create, update and delete requests without authentication, and nginx forwards them. Restrict those methods or add authentication before exposing the app beyond a local or demo environment.
- The database credentials in this README are for local development only. Use real Secrets and rotate them for any shared environment.
