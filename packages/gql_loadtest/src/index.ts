import LoadTesting from 'easygraphql-load-tester'
import { print } from 'graphql'
import path from 'path'

import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'

import * as args from './args.json'

const typesArray = loadFilesSync(path.join(__dirname, '../../gql/src/schema'), { extensions: ['graphql'] })
const typeDefs = mergeTypeDefs(typesArray)
const printedTypeDefs = print(typeDefs)

const easyGraphQLLoadTester = new LoadTesting(printedTypeDefs, args)

easyGraphQLLoadTester.k6('k6.js', {
  selectedQueries: ['collection', 'gkNFTs'],
  vus: 10,
  duration: '10s',
  queryFile: true,
  out: ['json=my_test_result.json'],
})