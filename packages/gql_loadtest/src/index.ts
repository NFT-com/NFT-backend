import LoadTesting from 'easygraphql-load-tester'
import fs from 'fs'
import { print } from 'graphql'
import path from 'path'

import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'

import * as devArgs from './args.json'
import * as prodArgs from './args-prod.json' // File needs to be updated with data that matches this environment
import * as stagingArgs from './args-staging.json' // File needs to be updated with data that matches this environment

let args = undefined
switch (process.env.NODE_ENV) {
case 'production':
  console.error('Production GQL load testing is not available at this time.')
  process.exit(1)
  args = prodArgs
  break
case 'staging':
  console.error('Staging GQL load testing is not available at this time.')
  process.exit(1)
  args = stagingArgs
  break
default:
  args = devArgs
  break
}

const typesArray = loadFilesSync(path.join(__dirname, '../../gql/src/schema'), { extensions: ['graphql'] })
const typeDefs = mergeTypeDefs(typesArray)
const printedTypeDefs = print(typeDefs)
fs.writeFileSync('joined.graphql', printedTypeDefs)

const easyGraphQLLoadTester = new LoadTesting(printedTypeDefs, args)

const queries = easyGraphQLLoadTester.createQueries({
  selectedQueries: [
    'collection',
    'gkNFTs',
    'nft',
    'nftById',
    // 'nfts',
    'myNFTs',
    // 'collectionNFTs',
    'myProfiles',
    'profile',
    'profilePassive',
    'latestProfiles',
    'me',
    'getMyGenesisKeys',
    'refreshMyNFTs',
    'followProfile',
    'unfollowProfile',
  ],
  withMutations: true,
})

fs.writeFileSync('k6-gql-queries.json', JSON.stringify(queries))