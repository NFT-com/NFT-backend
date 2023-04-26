import * as aws from '@pulumi/aws'

import { getResourceName } from '../helper'

export type RepositoryOut = {
  gql: aws.ecr.Repository
}

export const createGQLRepository = (provider : aws.Provider): aws.ecr.Repository => {
  return new aws.ecr.Repository('ecr_gql', {
    name: getResourceName('gql'),
    imageScanningConfiguration: {
      scanOnPush: true,
    },
  }, { provider: provider })
}

export const createRepositories = (provider : aws.Provider): RepositoryOut => {
  const gqlRepo = createGQLRepository(provider)
  return {
    gql: gqlRepo,
  }
}
