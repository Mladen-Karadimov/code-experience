#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
//const { CdkStack } = require('../lib/cdk-stack');
const { CdkStackFe } = require('../lib/cdk-stack-fe');
const { CdkStackGlobal } = require('../lib/cdk-stack-global');

//config:
let service = "somes-app";
let health_check = "__health"

let aws_account = "12345567890"

let stage = process.env.CDK_DEPLOY_ENV || "dev";
let root_domain = stage == 'prod' ? "dummy.com" : "dummy.org";
let domain = stage == 'prod' ? service + "." + root_domain : service + "-" + stage + "." + root_domain
let domain_api =  service + "-" + stage + "-api" + "." + root_domain


console.log("Deploying to", stage)

const app = new cdk.App();
const stack = new CdkStackFe(app, "somesApp", {
    stackName: "infra-" + stage + "-" + service,
    description: "CDK deployment for ECS somes-app.",
    env: { 
      account: aws_account, //process.env.CDK_DEFAULT_ACCOUNT || "12345567890",
      region: "eu-west-1", //process.env.CDK_DEFAULT_REGION || "eu-west-1",
      stage: stage,
      port: 80,
      cpu: 256,
      ram: 512,
      health_check: health_check,
      vpc_name: "infra-" + stage + "-vpc",
      service: service,
      root_domain: root_domain,
      domain: domain,
      domain_api: domain_api,
      certificate: stage == 'prod' ? "7b04262d-7597-1234-8f82-5a6d19b81ef2" : "0ebaa4f5-741d-40d4-1234-9abf1fa7d3fe",
      cert_us_east_1: stage == 'prod' ? "ad380f45-7f78-1234-b6e9-c39245fa15e5" : "d2d44fb6-6dee-1234-96a8-6338a6e457cc"
      }
  });

  cdk.Tags.of(stack).add('ClientName', 'infra')
  cdk.Tags.of(stack).add('Role', service)
  cdk.Tags.of(stack).add('Environment', stage)

  //Deploy 2nd stack to US-EAST-1 Region, for healthcheck, WAF and other global
  const stack_us = new CdkStackGlobal(app, "somesAppGlobal", {
    stackName: "infra-" + stage + "-" + service + "-global",
    description: "CDK deployment for ECS somes-app - global.",
    env: {
      account: aws_account,
      region: "us-east-1",
      stage: stage,
      health_check: health_check,
      service: service,
      domain_api: domain_api
    }
  });

  cdk.Tags.of(stack_us).add('ClientName', 'infra')
  cdk.Tags.of(stack_us).add('Role', service)
  cdk.Tags.of(stack_us).add('Environment', stage)