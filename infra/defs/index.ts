export const sharedOutputFileName = 'shared-out.json'

export type SharedInfraOutput = {
  assetBucket: string
  assetBucketRole: string
  dbHost: string
  publicSubnets: string[]
  privateSubnets: string[]
  redisHost: string
  vpcId: string
  typesenseSGId: string
  webSGId: string
  webEcsSGId: string
  gqlECRRepo: string
}
