/**
 *  Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Construct } from "constructs";
import { Stack, StackProps, Duration, CfnOutput, Aws, CustomResource, RemovalPolicy } from 'aws-cdk-lib';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import * as lambda from "aws-cdk-lib/aws-lambda";
import {  Provider } from 'aws-cdk-lib/custom-resources';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CognitoToApiGatewayToLambda } from '@aws-solutions-constructs/aws-cognito-apigateway-lambda';
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import { Cors } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';

export class WildRydesAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceBucket: string = 'wildrydes-us-east-1';
    const sourcePrefix: string = 'WebApplication/1_StaticWebHosting/website/';

    const s3Construct = new CloudFrontToS3(this, 'CloudFrontToS3', {
      insertHttpSecurityHeaders: false,
      bucketProps: {
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        versioned: false
      },
      logS3AccessLogs: false
    });
    const targetBucket: string = s3Construct.s3Bucket?.bucketName || '';

    const s3LambdaFunc = new lambda.Function(this, 'staticContentHandler', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'copy_configure_s3_objects.on_event',
      code: new lambda.AssetCode(`src/static-content`),
      timeout: Duration.minutes(5),
      initialPolicy: [
        new PolicyStatement({
          actions: ["s3:GetObject",
            "s3:ListBucket"],
          resources: [`arn:${Aws.PARTITION}:s3:::${sourceBucket}`,
          `arn:aws:s3:::${sourceBucket}/${sourcePrefix}*`]
        }),
        new PolicyStatement({
          actions: ["s3:ListBucket",
            "s3:GetObject",
            "s3:PutObject",
            "s3:PutObjectAcl",
            "s3:PutObjectVersionAcl",
            "s3:DeleteObject",
            "s3:DeleteObjectVersion",
            "s3:CopyObject"],
          resources: [`arn:${Aws.PARTITION}:s3:::${targetBucket}`,
          `arn:aws:s3:::${targetBucket}/*`]
        }),
      ]
    });
    
    const appConstruct = new CognitoToApiGatewayToLambda(this, 'CognitoToApiGatewayToLambda', {
      lambdaFunctionProps: {
        code: new lambda.AssetCode(`src/business-logic`),
        runtime: lambda.Runtime.NODEJS_14_X,
        handler: 'index.handler'
      },
      cognitoUserPoolProps: {
        userPoolName: 'WileRydes',
        userVerification: {},
        autoVerify: {
          email: true
        },
        selfSignUpEnabled: true
      },
      apiGatewayProps: {
        defaultCorsPreflightOptions: {
          allowOrigins: Cors.ALL_ORIGINS,
          allowMethods: Cors.ALL_METHODS
        }
      }
    });
    
    new LambdaToDynamoDB(this, 'LambdaToDynamoDB', {
      existingLambdaObj: appConstruct.lambdaFunction,
      dynamoTableProps: {
        tableName: 'Rides',
        partitionKey: {
            name: 'RideId',
            type: AttributeType.STRING
        },
        removalPolicy: RemovalPolicy.DESTROY
      }
    });
    
    const customResourceProvider = new Provider(this, 'CustomResourceProvider', {
      onEventHandler: s3LambdaFunc
    });

    new CustomResource(this, 'CustomResource', {
      serviceToken: customResourceProvider.serviceToken,
      properties: {
        SourceBucket: sourceBucket,
        SourcePrefix: sourcePrefix,
        Bucket: targetBucket,
        UserPool: appConstruct.userPool.userPoolId,
        Client: appConstruct.userPoolClient.userPoolClientId,
        Region: Stack.of(this).region,
        RestApi: appConstruct.apiGateway.url
      }
    });
    
    new CfnOutput(this, 'cloudFrontDistributionId', {
      value: s3Construct.cloudFrontWebDistribution.distributionId
    });
    new CfnOutput(this, 'websiteURL', {
      value: 'https://' + s3Construct.cloudFrontWebDistribution.domainName
    });

    new CfnOutput(this, 'websiteBucket', {
      value: targetBucket,
      exportName: 'websiteBucket'
    });
  }
}