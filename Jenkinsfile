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
    REGISTRY      = 'soltanahmed1960'
    TAG           = "${env.GIT_COMMIT.take(7)}"
    RELEASE       = 'mini-ecommerce'
    NAMESPACE     = 'mini-ecommerce'
    SLACK_CHANNEL = '#jenkins-builds'
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
            build() {
              /kaniko/executor \
                --context "$WORKSPACE" \
                --dockerfile "$WORKSPACE/$1/Dockerfile" \
                --destination "$REGISTRY/$2:$TAG" \
                --cleanup
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
            helm upgrade --install $RELEASE ./helm \
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

  post {
    success {
      slackSend(
        channel: env.SLACK_CHANNEL,
        color: 'good',
        message: ":white_check_mark: *SUCCESS* ${env.JOB_NAME} #${env.BUILD_NUMBER}\nDeployed `${env.TAG}` to `${env.NAMESPACE}` in ${currentBuild.durationString.replace(' and counting', '')}\n<${env.BUILD_URL}|Open build>"
      )
    }
    failure {
      slackSend(
        channel: env.SLACK_CHANNEL,
        color: 'danger',
        message: ":x: *FAILED* ${env.JOB_NAME} #${env.BUILD_NUMBER}\nCommit `${env.TAG}`\n<${env.BUILD_URL}console|Open console output>"
      )
    }
  }
}