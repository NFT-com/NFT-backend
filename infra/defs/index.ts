export const sharedOutputFileName = 'shared-out.json'

export type SharedInfraOutput = {
  assetBucket: string
  dbHost: string
  deployAppBucket: string
  publicSubnets: string[]
  redisHost: string
  vpcId: string
  webSGId: string
  gqlECRRepo: string
}
