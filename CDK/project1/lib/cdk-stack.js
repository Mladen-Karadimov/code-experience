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
const path = require('path');

class CdkStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    //const stage = props.env.stage;
    
    const vpc = ec2.Vpc.fromLookup(this, 'ImportVPC',{ vpcName: props.env.vpc_name });

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
        "arn:aws:dynamodb:" + props.env.region + ":" + props.env.account + ":table/dummy-" + props.env.service + "-" + props.env.stage + "-some",
        "arn:aws:dynamodb:" + props.env.region + ":" + props.env.account + ":table/dummy-" + props.env.service + "-" + props.env.stage + "-user"
      ],
    }));

    const executionRole = new iam.Role(this, 'ECSExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: "infra-" + props.env.stage + "-" + props.env.service + "-execution-iam-role",
    })
    executionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"))
    executionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "kms:Decrypt",
        "ssm:GetParameters",
        "ssm:GetParameter"
      ],
      resources: [
        "arn:aws:kms:" + props.env.region + ":" + props.env.account + ":key/123123123-8dc7-46b9-9f6c-412341241",
        "arn:aws:ssm:" + props.env.region + ":" + props.env.account + ":parameter/dummy-" + props.env.service + "/" + props.env.stage + "/*"
      ],
    }));

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
      domainName: props.env.stage == 'prod' ? props.env.service + "." + props.env.root_domain : props.env.service + "-" + props.env.stage + "." + props.env.root_domain,
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
        image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../application')),
        containerPort: parseInt(props.env.port),
        containerName: props.env.service,
        taskRole: taskRole,
        family: "infra-" + props.env.service + "-" + props.env.stage,
        environment: {
          DYNAMODB_USER_TABLE: "dummy-" + props.env.service + "-" + props.env.stage + "-user",
          DYNAMODB_some_TABLE: "dummy-" + props.env.service + "-" + props.env.stage + "-some",
          PORT: String(props.env.port),
          NODE_ENV: String(props.env.stage),
        },
        executionRole: executionRole,
        logDriver: new ecs.AwsLogDriver({
          streamPrefix: "ecs",
          logGroup: logGroup
        }),
        secrets:{
          some_SIGNING_SECRET: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'some_SIGNING_SECRET', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/some_signing_secret",
              version: 0
              }
            )
          ),
          some_CLIENT_ID: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'some_CLIENT_ID', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/some_client_id",
              version: 0
              }
            )
          ),
          some_CLIENT_SECRET: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'some_CLIENT_SECRET', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/some_client_secret",
              version: 0
              }
            )
          ),
          some_RECOMMENDATIONS_SCHEDULED_HOURS: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'some_RECOMMENDATIONS_SCHEDULED_HOURS', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/some_cron_recommendations_scheduled_hours",
              version: 0
              }
            )
          ),
          some_RECOMMENDATIONS_SCHEDULED_MINUTES: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'some_RECOMMENDATIONS_SCHEDULED_MINUTES', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/some_cron_recommendations_scheduled_minutes",
              version: 0
              }
            )
          ),
          dummy_some_SECRET: ecs.Secret.fromSsmParameter(ssm.StringParameter.fromSecureStringParameterAttributes(
            this, 'dummy_some_SECRET', {
              parameterName: "/dummy-" + props.env.service + "/" + props.env.stage + "/dummy_some_header_secret",
              version: 0
            }
          ))
        }
      }
    })
    albfs.targetGroup.configureHealthCheck({path: '/__health'});
    //albfs.targetGroup.targetGroupName("infra-" + props.env.stage + "-" + props.env.service + "-tg");

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

module.exports = { CdkStack }
