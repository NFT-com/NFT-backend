import * as aws from '@pulumi/aws'

import { ec2 } from '@pulumi/awsx'

import { getStage } from '../helper'

export const createVPC = (provider : aws.Provider): ec2.Vpc => {
  const stage = getStage()
  return new ec2.Vpc('vpc', {
    cidrBlock: '10.0.0.0/16',
    numberOfAvailabilityZones: 3,
    numberOfNatGateways: 1,
    subnets: [
      { type: 'public', name: stage },
      { type: 'private', name: stage },
    ],
  }, { provider : provider})
}
