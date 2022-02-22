#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { CdkStack } = require('../lib/cdk-stack');

let stage = process.env.CDK_DEPLOY_ENV || "dev";

console.log("Deploying to", stage)

const app = new cdk.App();
const stack = new CdkStack(app, "someProxy", {
    stackName: "infra-" + stage + "-some-proxy",
    description: "CDK deployment for ECS some-proxy.",
    env: { 
      account: "12345567890", //process.env.CDK_DEFAULT_ACCOUNT || "12345567890",
      region: "eu-west-1", //process.env.CDK_DEFAULT_REGION || "eu-west-1",
      stage: stage,
      port: 80,
      cpu: 256,
      ram: 512,
      vpc_name: "infra-" + stage + "-vpc",
      service: "some-proxy",
      root_domain: stage == 'prod' ? "dummy.com" : "dummy.org",
      certificate: stage == 'prod' ? "7b04262d-7597-4213-8f82-asd1231d" : "00123dksalk-741d-40d4-1234-9abf1fa7d3fe"
      }
  });

cdk.Tags.of(stack).add('ClientName', 'infra')
cdk.Tags.of(stack).add('Role', 'some-proxy')
cdk.Tags.of(stack).add('Environment', stage)