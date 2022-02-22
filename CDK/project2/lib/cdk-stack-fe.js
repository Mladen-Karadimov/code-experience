const { CdkStackBe } = require('./cdk-stack-be');

const cdk = require('@aws-cdk/core');
const ec2 = require('@aws-cdk/aws-ec2');
const s3 = require('@aws-cdk/aws-s3');
const iam = require('@aws-cdk/aws-iam');
const s3deploy = require('@aws-cdk/aws-s3-deployment');
const cloudfront = require('@aws-cdk/aws-cloudfront');
const cert = require('@aws-cdk/aws-certificatemanager');
const route53 = require('@aws-cdk/aws-route53');
const targets = require('@aws-cdk/aws-route53-targets/lib');

class CdkStackFe extends CdkStackBe {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);
    // --- Deploy Front End ---
    const domain = props.env.domain
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.env.root_domain });

    // Content bucket
    const bucket = new s3.Bucket(this, 'somesBucket', {
      bucketName: "infra-" + props.env.stage + "-" + props.env.service + "-frontend", 
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED
    });

    const bucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: [
        "s3:GetObject"
        //"s3:ListBucket"
      ],
      resources: [
        "arn:aws:s3:::" + bucket.bucketName,
        "arn:aws:s3:::" + bucket.bucketName + "/*"
      ]
    });

    bucket.addToResourcePolicy(bucketPolicy)

    // CloudFront distribution that provides HTTPS
    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'MyDistribution', {
      comment: props.env.service + " " + props.env.stage + " frontend",
      viewerCertificate: {
        aliases: [domain],
        props: {
          acmCertificateArn: "arn:aws:acm:us-east-1:" + props.env.account + ":certificate/" + props.env.cert_us_east_1,
          sslSupportMethod: "sni-only",
          minimumProtocolVersion: "TLSv1.2_2018"
        }
      },
      originConfigs: [{
        customOriginSource: {
          domainName: bucket.bucketWebsiteDomainName,
          originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        },
        behaviors : [{
          isDefaultBehavior: true,
          allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD,
          cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD,
          compress: false,
          defaultTtl: 0,
          forwardedValues: {
            queryString: true,
            cookies: {
              forward: "all"
            }
          },
          maxTtl: 0,
          minTtl: 0
        }]
      }, {
        customOriginSource: {
          domainName: props.env.domain_api,
          originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        },
        behaviors : [{
          allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL,
          cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.ALL,
          compress: false,
          defaultTtl: 0,
          forwardedValues: {
            queryString: true,
            cookies: {
              forward: "all"
            },
            headers: ["*"]
          },
          maxTtl: 0,
          minTtl: 0,
          pathPattern: "/api*"
        }]
      }],
      errorConfigurations: [{
        errorCode: 403,
        errorCachingMinTtl: 0,
        responseCode: 200,
        responsePagePath: "/index.html"
      }, {
        errorCode: 404,
        errorCachingMinTtl: 0,
        responseCode: 200,
        responsePagePath: "/index.html"
      }],
      defaultRootObject: "index.html"

    });

    // Route53 alias record for the CloudFront distribution
    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: domain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone
    });
/*
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [ s3deploy.Source.bucket(bucket, '../application/tabs/build') ],
      destinationBucket: bucket,
      //distribution
      //cacheControl
    });
*/
  }
}

module.exports = { CdkStackFe }
