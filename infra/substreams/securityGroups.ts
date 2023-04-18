import { ec2 as awsEC2 } from '@pulumi/aws'
import { ec2 } from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'

import { getResourceName, isNotEmpty, isProduction } from '../helper'

export type SGOutput = {
  ec2SG: awsEC2.SecurityGroup
  rdsSG: awsEC2.SecurityGroup
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

export const buildSecurityGroups = (config: pulumi.Config, vpc: string): SGOutput => {
  const substreams: awsEC2.SecurityGroup = new awsEC2.SecurityGroup('substreams-ec2-sg', {
    name: getResourceName('streams-instance_v2'),
    description: 'Allow SSH and egress traffic',
    vpcId: vpc,
    ingress: [buildIngressRule(22)],
    egress: [buildEgressRule(0, '-1')],
  })

  const rds = new awsEC2.SecurityGroup('postgres-sg', {
    name: getResourceName('substreams-postgres_v2'),
    description: 'Allow traffic to Substreams (Postgres) main instance',
    vpcId: vpc,
    ingress: isProduction() ? [buildIngressRule(5432, 'tcp', [substreams.id])] : [buildIngressRule(5432)],
    egress: [buildEgressRule(5432)],
  })

  return {
    ec2SG: substreams,
    rdsSG: rds,
  }
}
