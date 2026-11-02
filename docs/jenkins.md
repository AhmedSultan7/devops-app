# Jenkins CI/CD

This document describes how the pipeline works, how to set it up in a minikube cluster, and how to troubleshoot it.

## Overview

Jenkins runs inside the cluster (`default` namespace, installed with the official Helm chart as the release `myjenkins`). The `Jenkinsfile` uses the Jenkins Kubernetes plugin: each build starts a temporary agent pod and deletes it when the build ends.

### Agent pod

| Container | Purpose |
|---|---|
| `jnlp` | Connects the pod to Jenkins. Added automatically by the plugin |
| `node` | Runs `npm ci` and the tests |
| `kaniko` | Builds images without a Docker daemon and pushes them to Docker Hub |
| `helm` | Deploys the chart |

All containers share one workspace. Each stage selects the container that has the tool it needs.

### Stages

| Stage | Container | Description |
|---|---|---|
| Test | `node` | `npm ci && npm test` in `services/product-service` |
| Build & Push | `kaniko` | Builds the three images from the repository root and pushes them as `soltanahmed1960/devops-app-{product,order,frontend}:<commit>` |
| Deploy | `helm` | `helm upgrade --install mini-ecommerce ./helm` with the three image tags set to the commit hash, using `--atomic --wait --timeout 3m` |

The tag is the first 7 characters of the commit hash. Because every build has a unique tag, Helm detects a change and rolls the pods. A fixed `latest` tag would not trigger a rollout.

### Build context

The services share one npm workspace with a single `package-lock.json` at the repository root, and the Dockerfiles copy files relative to the root. Kaniko therefore uses the repository root as the build context and selects each Dockerfile with `--dockerfile`. Pointing the context at a service folder fails because the lockfile is not there.

The `.dockerignore` at the repository root excludes `.env` files and `node_modules`. Without it, the `COPY services/...` instructions would put `.env` files into the images.

## Prerequisites

- A running minikube cluster with Jenkins installed
- The Jenkins Kubernetes plugin (included in the official Helm chart)
- A Docker Hub account and an access token
- The `mini-ecommerce` namespace and the application secrets (see the main [README](../README.md))

## One-time setup

### 1. Kubernetes cloud settings

In *Manage Jenkins -> Clouds -> Kubernetes*, agent pods must use the in-cluster service addresses, not the NodePort address used in the browser:

| Setting | Value |
|---|---|
| Jenkins URL | `http://myjenkins.default.svc.cluster.local:8080` |
| Jenkins tunnel | `myjenkins-agent.default.svc.cluster.local:50000` |

Use *Test Connection* to verify.

### 2. Docker Hub credentials for Kaniko

Create the secret in `default`, where the agent pods run. Use an access token, not your password:

```bash
kubectl create secret docker-registry dockerhub-cred -n default \
  --docker-username=<dockerhub-user> \
  --docker-password=<access-token>
```

The pod mounts it at `/kaniko/.docker/config.json`, so no login command is needed in the pipeline.

### 3. Deploy permission

Agent pods run as the `myjenkins` ServiceAccount in `default`. Grant it the built-in `edit` role in the application namespace:

```bash
kubectl create rolebinding jenkins-deployer \
  --clusterrole=edit --serviceaccount=default:myjenkins -n mini-ecommerce
```

Verify it:

```bash
kubectl auth can-i create statefulsets \
  --as=system:serviceaccount:default:myjenkins -n mini-ecommerce
```

The `edit` role is namespaced and does not allow creating cluster-scoped resources such as ClusterRoles. If the chart ever includes them, the deploy fails with `Forbidden`.

### 4. Pipeline job

1. Choose **New Item**, name it `mini-ecommerce` and select **Pipeline**.
2. Under **Pipeline**, set **Definition** to *Pipeline script from SCM* and **SCM** to *Git*.
3. Set the repository URL to `https://github.com/AhmedSultan7/devops-app.git`, the branch to `*/main` and the script path to `Jenkinsfile`.
4. Save and click **Build Now**.

## Running and verifying a build

Watch the cluster from two terminals:

```bash
kubectl get pods -n default -w            # the agent pod
kubectl get pods -n mini-ecommerce -w     # the application pods
```

After a successful build:

```bash
kubectl get deploy -n mini-ecommerce -o wide
helm history mini-ecommerce -n mini-ecommerce
```

The images should carry the commit tag, and `helm history` should show a new revision.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Agent pod stuck in `ContainerCreating` | The `dockerhub-cred` secret is missing in `default`. Create it |
| Agent stuck at "Waiting for agent to connect" | The Jenkins URL or tunnel points at the NodePort address. Use the in-cluster service names above |
| Build & Push cannot find `package-lock.json` | The build context is a service folder. Use the repository root |
| Registry authentication error during push | The `dockerhub-cred` token is wrong or expired. Recreate the secret |
| Deploy fails with `Forbidden` | The RoleBinding is missing in `mini-ecommerce`, or names the wrong ServiceAccount |
| `ImagePullBackOff` | The tag was not pushed, or the Docker Hub repository is private without a pull secret |
| `CreateContainerConfigError` | `product-service-env` or `order-service-env` is missing or lacks the expected key |
| Release rolled back after 3 minutes | Pods did not become ready. Rerun `helm upgrade` without `--atomic`, then use `kubectl describe pod` and `kubectl logs` |
| Postgres runs but the databases are missing | An old `data-postgres-0` volume was reused, so `init.sql` did not run. Delete the PVC (see the README) |

`--atomic` removes a failed release, which can leave `kubectl get pods` empty. To keep the failing pods for inspection, run the Helm command by hand without that flag.

## Planned improvements

- Trigger builds on push: use *Poll SCM*, or a GitHub webhook through a tunnel such as ngrok, because the minikube address is not reachable from GitHub.
- Pin the Kaniko image to a fixed version instead of `:debug`. The original Kaniko project is archived, so evaluate a maintained fork, BuildKit or Buildah for long-term use.
- Convert to a Multibranch Pipeline and deploy only from `main` with `when { branch 'main' }`.
- Add tests for the order service to the Test stage.
- Use a dedicated ServiceAccount for agent pods with narrower permissions.
- Adopt GitOps (for example Argo CD) so Git drives deployments instead of `helm upgrade` from Jenkins.