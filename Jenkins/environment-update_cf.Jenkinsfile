pipeline {
    agent any
    environment {
        REPOSITORY_CLOUDFORMATION = 'git@github.com:dymmu-Ventures/dymmu-cloudformation.git'
        REPOSITORY_VERSIONS = 'git@github.com:dymmu-Ventures/dymmu-versions.git'
        REPOSITORY_FRONTEND = 'git@github.com:dymmu-Ventures/dymmu-frontend.git'
        REPOSITORY_ENVIRONMENTS = 'git@github.com:dymmu-Ventures/dymmu-environments.git'
        JENKINS_BOT_USER = 'dymmu-automation'
        JENKINS_BOT_MAIL = 'automation@dymmu.systems'
        AWS_REGION = 'eu-west-1'
        FRONTEND_CODEBUILD_NAME = 'dymmu-frontend-codebuild'
        FRONTEND_CODEBUILD_BUCKET = 'dymmu-frontend-codebuild'
    }
    parameters {
        string(name: 'ClientName', defaultValue: '', description: '')
        choice(name: 'Stage', choices: [ 'dev', 'stage', 'prod' ])
        choice(name: 'update', choices: [ 'all', 'frontend', 'backend' ])
    }
    stages {
        stage('Pepare & Checkout') {
            steps {
                sh "rm -rf environments cloudformation frontend"
                script {
                    currentBuild.displayName = "#${currentBuild.number} - ${ClientName} - ${Stage} - ${update}"
                }
                //checkout dymmu-environments
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/init']],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[$class: 'RelativeTargetDirectory',
                    relativeTargetDir: 'environments']],
                    submoduleCfg: [],
                    userRemoteConfigs: [[url: "${REPOSITORY_ENVIRONMENTS}"]]])

                dir ("environments") {
                    script {
                        CLOUDFORMATION_BRANCH = sh(returnStdout: true, script: "cat environments/${ClientName}-${Stage}/infra.properties | grep CloudformationBranch | cut -d '=' -f 2").trim()
                        FRONTEND_BRANCH = sh(returnStdout: true, script: "cat environments/${ClientName}-${Stage}/frontend.properties | grep FrontendBranch | cut -d '=' -f 2").trim()

                        BACKEND_TAG = sh(returnStdout: true, script: "cat environments/${ClientName}-${Stage}/infra.properties | grep BackendImage | cut -d ':' -f 2").trim()
                        KEYCLOAK_TAG = sh(returnStdout: true, script: "cat environments/${ClientName}-${Stage}/infra.properties | grep KeycloakImage | cut -d ':' -f 2").trim()
                        SUPERSET_TAG = sh(returnStdout: true, script: "cat environments/${ClientName}-${Stage}/infra.properties | grep SupersetImage | cut -d ':' -f 2").trim()
                    }
                }

                echo "Checking if all the images are avaliable"

                sh "aws ecr describe-images --repository-name=dymmu-backend --image-ids=imageTag=${BACKEND_TAG} > /dev/null"
                sh "aws ecr describe-images --repository-name=dymmu-keycloak --image-ids=imageTag=${KEYCLOAK_TAG} > /dev/null"
                sh "aws ecr describe-images --repository-name=dymmu-superset --image-ids=imageTag=${SUPERSET_TAG} > /dev/null"

                //checkout dymmu-cloudformation
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${CLOUDFORMATION_BRANCH}"]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[$class: 'RelativeTargetDirectory',
                    relativeTargetDir: 'cloudformation']],
                    submoduleCfg: [],
                    userRemoteConfigs: [[url: "${REPOSITORY_CLOUDFORMATION}"]]])

                sh "cp environments/environments/${ClientName}-${Stage}/infra.properties cloudformation/environments/${ClientName}-${Stage}.properties"

                //checkout dymmu-frontend
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${FRONTEND_BRANCH}"]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[$class: 'RelativeTargetDirectory',
                    relativeTargetDir: 'frontend']],
                    submoduleCfg: [],
                    userRemoteConfigs: [[url: "${REPOSITORY_FRONTEND}"]]])

            }
        }

        stage('Cloudformation Status') {
            steps {
                sh """
                #!/bin/bash
                while : ; do
                    stack_status=`aws cloudformation describe-stacks --stack-name ${ClientName}-${Stage}-cf --query "Stacks[0].StackStatus" --output text`
                    echo "Current StackStatus: \$stack_status"
                    if [[ "\$stack_status" == *"_COMPLETE" ]]; then
                        break
                    fi
                    echo "Current StackStatus: \$stack_status"
                done
                """
            }
        }

        stage('Variables') {
            when { expression { return update == 'all' || update == 'backend'} }
            steps {
                dir("environments") {
                    script {
                        VARS_PATH = "environments/${ClientName}-${Stage}"
                        sh(returnStdout: true, script: "aws s3 cp s3://${ClientName}-${Stage}-bucket-gzrdonjxgi/variables.env ${VARS_PATH}/s3.env").trim()
                        LOCAL_VARIABLES = sh(returnStdout: true, script: "cat ${VARS_PATH}/backend.env").trim()
                        S3_VARIABLES = sh(returnStdout: true, script: "cat ${VARS_PATH}/s3.env").trim()
                        if ( LOCAL_VARIABLES != S3_VARIABLES ) {
                            UPDATE_VARIABLES = "true"
                            BACKEND_REVISION = sh(returnStdout: true, script: "aws ecs describe-task-definition --task-definition ${ClientName}-${Stage}-backend --query 'taskDefinition.revision'").trim()
                            sh(returnStdout: true, script: "aws s3 cp ${VARS_PATH}/backend.env s3://${ClientName}-${Stage}-bucket-gzrdonjxgi/variables.env").trim()
                        } else {
                            UPDATE_VARIABLES = "false"
                        }
                    }
                }
            }
        }

        stage('Update') {
            parallel {

                stage('Cloudformation Main') {
                    when { expression { return update == 'all' || update == 'backend'} }
                    steps {
                        dir("cloudformation") {
                            sh "aws cloudformation package --template-file dymmu-master-template.yaml \
                                --output-template-file template.packaged.yaml \
                                --s3-bucket dymmu-cloudformation"

                            sh "aws cloudformation deploy --template-file template.packaged.yaml \
                                --stack-name ${ClientName}-${Stage}-cf --capabilities CAPABILITY_NAMED_IAM \
                                --parameter-overrides \$(cat environments/general.properties) \
                                \$(cat environments/${ClientName}-${Stage}.properties) \
                                --tags \
                                    ClientName=${ClientName} \
                                    Environment=${Stage} \
                                --region eu-west-1"
                        }
                        // update if the variables are changed
                        script {
                            if ( UPDATE_VARIABLES == "true" ) {

                                BACKEND_REVISION_AFTER_UPDATE = sh(returnStdout: true, script: "aws ecs describe-task-definition --task-definition ${ClientName}-${Stage}-backend --query 'taskDefinition.revision'").trim()

                                if ( BACKEND_REVISION == BACKEND_REVISION_AFTER_UPDATE ) {
                                    sh"""
                                    aws ecs update-service \
                                    --cluster ${ClientName}-${Stage}-ecs-cluster \
                                    --service ${ClientName}-${Stage}-backend-ecs-service \
                                    --force-new-deployment --region ${AWS_REGION} > /dev/null
                                    """
                                    sh """
                                    aws ecs wait services-stable \
                                    --cluster ${ClientName}-${Stage}-ecs-cluster \
                                    --services ${ClientName}-${Stage}-backend-ecs-service \
                                    --region ${AWS_REGION}
                                    """
                                }
                            }
                        }

                    }
                }

                stage('Cloudformation Global') {
                    when { expression { return update == 'all' || update == 'backend'} }
                    steps {
                        dir("cloudformation") {
                            sh "aws cloudformation deploy --template-file ./global/global.yaml \
                                    --stack-name ${ClientName}-${Stage}-cf-global \
                                    --capabilities CAPABILITY_NAMED_IAM \
                                    --parameter-overrides \$(cat environments/general.properties) \
                                    \$(cat environments/${ClientName}-${Stage}.properties) \
                                    --tags \
                                        ClientName=${ClientName} \
                                        Environment=${Stage} \
                                    --region us-east-1"
                        }
                    }
                }

                stage('Frontend') {
                    when { expression { return update == 'all' || update == 'frontend'} }
                    steps {
                        sh """#!/bin/bash
                        # zip file and send to S3
                        rm -rf frontend/.git
                        zip --quiet -r frontend-${BUILD_ID}.zip frontend
                        aws s3 cp frontend-${BUILD_ID}.zip s3://${FRONTEND_CODEBUILD_BUCKET}/frontend-${BUILD_ID}.zip

                        # Trigger Build
                        build_id=`aws codebuild start-build \
                            --project-name "${FRONTEND_CODEBUILD_NAME}" \
                            --source-location-override "${FRONTEND_CODEBUILD_BUCKET}/frontend-${BUILD_ID}.zip" \
                            --buildspec-override "---
version: 0.2

phases:
    build:
        commands:
            - cd frontend
            - npm install
            - npm run build-${ClientName}-${Stage}
            - npm run deploy-${ClientName}-${Stage}

cache:
  paths:
    - '/root/.npm/**/*'
                            " \
                            --region eu-west-1 \
                            --query 'build.id' \
                            --output text`

                        echo "Triggered build: \${build_id}"

                        # Wait Build
                        while : ; do
                            sleep 30
                            codebuild_progress=`aws codebuild batch-get-builds --ids \${build_id} --query 'builds[0].currentPhase' --output text`
                            echo "Build Progress: \${codebuild_progress}"

                            if [ "\$codebuild_progress" = "COMPLETED" ]; then
                                break
                            fi
                        done

                        # Delete source from S3
                        aws s3api delete-object --bucket ${FRONTEND_CODEBUILD_BUCKET} --key frontend-${BUILD_ID}.zip

                        #Define Build Status
                        codebuild_status=`aws codebuild batch-get-builds --ids \${build_id} --query 'builds[0].buildStatus' --output text`
                        echo "Build Status: \${codebuild_status}"

                        if [ "\$codebuild_status" = "FAILED" ]; then
                            error_message = `aws codebuild batch-get-builds --ids \${build_id} --query 'builds[0].phases[6].contexts[0].message' --output text`
                            echo "Error: \${error_message}"
                            exit 1
                        fi
                        """
                        // dir("frontend") {
                        //     script {
                        //         docker_frontend_command = "docker run --rm -e CI='true' --cpus=${FE_LIMIT_CPU} --memory=${FE_LIMIT_RAM}g -u root -v /root/.npm:/root/.npm -v \"${WORKSPACE}\":\"${WORKSPACE}\" -w \"${WORKSPACE}\" ${FE_BUILD_IMAGE}"
                        //     }
                        //     sh "${docker_frontend_command} npm install"
                        //     sh "${docker_frontend_command} npm run build-${Client}-${Environment}"
                        //     sh "npm run deploy-${Client}-${Environment}"
                        // }
                    }
                }
            }
        }
    }

    post {
        success {
            echo "success"
        }
        failure {
            echo "failure"
        }
    }

}