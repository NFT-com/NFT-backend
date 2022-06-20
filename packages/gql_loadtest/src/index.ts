import LoadTesting from 'easygraphql-load-tester'
import fs from 'fs'
import { print } from 'graphql'
import path from 'path'

import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'

import * as args from './args.json'

const typesArray = loadFilesSync(path.join(__dirname, '../../gql/src/schema'), { extensions: ['graphql'] })
const typeDefs = mergeTypeDefs(typesArray)
const printedTypeDefs = print(typeDefs)

const easyGraphQLLoadTester = new LoadTesting(printedTypeDefs, args)

const queries = easyGraphQLLoadTester.createQueries({ selectedQueries: [
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
] })

fs.writeFileSync('k6-gql-queries.json', JSON.stringify(queries))