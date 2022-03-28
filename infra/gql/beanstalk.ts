import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { SharedInfraOutput } from '../defs'
import { getResourceName } from '../helper'

const createEBRole = (): aws.iam.Role => {
  const role = new aws.iam.Role('role_gql_eb', {
    name: getResourceName('gql-eb.us-east-1'),
    description: 'Role for GQL Elasticbeanstalk',
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'elasticbeanstalk.amazonaws.com',
          },
        },
      ],
    },
  })

  new aws.iam.RolePolicyAttachment('policy_gql_eb_health', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth',
  })
  new aws.iam.RolePolicyAttachment('policy_gql_eb_service', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkService',
  })

  return role
}

const createInstanceProfileRole = (): aws.iam.Role => {
  const role = new aws.iam.Role('role_gql_ec2eb', {
    name: getResourceName('gql-eb-ec2.us-east-1'),
    description: 'Role for GQL EC2 instance managed by EB',
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'ec2.amazonaws.com',
          },
        },
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'ssm.amazonaws.com',
          },
        },
      ],
    },
  })

  new aws.iam.RolePolicyAttachment('policy_gql_ec2eb_ecr', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly',
  })
  new aws.iam.RolePolicyAttachment('policy_gql_ec2e_ebweb', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier',
  })
  new aws.iam.RolePolicyAttachment('policy_gql_ec2eb_ssm', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
  })
  new aws.iam.RolePolicyAttachment('policy_gql_ec2eb_ssmauto', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonSSMAutomationRole',
  })

  return role
}

const createInstanceProfile = (): aws.iam.InstanceProfile => {
  const role = createInstanceProfileRole()
  return new aws.iam.InstanceProfile('profile_gql_ebec2', {
    name: getResourceName('gql-eb-ec2'),
    role: role.name,
  })
}

const createApplication = (): aws.elasticbeanstalk.Application => {
  return new aws.elasticbeanstalk.Application('application_gql', {
    name: getResourceName('gql'),
  })
}

const createApplicationVersion = (
  infraOutput: SharedInfraOutput,
  application: aws.elasticbeanstalk.Application,
  appFilName: string,
): aws.elasticbeanstalk.ApplicationVersion => {
  return new aws.elasticbeanstalk.ApplicationVersion('app_version_gql', {
    application,
    bucket: infraOutput.deployAppBucket,
    key: appFilName,
  })
}

export const createEBInstance = (
  config: pulumi.Config,
  infraOutput: SharedInfraOutput,
  appFileName: string,
): aws.elasticbeanstalk.Environment => {
  const ebRole = createEBRole()
  const profile = createInstanceProfile()
  const application = createApplication()
  const applicationVersion = createApplicationVersion(infraOutput, application, appFileName)
  const instance = config.require('ebInstance')
  const autoScaleMax = config.require('ebAutoScaleMax')

  return new aws.elasticbeanstalk.Environment('environment_gql', {
    name: getResourceName('gql'),
    description: 'GQL server environment',
    application: application.name,
    version: applicationVersion,
    tier: 'WebServer',
    solutionStackName: '64bit Amazon Linux 2 v3.4.10 running Docker',
    //  EB Command Options for Reference: 
    //  https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/command-options-general.html#command-options-general-elbv2
    settings: [
      {
        namespace: 'aws:ec2:instances',
        name: 'InstanceTypes',
        value: instance,
      },
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        name: 'IamInstanceProfile',
        value: profile.name,
      },
      {
        namespace: 'aws:elasticbeanstalk:environment',
        name: 'EnvironmentType',
        value: 'LoadBalanced',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment',
        name: 'LoadBalancerType',
        value: 'application',
      },
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        name: 'RootVolumeSize',
        value: '8',
      },
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        name: 'RootVolumeType',
        value: 'gp2',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        name: 'HealthCheckPath',
        value: '/.well-known/apollo/server-health',
      },
      {
        namespace: 'aws:elbv2:loadbalancer',
        name: 'SecurityGroups',
        value: infraOutput.webSGId,
      },
      {
        namespace: 'aws:elbv2:loadbalancer',
        name: 'ManagedSecurityGroup',
        value: infraOutput.webSGId,
      },
      {
        namespace: 'aws:ec2:vpc',
        name: 'VPCId',
        value: infraOutput.vpcId,
      },
      {
        namespace: 'aws:ec2:vpc',
        name: 'AssociatePublicIpAddress',
        value: 'true',
      },
      {
        namespace: 'aws:ec2:vpc',
        name: 'Subnets',
        value: infraOutput.publicSubnets.join(','),
      },
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        name: 'SecurityGroups',
        value: infraOutput.webSGId,
      },
      {
        namespace: 'aws:ec2:vpc',
        name: 'ELBSubnets',
        value: infraOutput.publicSubnets.join(','),
      },
      {
        namespace: 'aws:autoscaling:asg',
        name: 'Availability Zones',
        value: 'Any 3',
      },
      {
        namespace: 'aws:elbv2:listener:default',
        name: 'ListenerEnabled',
        value: 'true',
      },
      {
        namespace: 'aws:elbv2:listener:443',
        name: 'DefaultProcess',
        value: 'default',
      },
      {
        namespace: 'aws:elbv2:listener:443',
        name: 'ListenerEnabled',
        value: 'true',
      },
      {
        namespace: 'aws:elbv2:listener:443',
        name: 'Protocol',
        value: 'HTTPS',
      },
      {
        namespace: 'aws:elbv2:listener:443',
        name: 'SSLCertificateArns',
        value: 'arn:aws:acm:us-east-1:016437323894:certificate/0c01a3a8-59c4-463a-87ec-5c487695f09e',
      },
      {
        namespace: 'aws:elbv2:listener:443',
        name: 'SSLPolicy',
        value: 'ELBSecurityPolicy-2016-08',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        name: 'Protocol',
        value: 'HTTP',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        name: 'Port',
        value: '80',
      },
      {
        namespace: 'aws:elasticbeanstalk:environment',
        name: 'ServiceRole',
        value: ebRole.name,
      },
      {
        namespace: 'aws:elasticbeanstalk:healthreporting:system',
        name: 'SystemType',
        value: 'enhanced',
      },
      {
        namespace: 'aws:elasticbeanstalk:managedactions',
        name: 'ManagedActionsEnabled',
        value: 'true',
      },
      {
        namespace: 'aws:elasticbeanstalk:managedactions',
        name: 'PreferredStartTime',
        value: 'Sat:08:00',
      },
      {
        namespace: 'aws:elasticbeanstalk:managedactions:platformupdate',
        name: 'UpdateLevel',
        value: 'minor',
      },
      {
        namespace: 'aws:autoscaling:asg',
        name: 'MinSize',
        value: '2',
      },
      {
        namespace: 'aws:autoscaling:asg',
        name: 'MaxSize',
        value: autoScaleMax,
      },
      {
        namespace: 'aws:autoscaling:updatepolicy:rollingupdate',
        name: 'RollingUpdateEnabled',
        value: 'true',
      },
      {
        namespace: 'aws:autoscaling:updatepolicy:rollingupdate',
        name: 'RollingUpdateType',
        value: 'Health',
      },
      {
        namespace: 'aws:autoscaling:updatepolicy:rollingupdate',
        name: 'MinInstancesInService',
        value: '1',
      }
      ,
      {
        namespace: 'aws:elasticbeanstalk:command',
        name: 'DeploymentPolicy',
        value: 'Rolling',
      },
      {
        namespace: 'aws:autoscaling:updatepolicy:rollingupdate',
        name: 'MaxBatchSize',
        value: '1',
      },
      {
        namespace: 'aws:elasticbeanstalk:command',
        name: 'BatchSizeType',
        value: 'Fixed',
      },
      {
        namespace: 'aws:elasticbeanstalk:command',
        name: 'BatchSize',
        value: '1',
      },
      {
        namespace: 'aws:autoscaling:trigger',
        name: 'MeasureName',
        value: 'CPUUtilization',
      },
      {
        namespace: 'aws:autoscaling:trigger',
        name: 'Unit',
        value: 'Percent',
      },
      {
        namespace: 'aws:autoscaling:trigger',
        name: 'LowerThreshold',
        value: '20',
      },
      {
        namespace: 'aws:autoscaling:trigger',
        name: 'UpperThreshold',
        value: '80',
      },
      {
        namespace: 'aws:elasticbeanstalk:cloudwatch:logs',
        name: 'StreamLogs',
        value: 'true',
      },
      {
        namespace: 'aws:elasticbeanstalk:cloudwatch:logs',
        name: 'DeleteOnTerminate',
        value: 'true',
      },
      {
        namespace: 'aws:elasticbeanstalk:cloudwatch:logs',
        name: 'RetentionInDays',
        value: '7',
      },
      {
        namespace: 'aws:elasticbeanstalk:cloudwatch:logs:health',
        name: 'HealthStreamingEnabled',
        value: 'false',
      },
      {
        namespace: 'aws:elasticbeanstalk:cloudwatch:logs:health',
        name: 'DeleteOnTerminate',
        value: 'true',
      },
      {
        namespace: 'aws:elasticbeanstalk:cloudwatch:logs:health',
        name: 'RetentionInDays',
        value: '7',
      },
    ],
  })
}
