import { ec2 as awsEC2 } from '@pulumi/aws'
import { ec2 } from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'

import { getResourceName, isNotEmpty, isProduction } from '../helper'

export type SGOutput = {
  aurora: awsEC2.SecurityGroup
  internalEcs: awsEC2.SecurityGroup
  redis: awsEC2.SecurityGroup
  typesense: awsEC2.SecurityGroup
  web: awsEC2.SecurityGroup
  webEcs: awsEC2.SecurityGroup
}

const buildIngressRule = (
  port: number,
  protocol = 'tcp',
  sourceSecurityGroupId?: pulumi.Output<string>[],
  selfSource?: boolean,
): any => {
  const rule = {
    protocol,
    fromPort: port,
    toPort: port,
  }
  if (isNotEmpty(sourceSecurityGroupId)) {
    return {
      ...rule,
      securityGroups: sourceSecurityGroupId,
    }
  }

  if (selfSource) {
    return {
      ...rule,
      self: selfSource,
    }
  }

  return {
    ...rule,
    cidrBlocks: new ec2.AnyIPv4Location().cidrBlocks,
    ipv6CidrBlocks: new ec2.AnyIPv6Location().ipv6CidrBlocks,
  }
}

const buildEgressRule = (port: number, protocol = 'tcp'): any => ({
  protocol,
  fromPort: port,
  toPort: port,
  cidrBlocks: new ec2.AnyIPv4Location().cidrBlocks,
})

export const createSecurityGroups = (config: pulumi.Config, vpc: ec2.Vpc): SGOutput => {
  const web = new awsEC2.SecurityGroup('sg_web', {
    description: 'Allow traffic from/to web',
    name: getResourceName('web'),
    vpcId: vpc.id,
    ingress: [buildIngressRule(443), buildIngressRule(80)],
    egress: [buildEgressRule(0, '-1')],
  })

  const webEcs = new awsEC2.SecurityGroup('sg_webEcs', {
    description: 'Allow traffic to ECS (gql) service',
    name: getResourceName('webEcs'),
    vpcId: vpc.id,
    ingress: [buildIngressRule(8080, 'tcp', [web.id])],
    egress: [buildEgressRule(0, '-1')],
  })

  const internalEcs = new awsEC2.SecurityGroup('int_ecs', {
    description: 'ECS access to RDS, Redis, etc...',
    name: getResourceName('intEcs'),
    vpcId: vpc.id,
    egress: [buildEgressRule(0, '-1')],
  })

  const aurora = new awsEC2.SecurityGroup('sg_aurora_main', {
    name: getResourceName('aurora-main'),
    description: 'Allow traffic to Aurora (Postgres) main instance',
    vpcId: vpc.id,
    ingress: isProduction()
      ? [
        buildIngressRule(5432, 'tcp', [web.id]),
        buildIngressRule(5432, 'tcp', [webEcs.id]),
        buildIngressRule(5432, 'tcp', [internalEcs.id]),
        buildIngressRule(5432, 'tcp', [pulumi.output('sg-00e5406778c83bb19')]),
        buildIngressRule(5432, 'tcp', [pulumi.output('sg-0bad265e467cdec96')]), // Bastion Host
        buildIngressRule(5432, 'tcp', [pulumi.output('sg-0bd5dceea498f0356')]), // Prod Stream ECS Cluster
      ]
      : [buildIngressRule(5432)],
    egress: [buildEgressRule(5432)],
  })

  const redis = new awsEC2.SecurityGroup('sg_redis_main', {
    name: getResourceName('redis-main'),
    description: 'Allow traffic to Elasticache (Redis) main instance',
    vpcId: vpc.id,
    ingress: isProduction()
      ? [
        buildIngressRule(6379, 'tcp', [web.id]),
        buildIngressRule(6379, 'tcp', [webEcs.id]),
        buildIngressRule(6379, 'tcp', [internalEcs.id]),
        buildIngressRule(6379, 'tcp', [pulumi.output('sg-0bad265e467cdec96')]), // Bastion Host
        buildIngressRule(6379, 'tcp', [pulumi.output('sg-0bd5dceea498f0356')]), // Prod Stream ECS Cluster
      ]
      : [buildIngressRule(6379)],
    egress: [buildEgressRule(6379)],
  })

  const typesenseIngressRules = [
    buildIngressRule(8108, 'tcp', [web.id]),
    buildIngressRule(0, 'tcp', undefined, true),
    buildIngressRule(-1, 'icmp', undefined, true),
  ]
  const typesense = new awsEC2.SecurityGroup('sg_typesense', {
    description: 'Allow traffic to Typesense service',
    name: getResourceName('typesense'),
    vpcId: vpc.id,
    ingress: isProduction()
      ? [
        ...typesenseIngressRules,
        buildIngressRule(0, 'tcp', [pulumi.output('sg-0bad265e467cdec96')]), // Bastion Host
      ]
      : typesenseIngressRules,
    egress: [buildEgressRule(0, '-1')],
  })

  return {
    aurora,
    internalEcs,
    redis,
    typesense,
    web,
    webEcs,
  }
}
