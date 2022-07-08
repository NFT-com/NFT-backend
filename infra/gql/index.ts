import * as archiver from 'archiver'
import * as console from 'console'
import * as envfile from 'envfile'
import * as fs from 'fs'
import * as jyml from 'js-yaml'
import { omit } from 'lodash'
import * as process from 'process'
import * as upath from 'upath'

import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { SharedInfraOutput } from '../defs'
import { deployInfra, getEnv, getResourceName, getSharedInfraOutput } from '../helper'
import { createEBInstance } from './beanstalk'
import { createEcsService } from './ecs'

const createAndUploadEBDeployFile = async (
  config: pulumi.Config,
  infraOutput: SharedInfraOutput,
): Promise<string> => {
  await pulumi.log.info('Create Elasticbeanstalk archive file with Dockerrun.aws.json...')

  const ecrImage = `${process.env.ECR_REGISTRY}/${infraOutput.gqlECRRepo}:latest`
  const dockerFile = {
    AWSEBDockerrunVersion: '1',
    Image: {
      Name: ecrImage,
      Update: 'true',
    },
    Ports: [{
      ContainerPort: '8080',
      HostPort: '80',
    }],
  }
  const fileName = `${getResourceName('qql')}-${new Date().toISOString()}.zip`
  const file = upath.joinSafe(__dirname, fileName)
  const output = fs.createWriteStream(file)
  const archive = archiver.create('zip', {
    zlib: { level: 9 },
  })
  archive.pipe(output)
  archive.append(JSON.stringify(dockerFile), { name: 'Dockerrun.aws.json' })

  // add nginx config file to eb application zip to upload > 1MB
  const nginxFile = __dirname + '/proxy.conf'
  archive.append(fs.createReadStream(nginxFile), { name: '.platform/nginx/conf.d/proxy.conf' })

  await archive.finalize()

  new aws.s3.BucketObject('default', {
    bucket: infraOutput.deployAppBucket,
    key: fileName,
    source: new pulumi.asset.FileAsset(file),
  })

  return fileName
}

const pulumiProgram = async (): Promise<Record<string, any> | void> => {
  const config = new pulumi.Config()
  const sharedInfraOutput = getSharedInfraOutput()
  const appFileName = await createAndUploadEBDeployFile(config, sharedInfraOutput)
  createEBInstance(config, sharedInfraOutput, appFileName)
  createEcsService(config, sharedInfraOutput)
}

export const createGQLServer = (
  preview?: boolean,
): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.gql.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}

export const updateGQLEnvFile = (): void => {
  console.log('Read shared infra output from file...')
  const infraOutput = getSharedInfraOutput()

  console.log('Read stack yaml file...')
  const ymlFileName = `Pulumi.${process.env.STAGE}.gql.${process.env.AWS_REGION}.yaml`
  const ymlFile = upath.joinSafe(__dirname, 'stack', ymlFileName)
  const ymlDoc = jyml.load(fs.readFileSync(ymlFile).toString()) as { [key: string]: any }
  const stackConfig = ymlDoc.config as { [key: string]: string }

  console.log('Update server environment file...')
  const env = getEnv('gql', '.env.example')
  let { parsedFile } = env
  parsedFile = omit(parsedFile, 'PORT', 'DB_PORT', 'REDIS_PORT')
  parsedFile['NODE_ENV'] = stackConfig['nftcom:nodeEnv']
  parsedFile['DB_HOST'] = infraOutput.dbHost
  parsedFile['DB_PASSWORD'] = process.env.DB_PASSWORD || ''
  parsedFile['DB_USE_SSL'] = 'true'
  parsedFile['REDIS_HOST'] = infraOutput.redisHost
  parsedFile['SUPPORTED_NETWORKS'] = process.env.SUPPORTED_NETWORKS || parsedFile['SUPPORTED_NETWORKS']
  parsedFile['LOG_LEVEL'] = stackConfig['nftcom:logLevel'] || parsedFile['LOG_LEVEL']
  parsedFile['AUTH_MESSAGE'] = process.env.AUTH_MESSAGE || parsedFile['AUTH_MESSAGE']
  parsedFile['SG_API_KEY'] = process.env.SG_API_KEY || parsedFile['SG_API_KEY']
  parsedFile['ASSET_BUCKET'] = infraOutput.assetBucket
  parsedFile['ASSET_BUCKET_ROLE'] = infraOutput.assetBucketRole
  parsedFile['ETH_GAS_STATION_API_KEY'] = process.env.ETH_GAS_STATION_API_KEY || parsedFile['ETH_GAS_STATION_API_KEY']
  parsedFile['PROFILE_AUCTION_END_PASSWORD'] = process.env.PROFILE_AUCTION_END_PASSWORD || parsedFile['PROFILE_AUCTION_END_PASSWORD']
  parsedFile['MNEMONIC'] = process.env.MNEMONIC || parsedFile['MNEMONIC']
  parsedFile['MNEMONIC_RINKEBY'] = process.env.MNEMONIC_RINKEBY || parsedFile['MNEMONIC_RINKEBY']
  parsedFile['HCS_TOPIC_ID'] = process.env.HCS_TOPIC_ID || parsedFile['HCS_TOPIC_ID']
  parsedFile['HCS_ACCOUNT_ID'] = process.env.HCS_ACCOUNT_ID || parsedFile['HCS_ACCOUNT_ID']
  parsedFile['HCS_PRIVATE_KEY'] = process.env.HCS_PRIVATE_KEY || parsedFile['HCS_PRIVATE_KEY']
  parsedFile['PUBLIC_SALE_KEY'] = process.env.PUBLIC_SALE_KEY || parsedFile['PUBLIC_SALE_KEY']
  parsedFile['SHARED_MINT_SECRET'] = process.env.SHARED_MINT_SECRET || parsedFile['SHARED_MINT_SECRET']
  parsedFile['SERVER_CONFIG'] = process.env.SERVER_CONFIG || ''
  parsedFile['SENTRY_DSN'] = process.env.SENTRY_DSN || parsedFile['SENTRY_DSN']
  parsedFile['ZMOK_API_URL'] = process.env.ZMOK_API_URL || parsedFile['ZMOK_API_URL']
  parsedFile['ALCHEMY_API_KEY'] = process.env.ALCHEMY_API_KEY || parsedFile['ALCHEMY_API_KEY']
  parsedFile['ALCHEMY_API_URL'] = process.env.ALCHEMY_API_URL || parsedFile['ALCHEMY_API_URL']
  parsedFile['INFURA_API_KEY'] = process.env.INFURA_API_KEY || parsedFile['INFURA_API_KEY']
  parsedFile['TYPESENSE_HOST'] = process.env.TYPESENSE_HOST || parsedFile['TYPESENSE_HOST']
  parsedFile['TYPESENSE_API_KEY'] = process.env.TYPESENSE_API_KEY || parsedFile['TYPESENSE_API_KEY']
  parsedFile['MINTED_PROFILE_EVENTS_MAX_BLOCKS'] = process.env.MINTED_PROFILE_EVENTS_MAX_BLOCKS || parsedFile['MINTED_PROFILE_EVENTS_MAX_BLOCKS']
  parsedFile['PROFILE_NFTS_EXPIRE_DURATION'] = process.env.PROFILE_NFTS_EXPIRE_DURATION || parsedFile['PROFILE_NFTS_EXPIRE_DURATION']
  parsedFile['BULL_MAX_REPEAT_COUNT'] = process.env.BULL_MAX_REPEAT_COUNT || parsedFile['BULL_MAX_REPEAT_COUNT']
  parsedFile['OPENSEA_API_KEY'] = process.env.OPENSEA_API_KEY || parsedFile['OPENSEA_API_KEY']
  parsedFile['PROFILE_SCORE_EXPIRE_DURATION'] = process.env.PROFILE_SCORE_EXPIRE_DURATION || parsedFile['PROFILE_SCORE_EXPIRE_DURATION']
  parsedFile['TEST_DB_HOST'] = process.env.TEST_DB_HOST || parsedFile['TEST_DB_HOST']
  parsedFile['TEST_DB_DATABASE'] = process.env.TEST_DB_DATABASE || parsedFile['TEST_DB_DATABASE']
  parsedFile['TEST_DB_USERNAME'] = process.env.TEST_DB_USERNAME || parsedFile['TEST_DB_USERNAME']
  parsedFile['TEST_DB_PORT'] = process.env.TEST_DB_PORT || parsedFile['TEST_DB_PORT']
  parsedFile['TEST_DB_PASSWORD'] = process.env.TEST_DB_PASSWORD || parsedFile['TEST_DB_PASSWORD']
  parsedFile['TEST_DB_USE_SSL'] = process.env.TEST_DB_USE_SSL || parsedFile['TEST_DB_USE_SSL']

  console.log(JSON.stringify(parsedFile))

  const targetFile = upath.joinSafe(env.workDir, '.env')
  fs.writeFileSync(targetFile, envfile.stringify(parsedFile))
}
