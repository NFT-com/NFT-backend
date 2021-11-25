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
import { deployInfra, getResourceName, getSharedInfraOutput } from '../helper'
import { createEBInstance } from './beanstalk'

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
      Update: true,
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
  const workDir = upath.joinSafe(__dirname, '..', '..', 'packages', 'gql')
  const sourceFile = upath.joinSafe(workDir, '.env.example')
  const envFileStr = fs.readFileSync(sourceFile).toString()
  let parsedFile = envfile.parse(envFileStr)
  parsedFile = omit(parsedFile, 'PORT', 'DB_PORT', 'REDIS_PORT')
  parsedFile['NODE_ENV'] = stackConfig['nodeEnv']
  parsedFile['DB_HOST'] = infraOutput.dbHost
  parsedFile['DB_PASSWORD'] = process.env.DB_PASSWORD || ''
  parsedFile['DB_USE_SSL'] = 'true'
  parsedFile['REDIS_HOST'] = infraOutput.redisHost
  parsedFile['SUPPORTED_NETWORKS'] = stackConfig['supportedNetworks'] || parsedFile['SUPPORTED_NETWORKS']
  parsedFile['LOG_LEVEL'] = stackConfig['logLevel'] || parsedFile['LOG_LEVEL']
  parsedFile['AUTH_MESSAGE'] = process.env.AUTH_MESSAGE || parsedFile['']
  parsedFile['SG_API_KEY'] = process.env.SG_API_KEY || parsedFile['SG_API_KEY']
  // console.log(JSON.stringify(parsedFile))

  const targetFile = upath.joinSafe(workDir, '.env')
  fs.writeFileSync(targetFile, envfile.stringify(parsedFile))
}
