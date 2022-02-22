// 1. Scale Down Environment
// 2. Dump Database from PROD
// 3. Local Postgres for Obfuscate
// 4. Obfuscate Database from PROD
// 5. Obfuscated Dump
// 6. Verify scale Down


pipeline {
    agent any
    environment {
        REPOSITORY = 'git@github.com:dymmu/dymmu-obfuscate-db.git'
    }
    parameters {
        choice(name: 'Stage', choices: ['stage'])
        string(name: 'ClientName', defaultValue: 'beta', description: '')
        string(name: 'TargetEnv', defaultValue: 'landg-prod', description: '')
        booleanParam(name: 'DoRelease', defaultValue: false, description: '')
        string(name: 'BranchDeploy', defaultValue: 'release/5.0.0', description: 'FE and BE branch to deploy')
        choice(name: 'AutomationTests', choices: [ 'none', 'both', 'api', 'ui' ])
    //     gitParameter(branch: '',
    //                      branchFilter: 'origin/(.*)',
    //                      defaultValue: 'master',
    //                      description: '',
    //                      name: 'CFBranch',
    //                      quickFilterEnabled: false,
    //                      selectedValue: 'NONE',
    //                      sortMode: 'ASCENDING_SMART',
    //                      tagFilter: '*',
    //                      type: 'PT_BRANCH',
    //                      listSize: '1')
    }
    stages {
        // stage('Checkout') {
        //     steps {
        //         script {
        //             currentBuild.displayName = "#${currentBuild.number} - ${ActionTake} - ${ClientName} - ${Stage} - ${CFBranch}"
        //         }
        //         sh "rm -rf *"
        //         git branch: "${CFBranch}", url: "${REPOSITORY}"
        //     }
        // }

        stage('Scale Down Environment') {
            steps {
                sh "aws autoscaling update-auto-scaling-group --auto-scaling-group-name ${ClientName}-${Stage}-backend-asg --min-size 0 --max-size 0 --desired-capacity 0"
            }
        }

        stage('Prepare Temp Database') {
            steps {
                sh """
                docker run --rm -d -p 5432:5432 \
                --name jenkins-postgres-build \
                --hostname postgres \
                -e POSTGRES_USER=dymmuadmin \
                -e POSTGRES_PASSWORD=postgres \
                -e POSTGRES_DB=dymmudb \
                postgres:12.5-alpine
                """
            }
        }

        stage('Dump Database From PROD') {
            steps {
                sh """
                set +x
                target_db_password=`aws secretsmanager get-secret-value \
                                    --secret-id ${TargetEnv}-postgres-secret \
                                    --query SecretString \
                                    --output text \
                                    --region eu-west-1 |cut -d ',' -f 1 |cut -d '"' -f 4`
                export PGPASSWORD="\$target_db_password"
                set -x
                pg_dump -h ${TargetEnv}-postgres.dymmu.hr -p 5432 -U dymmuadmin dymmudb --verbose > ${TargetEnv}_dymmudb_${currentBuild.number}.sql
                unset PGPASSWORD
                """
            }
        }

        stage('Load Data into Temp Database') {
            environment { PGPASSWORD = "postgres" }
            steps {
                sh "psql -h localhost -U dymmuadmin dymmudb -c 'CREATE ROLE dymmumonitor'"
                sh "psql -h localhost -U dymmuadmin dymmudb -c 'CREATE ROLE rdsadmin'"
                sh "psql -h localhost -U dymmuadmin dymmudb < ${TargetEnv}_dymmudb_${currentBuild.number}.sql"
            }
            post {
                always {
                    sh "rm -rf ${TargetEnv}_dymmudb_${currentBuild.number}.sql"
                }
            }
        }

        stage('Obfuscate') {
            environment { PGPASSWORD = "postgres" }
            steps {
                sh "psql -h localhost -U dymmuadmin dymmudb < obfuscate.sql"
            }
        }

        stage('Dump Obfuscated') {
            environment { PGPASSWORD = "postgres" }
            steps {
                sh "pg_dump -h localhost -U dymmuadmin dymmudb --verbose > ${TargetEnv}_dymmudb_${currentBuild.number}_obfuscated.sql"
            }
            post {
                always {
                    sh "docker rm -f jenkins-postgres-build"
                }
            }
        }

        stage('Verify Scale Down') {
            steps {
                sh """#!/bin/bash
                    ready=false
                    index=0
                    while [ "\$ready" = false ] && [ "\$index" -lt 30 ]; do
                        scale_result=`aws autoscaling describe-scaling-activities --auto-scaling-group-name ${ClientName}-${Stage}-backend-asg --max-items 1 --output yaml | grep "StatusCode:" | cut -d ':' -f 2 |cut -d ' ' -f 2`
                        if [ "\$scale_result" = "Successful" ]; then
                            ready=true
                        else
                            index=\$((index+1))
                            aws autoscaling describe-scaling-activities --auto-scaling-group-name ${ClientName}-${Stage}-backend-asg --max-items 1 --output yaml | grep "Progress:"
                            echo `aws autoscaling describe-scaling-activities --auto-scaling-group-name ${ClientName}-${Stage}-backend-asg --max-items 1`
                            sleep 10s
                        fi
                    done
                """
            }
        }

        stage('Load Data into Database') {
            steps {
                sh """
                set +x
                db_password=`aws secretsmanager get-secret-value \
                                    --secret-id ${ClientName}-${Stage}-postgres-secret \
                                    --query SecretString \
                                    --output text \
                                    --region eu-west-1 |cut -d ',' -f 1 |cut -d '"' -f 4`
                export PGPASSWORD="\$db_password"
                set -x
                psql -h ${ClientName}-${Stage}-postgres.dymmu.systems -U dymmuadmin postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'dymmudb';"
                psql -h ${ClientName}-${Stage}-postgres.dymmu.systems -U dymmuadmin postgres -c "DROP DATABASE dymmudb"
                psql -h ${ClientName}-${Stage}-postgres.dymmu.systems -U dymmuadmin postgres -c "CREATE DATABASE dymmudb"
                
                psql -h ${ClientName}-${Stage}-postgres.dymmu.systems -U dymmuadmin dymmudb < ${TargetEnv}_dymmudb_${currentBuild.number}_obfuscated.sql
                """
                sh "rm -rf ${TargetEnv}_dymmudb_${currentBuild.number}_obfuscated.sql"
            }
            post {
                always {
                    sh "rm -rf ${TargetEnv}_dymmudb_${currentBuild.number}_obfuscated.sql"
                }
            }
        }

        stage('Setup Spring Active Profile') {
            steps {
                sh """
                aws ssm put-parameter --type "SecureString" \
                    --name /${ClientName}/${Stage}/spring_active_profile \
                    --value "${TargetEnv}"  \
                    --overwrite \
                    --region eu-west-1
                """
            }
        }

        stage('Release FE/BE on Environment') {
            when { expression { return params.DoRelease } }
            steps {
                script {
                    build job: 'Cloudformation-Full-Deployment', wait: true,
                        parameters: [
                            string(name: 'ClientName', value: ClientName),
                            string(name: 'Stage', value: Stage),
                            string(name: 'ActionTake', value: 'update'),
                            booleanParam(name: 'CallFEBuild', value: true),
                            string(name: 'FEBuildBranch', value: BranchDeploy),
                            booleanParam(name: 'CallBEBuild', value: true),
                            string(name: 'BEBuildBranch', value: BranchDeploy),
                            string(name: 'AutomationTests', value: AutomationTests)
                        ]
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
        always {
            sh "rm -rf ${TargetEnv}_dymmudb_${currentBuild.number}*"
            sh "docker rm -f jenkins-postgres-build || true"
            sh "docker volume prune --force || true"
        }
    }
}
