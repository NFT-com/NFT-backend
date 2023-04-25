import {
  fetchTxsFromNFTPort,
  retrieveContractNFTs,
  retrieveNFTDetailsNFTPort,
  saveTransactionsToEntity,
} from '@nftcom/gql/service/nftport.service'
import { clearDB } from '@nftcom/gql/test/util/helpers'
import { testDBConfig } from '@nftcom/misc'
import { db, defs } from '@nftcom/shared/'

jest.setTimeout(150000)

const repositories = db.newRepositories()
let connection

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  createCacheConnection: jest.fn(),
}))

const validateNFTsResponse = (res: any): void => {
  expect(res).toBeDefined()
  expect(res.nfts).toBeDefined()
  expect(res.nfts.length).toBeGreaterThan(0)
  expect(res.contract).toBeDefined()
  expect(res.contract.name).toBeDefined()
  expect(res.contract.symbol).toBeDefined()
  expect(res.contract.type).toBeDefined()
  expect(res.contract.metadata).toBeDefined()
  expect(res.contract.metadata.description).toBeDefined()
  expect(res.contract.metadata.thumbnail_url).toBeDefined()
  expect(res.contract.metadata.cached_thumbnail_url).toBeDefined()
  expect(res.contract.metadata.banner_url).toBeDefined()
  expect(res.contract.metadata.cached_banner_url).toBeDefined()
}

describe('nftport', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.destroy()
  })

  describe('retrieveNFTDetailsNFTPort', () => {
    it('it should retrieve undefined', async () => {
      const contract = '0xd98335861E2FAe4cF42bB3A2E7830740175e7c41'
      const tokenId = '0x00'
      const nftDetails = await retrieveNFTDetailsNFTPort(contract, tokenId, '1')
      expect(nftDetails).toBeDefined()
    })
  })

  describe('retrieveContractNFTs', () => {
    it('it should retrieve nfts of cryptokitty', async () => {
      const contract = '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d'
      const res = await retrieveContractNFTs(contract, '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of cryptopunks', async () => {
      const contract = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB'
      const res = await retrieveContractNFTs(contract, '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of mooncat', async () => {
      const contract = '0xc3f733ca98E0daD0386979Eb96fb1722A1A05E69'
      const res = await retrieveContractNFTs(contract, '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of rare pepe', async () => {
      const contract = '0x937a2cd137FE77dB397c51975b0CaAaa29559CF7'
      const res = await retrieveContractNFTs(contract, '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of ether rock', async () => {
      const contract = '0xA3F5998047579334607c47a6a2889BF87A17Fc02'
      const res = await retrieveContractNFTs(contract, '1')
      validateNFTsResponse(res)
    })
  })

  describe('saveTransactionsToEntity', () => {
    afterAll(async () => {
      await clearDB(repositories)
    })
    it('it should save transactions to nft_port_transaction', async () => {
      const transactions = [
        {
          type: 'sale',
          buyer_address: '0xe70c5207f6389129ac44054e2403210e6377c778',
          seller_address: '0x661e73048ae97e51285cad5d6a6f502c3ace1b98',
          nft: {
            contract_type: 'ERC721',
            contract_address: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
            token_id: '4632',
          },
          quantity: 1,
          price_details: {
            asset_type: 'ETH',
            price: 0.03,
            price_usd: 47.33039780304282,
          },
          transaction_hash: '0xbfc5b85394d0348c9456ad1c281ba6a8c9fb75ab90b6aab179d6b07d57402c77',
          block_hash: '0x7b7465cd17491ff3ce9119b219a282889d51b54e0693dc6e6226e5aac7a31082',
          block_number: 15455056,
          transaction_date: '2022-09-01T20:51:48',
          marketplace: 'opensea',
        },
        {
          type: 'list',
          lister_address: '0xab81377a955fd33034db726bebc7b610bfbdb156',
          nft: {
            contract_type: 'ERC721',
            contract_address: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
            token_id: '4632',
          },
          quantity: 1,
          price_details: {
            asset_type: 'ETH',
            price: 0.03,
          },
          transaction_date: '2022-01-01T12:51:48',
          marketplace: 'opensea',
        },
      ]
      await saveTransactionsToEntity(transactions, '1')
      const nftPortTxs = await repositories.nftPortTransaction.findAll()
      expect(nftPortTxs.length).toEqual(2)
    })
  })

  describe('fetchTxsFromNFTPort', () => {
    beforeAll(async () => {
      await repositories.nftPortTransaction.save({
        type: 'sale',
        buyerAddress: '0xE70C5207f6389129Ac44054E2403210E6377C778',
        sellerAddress: '0x661e73048AE97E51285cad5d6A6f502C3aCE1b98',
        nft: {
          contractType: 'ERC721',
          contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D',
          tokenId: '0x1218',
        },
        quantity: 1,
        priceDetails: {
          assetType: 'ETH',
          price: '0.03',
          priceUSD: '47.33039780304282',
        },
        transactionHash: '0xbfc5b85394d0348c9456ad1c281ba6a8c9fb75ab90b6aab179d6b07d57402c77',
        blockHash: '0x7b7465cd17491ff3ce9119b219a282889d51b54e0693dc6e6226e5aac7a31082',
        blockNumber: '15455056',
        transactionDate: new Date('2099-09-01T20:51:48'),
        marketplace: defs.NFTPortMarketplace.OpenSea,
        chainId: '1',
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })

    it('it should save only the most recent transactions to nft_port_transaction', async () => {
      await fetchTxsFromNFTPort('txByContract', 'ethereum', ['all'], '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d')
      const nftPortTxs = await repositories.nftPortTransaction.findAll()
      expect(nftPortTxs.length).toEqual(51)
    })
  })
})
