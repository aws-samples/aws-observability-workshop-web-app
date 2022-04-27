# AWS observability workshop web app

 This simple serverless web application is for use in AWS observability workshop, where participants will explore adding observability features to this simple serverless web application, using AWS and/or other third party observability tools. The web application enables users to request unicorn rides from the Wild Rydes unicorn fleet. The application will present users with an HTML based user interface for indicating the location where they would like to be picked up and will interface on the backend with a RESTful web service to submit the request and dispatch a nearby unicorn. The application will also provide facilities for users to register with the service and log in before requesting rides. 

This use case is designed to be built and deployed into your account from your local environment using the AWS CDK Toolkit (or CLI). For information on the toolkit and how to install and configure it, please see the [guide](https://docs.aws.amazon.com/cdk/latest/guide/cli.html).


## Architecture
The application architecture uses AWS Lambda, Amazon API Gateway, Amazon S3, Amazon DynamoDB, and Amazon Cognito as pictured below:
![Architecture Diagram](architecture.png)

## Deployment steps
Below are the steps to deploy the use case:

```
# Install dependencies
npm install

# Setup CDK bootstrap to prepare environment for CDK deployment
cdk bootstrap

# Deploy the use case
cdk deploy

```

## Deployment Verification
After the stack is deployed successfully, go to the Outputs tab in AWS Cloudformation console of WildRydesAppStack, it should show the 'websiteURL', click on the link and follow the steps below:

* Visit /register.html under your website domain, register youself.

* Verify the registered user email.

* Visit /ride.html under your website domain.

* If you are redirected to the sign in page, sign in with the user you created in the previous module.

* After the map has loaded, click anywhere on the map to set a pickup location.

* Choose Request Unicorn. You should see a notification in the right sidebar that a unicorn is on its way and then see a unicorn icon fly to your pickup location.


***
&copy; Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.