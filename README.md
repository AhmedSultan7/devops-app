# Mini E-commerce Platform

<<<<<<< HEAD
A small microservices application used to practice Kubernetes, Helm and Jenkins CI/CD. Everything runs inside a minikube cluster: Jenkins builds the images with Kaniko, pushes them to Docker Hub and deploys the Helm chart.
=======
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
>>>>>>> 65bfa52 (Restructure README and add Jenkins documentation)

## Architecture

```
Browser -> frontend (nginx, NodePort :8080)
              |-- /api/products -> product-service (:3001) -> products_db
              '-- /api/orders   -> order-service   (:3002) -> orders_db
                                      '-- reserves stock via product-service
<<<<<<< HEAD
                          PostgreSQL 17 (StatefulSet, two databases)
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
├── .dockerignore             keeps .env files and node_modules out of images
└── package.json              npm workspace root (one package-lock.json)
```

The services share one npm workspace and a single `package-lock.json` at the repository root. For that reason **every image is built from the repository root**, with the Dockerfile selected by path.
=======
                          PostgreSQL (one server, two databases)
```

- **Frontend** serves the UI and proxies `/api/products` and `/api/orders` to the backends.
- **Product service** manages the catalog and inventory.
- **Order service** creates and lists orders, and reserves stock through the product service.
- **PostgreSQL** hosts `products_db` and `orders_db`. Each service owns its own database.
>>>>>>> 65bfa52 (Restructure README and add Jenkins documentation)

## Repository layout

<<<<<<< HEAD
- minikube, `kubectl` and Helm 3
- A Docker Hub account (images are pushed to `soltanahmed1960/devops-app-*`)
- Jenkins running in the cluster (see [CI/CD with Jenkins](#cicd-with-jenkins))

PostgreSQL and Node.js do not need to be installed on your machine. The cluster runs `postgres:17`, and the builds and tests run in Jenkins agent pods.

## Deploy to Kubernetes with Helm

The chart in `my-app/` deploys the frontend, the two services and a PostgreSQL StatefulSet. The release name and namespace are both `mini-ecommerce`.

### 1. Prepare the namespace and secrets
=======
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
>>>>>>> 65bfa52 (Restructure README and add Jenkins documentation)

```bash
minikube start
kubectl create namespace mini-ecommerce
```

<<<<<<< HEAD
The chart references the application secrets with `existingSecret` and does not create them, so create them before installing. Use the key names that your templates read (the examples assume `DATABASE_URL`):
=======
The chart reads database credentials from existing secrets and does not create them. Use the key name your templates expect (`DATABASE_URL` below):
>>>>>>> 65bfa52 (Restructure README and add Jenkins documentation)

```bash
kubectl create secret generic product-service-env -n mini-ecommerce \
  --from-literal=DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/products_db

kubectl create secret generic order-service-env -n mini-ecommerce \
  --from-literal=DATABASE_URL=postgres://shop_user:shop_dev_password@postgres:5432/orders_db
```

<<<<<<< HEAD
### 2. Install

```bash
helm upgrade --install mini-ecommerce ./my-app -n mini-ecommerce
```

Check the result:

```bash
kubectl get pods -n mini-ecommerce
helm list -n mini-ecommerce
```

Expected pods: `frontend`, `order-service`, `product-service` and `postgres-0`, all `Running`.

### 3. Open the app

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
| `*.image.pullPolicy` | `Always` | Image pull policy |
| `frontend.service.type` | `NodePort` | How the frontend is exposed |
| `product.existingSecret` | `product-service-env` | Secret with the product database URL |
| `order.existingSecret` | `order-service-env` | Secret with the order database URL |
| `frontend.env.*`, `order.env.*` | in-cluster service URLs | Where the services find each other |
| `imagePullSecrets` | `[]` | Set to a pull secret if the Docker Hub repositories are private |

The Docker Hub repositories must be public, or `imagePullSecrets` must point to a secret created in the `mini-ecommerce` namespace.

### Database initialization

`my-app/files/init.sql` is loaded into a ConfigMap and mounted into Postgres. It creates `shop_user`, `products_db`, `orders_db`, the tables and sample products.

The script runs **only when the data directory is empty**. A redeploy keeps the existing `data-postgres-0` volume, so schema changes are not applied automatically. To recreate the database:

```bash
kubectl delete statefulset postgres -n mini-ecommerce
kubectl delete pvc data-postgres-0 -n mini-ecommerce
helm upgrade --install mini-ecommerce ./my-app -n mini-ecommerce
```

This deletes all database contents. Uninstalling the release also leaves the PVC behind, so delete it too if you want a clean start.

## CI/CD with Jenkins

Jenkins runs in the `default` namespace, installed with the official Helm chart as the release `myjenkins`. The `Jenkinsfile` uses the Jenkins Kubernetes plugin: each build starts a temporary agent pod and deletes it when the build ends.

### Pipeline stages

| Stage | Container | What it does |
|---|---|---|
| Test | `node` | `npm ci && npm test` in `services/product-service` |
| Build & Push | `kaniko` | Builds the three images from the repository root and pushes them to Docker Hub, tagged with the first 7 characters of the commit hash |
| Deploy | `helm` | `helm upgrade --install` with `--set product.image.tag`, `order.image.tag` and `frontend.image.tag` set to that hash, using `--atomic --wait --timeout 3m` |

The agent pod also contains a `jnlp` container, added automatically by the plugin, which connects the pod to Jenkins. All containers share one workspace.

Each build gets a unique image tag, so Helm sees a change on every run and rolls the pods. With a fixed `latest` tag it would not.

### One-time setup

**Kubernetes plugin.** In *Manage Jenkins -> Clouds -> Kubernetes*, agents use the in-cluster addresses, not the NodePort address used in the browser:

- Jenkins URL: `http://myjenkins.default.svc.cluster.local:8080`
- Jenkins tunnel: `myjenkins-agent.default.svc.cluster.local:50000`

**Docker Hub credentials for Kaniko.** Create the secret in `default`, where the agent pods run, using an access token:

```bash
kubectl create secret docker-registry dockerhub-cred -n default \
  --docker-username=<dockerhub-user> \
  --docker-password=<access-token>
```

**Deploy permission.** Agent pods run as the `myjenkins` ServiceAccount in `default`. Grant it the built-in `edit` role in the application namespace:

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
2. Under **Pipeline** set **Definition** to *Pipeline script from SCM* and **SCM** to *Git*.
3. Set the repository URL to `https://github.com/AhmedSultan7/devops-app.git`, the branch to `*/main` and the script path to `Jenkinsfile`.
4. Save and click **Build Now**.

While a build runs, watch the cluster:

```bash
kubectl get pods -n default -w            # the agent pod
kubectl get pods -n mini-ecommerce -w     # the application pods
```

Run these in two separate terminals. After a successful build, confirm that the pods use the commit tag:

```bash
kubectl get deploy -n mini-ecommerce -o wide
helm history mini-ecommerce -n mini-ecommerce
```

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Agent pod stuck in `ContainerCreating` | `dockerhub-cred` secret missing in `default` |
| Agent stuck at "Waiting for agent to connect" | Jenkins URL or tunnel in the Kubernetes cloud settings points at the NodePort address instead of the in-cluster service names |
| Build & Push cannot find `package-lock.json` | The build context must be the repository root, not the service folder |
| Deploy fails with `Forbidden` | The RoleBinding is missing in `mini-ecommerce` |
| Pods in `ImagePullBackOff` | The image tag was not pushed, or the Docker Hub repository is private without a pull secret |
| `CreateContainerConfigError` | `product-service-env` or `order-service-env` is missing, or lacks the expected key |
| Release rolled back after 3 minutes | Pods did not become ready. Rerun `helm upgrade` without `--atomic` and inspect with `kubectl describe pod` and `kubectl logs` |
| Postgres is up but the databases are missing | An old `data-postgres-0` volume was reused, so `init.sql` did not run. See [Database initialization](#database-initialization) |

### Possible improvements

- Trigger builds automatically: use *Poll SCM*, or a GitHub webhook through a tunnel such as ngrok, since the minikube address is not reachable from GitHub.
- Pin the Kaniko image to a specific version instead of `:debug`. The original Kaniko project is archived, so check which fork or alternative (BuildKit, Buildah) you want long term.
- Use a Multibranch Pipeline and deploy only from `main` with `when { branch 'main' }`.
- Add tests for the order service to the Test stage.
- Use a dedicated ServiceAccount for agent pods with narrower permissions.
- Move to GitOps (for example Argo CD), so Git drives the deployment instead of `helm upgrade` from Jenkins.

## Building images by hand

The pipeline builds the images for you. If you need to build one manually, run it from the repository root:

```bash
docker build -f services/product-service/Dockerfile -t soltanahmed1960/devops-app-product:dev .
docker build -f services/order-service/Dockerfile   -t soltanahmed1960/devops-app-order:dev .
docker build -f frontend/Dockerfile                 -t soltanahmed1960/devops-app-frontend:dev .
```

The `.dockerignore` at the repository root keeps `.env` files and `node_modules` out of the build context. Without it, `COPY services/...` would copy `.env` files into the images.

## Tests

The product service has Jest tests that use a mocked database pool and need no PostgreSQL. Jenkins runs them in the Test stage. To run them yourself, use `npm ci && npm test` from `services/product-service`.

## API summary

### Product service

| Method | Path | Purpose |
=======
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
>>>>>>> 65bfa52 (Restructure README and add Jenkins documentation)
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

<<<<<<< HEAD
Try it through the frontend's NodePort URL (the `minikube service ... --url` output):

```bash
curl <frontend-url>/api/products

curl -X POST <frontend-url>/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Ahmed","items":[{"productId":1,"quantity":2}]}'
```

### Environment variables

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | product, order | none | PostgreSQL connection string, provided by the Kubernetes secrets |
| `PORT` | product, order | `3001` / `3002` | Listening port |
| `PRODUCT_SERVICE_URL` | order, frontend | `http://product-service:3001` | Product service address |
| `ORDER_SERVICE_URL` | frontend | `http://order-service:3002` | Order service address |

## Notes and limitations

- This is a learning project, not a production commerce system. There is no authentication, payment, shipping or customer account management.
- Checkout reserves stock first and saves the order second, releasing the stock if saving fails. It is not a distributed transaction, so a crash between the two steps can leave a reservation that needs reconciliation.
- Each service owns its database. The order service must not query the product database directly.
- The product API accepts create, update and delete requests without authentication, and nginx forwards them. Restrict those methods or add authentication before exposing the app beyond a local or demo environment.
- The database credentials in this README are for development only. Use real Secrets and rotate them for any shared environment, and never commit `.env` files.
=======
## Limitations

- This is a learning project, not a production commerce system. It has no authentication, payments, shipping or customer accounts.
- Checkout reserves stock and then saves the order, releasing the stock if saving fails. This is not a distributed transaction, so a crash between the two steps can leave a reservation that needs reconciliation.
- The product API accepts create, update and delete requests without authentication, and nginx forwards them. Add authentication or restrict those methods before exposing the application beyond a local environment.
- The example credentials are for development only. Use real Secrets for any shared environment, and never commit `.env` files.
>>>>>>> 65bfa52 (Restructure README and add Jenkins documentation)
