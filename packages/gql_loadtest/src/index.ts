import LoadTesting from 'easygraphql-load-tester'
import { print } from 'graphql'
import path from 'path'

import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'

const typesArray = loadFilesSync(path.join(__dirname, '../../gql/src/schema'), { extensions: ['graphql'] })
const typeDefs = mergeTypeDefs(typesArray)
const printedTypeDefs = print(typeDefs)

const args = {
  myBids: {},
  topBids: {},
  collection: {
    contract: {},
    network: {},
  },
  myCurations: {
    pageInput: {},
  },
  getAsks: {
    makerAddress: {},
    pageInput: {},
  },
  getNFTAsks: {
    nftTokenId: 1,
    nftContractAddress: {},
  },
  getNFTOffers: {
    nftTokenId: 1,
    nftContractAddress: {},
  },
  filterAsks: {},
  getBids: {},
  getSwaps: {},
  getUserSwaps: {},
  getContracts: {},
  convertEnsToEthAddress: {},
  gkNFTs: {},
  nft: {},
  nftById: {},
  nfts: {},
  myNFTs: {},
  curationNFTs: {},
  collectionNFTs: {},
  profileFollowers: {},
  profilesFollowedByMe: {},
  myProfiles: {},
  profile: {},
  profilePassive: {},
  blockedProfileURI: {},
  insiderReservedProfiles: {},
  latestProfiles: {},
  me: {},
  getMyGenesisKeys: {},
  isAddressWhitelisted: {},
  watchlist: {},
}

const easyGraphQLLoadTester = new LoadTesting(printedTypeDefs, args)

easyGraphQLLoadTester.k6('k6.js', {
  vus: 10,
  duration: '10s',
  queryFile: true,
  out: ['json=my_test_result.json'],
})