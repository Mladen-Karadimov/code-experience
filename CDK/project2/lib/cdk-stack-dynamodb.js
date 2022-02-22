const cdk = require('@aws-cdk/core');
const dynamodb = require('@aws-cdk/aws-dynamodb');
const cloudwatch = require('@aws-cdk/aws-cloudwatch')

class CdkStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const dynamoSnsTopicArn = "arn:aws:sns:eu-west-1:12345567890:dynamodb"
    // DynamoDB Tables:

    // Tenant Table:
    const DynaboTenantTable = new dynamodb.Table(this, 'DynaboTenantTable', {
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecovery: true,
      readCapacity: 5,
      writeCapacity: 5,
      tableName: "dummy-" + props.env.service + "-" + props.env.stage + "-tenant"
    });

    const dynamoTenantReadAlarm = new cloudwatch.Alarm(this, 'DynamoTenantReadAlarm', {
      datapointsToAlarm: 3,
      evaluationPeriods: 5,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedReadCapacityUnits',
        period: cdk.Duration.minutes(1),
        statistic: "sum",
        dimensions: {
          TableName: DynaboTenantTable.tableName
        }
      }),
      threshold: 240,
      alarmName: DynaboTenantTable.tableName + "-ConsumedReadCapacityUnits",
      actionsEnabled: true
    })

    dynamoTenantReadAlarm.addAlarmAction({
      bind(scope, alarm) {
          return { alarmActionArn: dynamoSnsTopicArn };
      }
    });

    const dynamoTenantWriteAlarm = new cloudwatch.Alarm(this, 'DynamoTenantWriteAlarm', {
      datapointsToAlarm: 3,
      evaluationPeriods: 5,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedWriteCapacityUnits',
        period: cdk.Duration.minutes(1),
        statistic: "sum",
        dimensions: {
          TableName: DynaboTenantTable.tableName
        }
      }),
      threshold: 240,
      alarmName: DynaboTenantTable.tableName + "-ConsumedWriteCapacityUnits",
      actionsEnabled: true
    })

    dynamoTenantWriteAlarm.addAlarmAction({
      bind(scope, alarm) {
          return { alarmActionArn: dynamoSnsTopicArn };
      }
    });

    // Conversation Table: 
    const dynamoConversationTable = new dynamodb.Table(this, 'DynaboConversationTable', {
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecovery: true,
      readCapacity: 5,
      writeCapacity: 5,
      sortKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      tableName: "dummy-" + props.env.service + "-" + props.env.stage + "-conversations"
    });

    const dynamoConversationReadAlarm = new cloudwatch.Alarm(this, 'DynamoConversationReadAlarm', {
      datapointsToAlarm: 3,
      evaluationPeriods: 5,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedReadCapacityUnits',
        period: cdk.Duration.minutes(1),
        statistic: "sum",
        dimensions: {
          TableName: dynamoConversationTable.tableName
        }
      }),
      threshold: 240,
      alarmName: dynamoConversationTable.tableName + "-ConsumedReadCapacityUnits",
      actionsEnabled: true
    })

    dynamoConversationReadAlarm.addAlarmAction({
      bind(scope, alarm) {
          return { alarmActionArn: dynamoSnsTopicArn };
      }
    });

    const dynamoConversationWriteAlarm = new cloudwatch.Alarm(this, 'DynamoConversationWriteAlarm', {
      datapointsToAlarm: 3,
      evaluationPeriods: 5,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedWriteCapacityUnits',
        period: cdk.Duration.minutes(1),
        statistic: "sum",
        dimensions: {
          TableName: dynamoConversationTable.tableName
        }
      }),
      threshold: 240,
      alarmName: dynamoConversationTable.tableName + "-ConsumedWriteCapacityUnits",
      actionsEnabled: true
    })

    dynamoConversationWriteAlarm.addAlarmAction({
      bind(scope, alarm) {
          return { alarmActionArn: dynamoSnsTopicArn };
      }
    });
  }
}

module.exports = { CdkStack }
