import { BigNumber, utils } from 'ethers'

import { getRandomFloat } from '@nftcom/gql/helper/utils'
import { core } from '@nftcom/gql/service'
import { db, defs } from '@nftcom/shared'
import { Collection as CollectionEntity, NFT as NFTEntity, Wallet as WalletEntity } from '@nftcom/shared/db/entity'
import * as Sentry from '@sentry/node'

import { SearchEngineClient } from './search-engine-client'

const TYPESENSE_HOST = process.env.TYPESENSE_HOST
const PROFILE_CONTRACT = process.env.TYPESENSE_HOST.startsWith('dev') ?
  '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' : '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D'

const GK_CONTRACT = process.env.TYPESENSE_HOST.startsWith('dev') ?
  '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55' : '0x8fB5a7894AB461a59ACdfab8918335768e411414'

export class SearchEngineService {

  private _client: SearchEngineClient | Partial<SearchEngineClient>
  private _repos: db.Repository | any

  constructor(client = SearchEngineClient.create(), repos: any = db.newRepositories()) {
    this._client = client
    this._repos = repos
  }

  indexNFTs = async (nfts: NFTEntity[]): Promise<boolean> => {
    try {
      const nftsToIndex = await Promise.all(nfts.map(async (nft) => {
        const ctx = {
          chain: null,
          network: null,
          repositories: this._repos, // Only repositories is required for this query
          user: null,
          wallet: null,
        }

        const collection = await core.resolveEntityById<NFTEntity, CollectionEntity>(
          'contract',
          defs.EntityType.NFT,
          defs.EntityType.Collection,
        )(nft, null, ctx)

        const wallet = await core.resolveEntityById<NFTEntity, WalletEntity>(
          'walletId',
          defs.EntityType.NFT,
          defs.EntityType.Wallet,
        )(nft, null, ctx)

        const tokenId = BigNumber.from(nft.tokenId).toString()
        let traits = []
        if (nft.metadata.traits.length < 100) {
          traits = nft.metadata.traits.map((trait) => {
            return {
              type: trait.type,
              value: `${trait.value}`,
              rarity: parseFloat(trait.rarity) || 0.0,
            }
          })
        }
        return {
          id: nft.id,
          nftName: nft.metadata?.name || `#${tokenId}`,
          nftType: nft.type,
          tokenId,
          traits,
          imageURL: nft.metadata?.imageURL,
          ownerAddr: wallet ? wallet.address : '',
          chain: wallet ? wallet.chainName : '',
          contractName: collection ? collection.name : '',
          contractAddr: nft.contract || '',
          listedFloor: TYPESENSE_HOST.startsWith('prod') ? 0.0 : getRandomFloat(0.3, 2, 2),
          status: '', //  HasOffers, BuyNow, New, OnAuction
          rarity: parseFloat(nft.rarity) || 0.0,
          isProfile: nft.contract === PROFILE_CONTRACT,
        }
      }))

      return this._client.insertDocuments('nfts', nftsToIndex)
    } catch (err) {
      Sentry.captureMessage(`Error in indexNFTs: ${err}`)
      throw err
    }
  }

  deleteNFT = (nftId: string): Promise<boolean> => {
    return this._client.removeDocument('nfts', nftId)
  }

  private _calculateCollectionScore = (collection: CollectionEntity): number => {
    const officialVal = collection.isOfficial ? 1 : 0
    const nftcomVal = [PROFILE_CONTRACT, GK_CONTRACT].includes(collection.contract) ? 1000000 : 0
    return officialVal + nftcomVal
  }
  indexCollections = async (collections: CollectionEntity[]): Promise<boolean> => {
    try {
      const collectionsToIndex = await Promise.all(
        collections
          .filter((collection) => !collection.isSpam)
          .map(async (collection) => {
            const nft = await this._repos.nft.findOne({
              select: ['type'],
              where: {
                contract: utils.getAddress(collection.contract),
                chainId: collection.chainId,
              },
            })

            return {
              id: collection.id,
              contractAddr: collection.contract,
              contractName: collection.name,
              chain: collection.chainId,
              description: collection.description || '',
              issuance: collection.issuanceDate?.getTime() || 0,
              sales: collection.totalSales || 0,
              volume: +collection.totalVolume || 0.0,
              floor: +collection.floorPrice || 0.0,
              nftType: nft?.type || '',
              bannerUrl: collection.bannerUrl || nft?.metadata?.imageURL,
              logoUrl: collection.logoUrl,
              isOfficial: collection.isOfficial || false,
              isCurated: collection.isCurated || false,
              score: this._calculateCollectionScore(collection),
            }
          }),
      )

      return this._client.insertDocuments('collections', collectionsToIndex)
    } catch (err) {
      Sentry.captureMessage(`Error in indexCollections: ${err}`)
      throw err
    }
  }

  deleteCollections = async (collections: CollectionEntity[]): Promise<void> => {
    try {
      await Promise.all(collections.map(async (collection) => {
        await this._client.removeDocument('collections', collection.id)
      }))
    } catch (err) {
      Sentry.captureMessage(`Error in deleteCollections: ${err}`)
      throw err
    }
  }

}
