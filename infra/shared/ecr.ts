import * as aws from '@pulumi/aws'

import { getResourceName } from '../helper'

export type RepositoryOut = {
  gql: aws.ecr.Repository
  indexer: aws.ecr.Repository
}

export const createGQLRepository = (): aws.ecr.Repository => {
  return new aws.ecr.Repository('ecr_gql', {
    name: getResourceName('gql'),
    imageScanningConfiguration: {
      scanOnPush: true,
    },
  })
}

export const createIndexerRepository = (): aws.ecr.Repository => {
  return new aws.ecr.Repository('ecr_indexer', {
    name: getResourceName('indexer'),
    imageScanningConfiguration: {
      scanOnPush: true,
    },
  })
}

export const createRepositories = (): RepositoryOut => {
  const gqlRepo = createGQLRepository()
  const indexerRepo = createIndexerRepository()
  return {
    gql: gqlRepo,
    indexer: indexerRepo,
  }
}
