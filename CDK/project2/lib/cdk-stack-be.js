const { CdkStack } = require('./cdk-stack-dynamodb');

const cdk = require('@aws-cdk/core');
const ec2 = require('@aws-cdk/aws-ec2');
const ecs = require('@aws-cdk/aws-ecs');
const iam = require('@aws-cdk/aws-iam');
const ecs_patterns = require('@aws-cdk/aws-ecs-patterns');
const ssm = require('@aws-cdk/aws-ssm');
const cert = require('@aws-cdk/aws-certificatemanager');
const route53 = require('@aws-cdk/aws-route53');
const albv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
const logs = require('@aws-cdk/aws-logs');
const logs_destinations = require('@aws-cdk/aws-logs-destinations');
const lambda = require('@aws-cdk/aws-lambda');
const cloudwatch = require('@aws-cdk/aws-cloudwatch')
const path = require('path');

class CdkStackBe extends CdkStack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'ImportVPC',{ vpcName: props.env.vpc_name });

    //Roles
    const taskRole = new iam.Role(this, 'ECSTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: "infra-" + props.env.stage + "-" + props.env.service + "-task-iam-role"
    })

    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "dynamodb:Query*",
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      resources: [
        "arn:aws:dynamodb:" + props.env.region + ":" + props.env.account + ":table/dummy-" + props.env.service + "-" + props.env.stage + "-tenant",
        "arn:aws:dynamodb:" + props.env.region + ":" + props.env.account + ":table/dummy-" + props.env.service + "-" + props.env.stage + "-conversations"
      ],
    }));

    //Logs
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: "/ecs/infra/" + props.env.stage + "/" + props.env.service,
      retention: logs.RetentionDays.ONE_MONTH
    })

    new logs.SubscriptionFilter(this, 'Subscription', {
      logGroup: logGroup,
      destination: new logs_destinations.LambdaDestination(lambda.Function.fromFunctionArn(
        this,
        'lambda-datadog',
        'arn:aws:lambda:eu-west-1:12345567890:function:datadog-forwarder-Forwarder-BL1UF3879WYB',
      )),
      filterPattern: logs.FilterPattern.allEvents(),
      filterName: "infra-" + props.env.stage + "-" + props.env.service
    });

    //Fargate Container Build
    const albfs = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'ALB', {
      loadBalancer: new albv2.ApplicationLoadBalancer(this, 'ALBv2', {
        vpc: vpc,
        internetFacing: true,
        loadBalancerName: "infra-" + props.env.stage + "-" + props.env.service + "-alb"
      }),
      serviceName: props.env.service + "-" + props.env.stage + "-ecs",
      cluster: new ecs.Cluster(this, 'ECSCluster', {
        vpc: vpc,
        clusterName: "infra-" + props.env.stage + "-" + props.env.service + "-ecs-cluster",
        containerInsights: true
      }),
      cpu: props.env.cpu,
      memoryLimitMiB: props.env.ram,
      desiredCount: 1,
      publicLoadBalancer: true,
      assignPublicIp: true,
      domainName: props.env.domain_api,
      domainZone: route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: props.env.root_domain
      }),
      recordType: ecs_patterns.ApplicationLoadBalancedServiceRecordType.CNAME,
      certificate: cert.Certificate.fromCertificateArn(this , "certificate" ,("arn:aws:acm:" + props.env.region + ":" + props.env.account + ":certificate/" + props.env.certificate )),
      listenerPort: 443,
      openListener: true,
      //targetGroup: new albv2.ApplicationTargetGroup(this, 'tg', {
      //  targetGroupName: "infra-" + props.env.stage + "-" + props.env.service + "-tg",
      //  targetType: "ip",
      //  port: props.env.port,
      //  vpc: vpc,
      //  healthCheck: {
      //    path: '/__health'
      //  }
      //}),
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../application/service')),
        containerPort: parseInt(props.env.port),
        containerName: props.env.service,
        taskRole: taskRole,
        family: "infra-" + props.env.service + "-" + props.env.stage,
        environment: {
          DYNAMODB_TENANT_TABLE: "dummy-" + props.env.service + "-" + props.env.stage + "-tenant",
          DYNAMODB_CONVERSATIONS_TABLE: "dummy-" + props.env.service + "-" + props.env.stage + "-conversations",
          PORT: String(props.env.port),
          NODE_ENV: String(props.env.stage),
          someS_APP_BACKEND_URL: "https://" + props.env.domain_api,
          someS_APP_FRONTEND_URL: "https://" + props.env.domain
        },
        logDriver: new ecs.AwsLogDriver({
          streamPrefix: "ecs",
          logGroup: logGroup
        }),
        secrets:{
          SSO_CLIENT_ID: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'SSO_CLIENT_ID', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/sso_client_id",
              version: 0
              }
            )
          ),
          SSO_CLIENT_SECRET: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'SSO_CLIENT_SECRET', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/sso_client_secret",
              version: 0
              }
            )
          ),
          TENANT_ID: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'TENANT_ID', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/tenant_id",
              version: 0
              }
            )
          ),
          someS_API_KEY_HEADER: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'someS_API_KEY_HEADER', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/somes_api_key_header",
              version: 0
              }
            )
          ),
          BOT_ID: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'BOT_ID', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/bot_id",
              version: 0
              }
            )
          ),
          BOT_PASSWORD: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'BOT_PASSWORD', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/bot_password",
              version: 0
              }
            )
          ),
          APP_ID: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'APP_ID', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/app_id",
              version: 0
              }
            )
          ),
          PROFILE_TAB_ID: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'PROFILE_TAB_ID', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/profile_tab_id",
              version: 0
              }
            )
          )
        }
      }
    })
    albfs.targetGroup.configureHealthCheck({ path: "/" + props.env.health_check });

    //Autoscaling:
    const scalableTarget = albfs.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 80,
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
    });

    /*
    const Schedule = require('@aws-cdk/aws-applicationautoscaling');

    scalableTarget.scaleOnSchedule('DaytimeScaleDown', {
      schedule: Schedule.cron({ hour: '18', minute: '0'}),
      ?desiredCount: 0,
      minCapacity: 0,
      maxCapacity: 0
    });

    */
  }
}

module.exports = { CdkStackBe }
