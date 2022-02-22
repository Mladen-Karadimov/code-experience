const cdk = require('@aws-cdk/core');
const route53 = require('@aws-cdk/aws-route53');
const cloudwatch = require('@aws-cdk/aws-cloudwatch')

class CdkStackGlobal extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

  // Route53 HealthCheck
  const healthCheckSNS = "arn:aws:sns:us-east-1:12345567890:health-checks-sns"

  const Route53HealthCheck = new route53.CfnHealthCheck(this, "Route53HealthCheckId", {
    healthCheckConfig: {
      port: 443,
      type: "HTTPS",
      resourcePath: props.env.health_check,
      fullyQualifiedDomainName: props.env.domain_api,
      requestInterval: 30,
      failureThreshold: 3,
      enableSni: true,
      //alarmIdentifier: {
      //  name: route53Alarm.alarmName,
      //  region: props.env.region
      //}
    },
    healthCheckTags: [
      {
        key: "ClientName",
        value: "infra"
      },
      {
        key: "Role",
        value: props.env.service
     },
     {
        key: "Environment",
        value: props.env.stage
      },
      {
        key: "Name",
        value: props.env.service + " " + props.env.stage + " health check"
      }
    ]
  });

  const route53Alarm = new cloudwatch.Alarm(this, 'route53Alarm', {
    datapointsToAlarm: 1,
    evaluationPeriods: 5,
    metric: new cloudwatch.Metric({
      namespace: 'AWS/Route53',
      metricName: 'HealthCheckStatus',
      period: cdk.Duration.minutes(1),
      statistic: "Minimum",
      dimensions: {
        HealthCheckId: Route53HealthCheck.ref
      }
    }),
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    threshold: 1,
    alarmName: props.env.service + " " + props.env.stage,
    alarmDescription: props.env.service + " " + props.env.stage + " health check",
    actionsEnabled: true
  })

  route53Alarm.addInsufficientDataAction({
    bind(scope, alarm) {
      return { alarmActionArn: healthCheckSNS };
  }
  });

  route53Alarm.addOkAction({
    bind(scope, alarm) {
        return { alarmActionArn: healthCheckSNS };
    }
  });

  route53Alarm.addAlarmAction({
    bind(scope, alarm) {
        return { alarmActionArn: healthCheckSNS };
    }
  });

  }
}

module.exports = { CdkStackGlobal }
