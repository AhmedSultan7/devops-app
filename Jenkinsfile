pipeline {
  agent {
    kubernetes {
      yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: myjenkins
  containers:
  - name: node
    image: node:20
    command: [sleep]
    args: [infinity]
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: [/busybox/cat]
    tty: true
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker
  - name: helm
    image: alpine/helm:3.15.4
    command: [sleep]
    args: [infinity]
  volumes:
  - name: docker-config
    secret:
      secretName: dockerhub-cred
      items:
      - key: .dockerconfigjson
        path: config.json
'''
    }
  }

  environment {
    REGISTRY  = 'soltanahmed1960'
    TAG       = "${env.GIT_COMMIT.take(7)}"
    RELEASE   = 'mini-ecommerce'
    NAMESPACE = 'mini-ecommerce'
  }

  stages {
    stage('Test') {
      steps {
        container('node') {
          dir('services/product-service') {
            sh 'npm ci && npm test'
          }
        }
      }
    }

    stage('Build & Push') {
      steps {
        container('kaniko') {
          sh '''
            # Copy all sources into /kaniko once, before any build wipes the workspace
            rm -rf /kaniko/src && mkdir -p /kaniko/src
            cp -a "$WORKSPACE/services" "$WORKSPACE/frontend" /kaniko/src/
            find /kaniko/src -name node_modules -prune -exec rm -rf {} +

            build() {
              /kaniko/executor \
                --context "/kaniko/src/$1" \
                --dockerfile "/kaniko/src/$1/Dockerfile" \
                --destination "$REGISTRY/$2:$TAG"
            }

            build services/product-service devops-app-product
            build services/order-service   devops-app-order
            build frontend                 devops-app-frontend
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        container('helm') {
          sh '''
            helm upgrade --install $RELEASE ./my-app \
              --namespace $NAMESPACE \
              --set product.image.tag=$TAG \
              --set order.image.tag=$TAG \
              --set frontend.image.tag=$TAG \
              --atomic --wait --timeout 3m
          '''
        }
      }
    }
  }
}