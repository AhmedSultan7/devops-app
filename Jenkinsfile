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
            /kaniko/executor \
              --context "$WORKSPACE/services/product-service" \
              --dockerfile "$WORKSPACE/services/product-service/Dockerfile" \
              --destination "$REGISTRY/devops-app-product:$TAG"

            /kaniko/executor \
              --context "$WORKSPACE/services/order-service" \
              --dockerfile "$WORKSPACE/services/order-service/Dockerfile" \
              --destination "$REGISTRY/devops-app-order:$TAG"

            /kaniko/executor \
              --context "$WORKSPACE/frontend" \
              --dockerfile "$WORKSPACE/frontend/Dockerfile" \
              --destination "$REGISTRY/devops-app-frontend:$TAG"
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