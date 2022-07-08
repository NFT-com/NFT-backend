import { Connection } from 'typeorm'

const sharedLibs = jest.requireActual('@nftcom/shared')

import { ethers } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import { db, defs } from '@nftcom/shared'

import { getTestApolloServer } from './util/testApolloServer'

jest.setTimeout(120000)

jest.mock('@nftcom/shared', () => {
  return {
    ...sharedLibs,
  }
})

let testServer
let connection: Connection
const nftOneId = 'Nuh1PcgqydP0TvaUpRy7v'
const nftTwoId = 'q3A2Jl068b3VOHKvcvqcN'
const nftThreeId = 'x_qmivHI1GFP-NcHdI0pJ'

const repositories = db.newRepositories()

describe('collection resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
    testServer = getTestApolloServer(repositories,
      { id: 'test-user-id' },
      { id: 'test-wallet-id' })
  })

  afterAll(async () => {
    const collections = await repositories.collection.findAll()
    const edges = await repositories.edge.findAll()
    const collectionIds = collections.map((collection) => collection.id)
    const edgeIds = edges.map((edge) => edge.id)
    await repositories.collection.hardDeleteByIds(collectionIds)
    await repositories.edge.hardDeleteByIds(edgeIds)

    await testServer.stop()
    if (!connection) return
    await connection.close()
  })

  describe('removeDuplicates', () => {
    beforeAll(async () => {
      const collectionOne = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xbf50b6C8d80266723422774BC989315660d8F4C2'),
        name: 'Nintendo Pokemon TCG',
      })
      const collectionTwo = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xbf50b6C8d80266723422774BC989315660d8F4C2'),
        name: 'Nintendo Pokemon TCG',
      })
      const collectionThree = await repositories.collection.save({
        contract: ethers.utils.getAddress('0x91BEB9f3576F8932722153017EDa8aEf9A0B4A77'),
        name: 'tinyMusktweetz',
      })

      await repositories.edge.save({
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: collectionOne.id,
        thatEntityId: nftOneId,
        edgeType: defs.EdgeType.Includes,
      })

      await repositories.edge.save({
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: collectionTwo.id,
        thatEntityId: nftTwoId,
        edgeType: defs.EdgeType.Includes,
      })

      await repositories.edge.save({
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: collectionThree.id,
        thatEntityId: nftThreeId,
        edgeType: defs.EdgeType.Includes,
      })
    })

    it('should remove duplicated collections', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation removeDuplicates($contracts: [Address!]!) { removeDuplicates(contracts: $contracts) { message } }',
        variables: {
          contracts: ['0xbf50b6C8d80266723422774BC989315660d8F4C2', '0x91BEB9f3576F8932722153017EDa8aEf9A0B4A77'],
        },
      })

      expect(result.data.removeDuplicates.message).toBeDefined()
      expect(result.data.removeDuplicates.message).toEqual('Removed collection duplicates')
      const existingCollections = await repositories.collection.findAll()
      expect(existingCollections.length).toEqual(2)
      const edgeOne = await repositories.edge.findOne({
        where: {
          thisEntityType: defs.EntityType.Collection,
          thatEntityType: defs.EntityType.NFT,
          thatEntityId: nftOneId,
          edgeType: defs.EdgeType.Includes,
        },
      })
      const edgeTwo = await repositories.edge.findOne({
        where: {
          thisEntityType: defs.EntityType.Collection,
          thatEntityType: defs.EntityType.NFT,
          thatEntityId: nftTwoId,
          edgeType: defs.EdgeType.Includes,
        },
      })
      expect(edgeOne.thisEntityId).toEqual(edgeTwo.thisEntityId)
    })
  })
})
