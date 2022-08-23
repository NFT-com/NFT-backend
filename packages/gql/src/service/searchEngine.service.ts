import { BigNumber, utils } from 'ethers'

import { SearchEngineClient } from '@nftcom/gql/adapter/searchEngineClient'
import { getRandomFloat } from '@nftcom/gql/helper/utils'
import { core } from '@nftcom/gql/service'
import { db, defs } from '@nftcom/shared'
import { Collection as CollectionEntity, NFT as NFTEntity, Wallet as WalletEntity } from '@nftcom/shared/db/entity'

const TYPESENSE_HOST = process.env.TYPESENSE_HOST

export class SearchEngineService {

  private _client: SearchEngineClient | Partial<SearchEngineClient>
  private _repos: db.Repository | any

  constructor(client = SearchEngineClient.create(), repos: any = db.newRepositories()) {
    this._client = client
    this._repos = repos
  }

  indexNFTs = async (nfts: NFTEntity[]): Promise<boolean> => {
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
      const traits = []
      const profileContract = TYPESENSE_HOST.startsWith('dev') ?
        '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' : '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D'
      return {
        id: nft.id,
        nftName: nft.metadata?.name || `${collection?.name + ' '|| ''}#${tokenId}`,
        nftType: nft.type,
        tokenId,
        traits,
        imageURL: nft.metadata?.imageURL,
        ownerAddr: wallet.address,
        chain: wallet.chainName,
        contractName: collection?.name || '',
        contractAddr: nft.contract,
        marketplace: TYPESENSE_HOST === 'prod-typesense.nft.com' ? '' : 'OpenSea',
        listingType: '',
        listedPx: TYPESENSE_HOST === 'prod-typesense.nft.com' ? 0.0 : getRandomFloat(0.3, 2, 2),
        currency: TYPESENSE_HOST === 'prod-typesense.nft.com' ? '' : 'ETH',
        status: '',
        isProfile: nft.contract === profileContract,
      }
    }))
  
    return this._client.insertDocuments('nfts', nftsToIndex)
  }

  deleteNFT = (nftId: string): Promise<boolean> => {
    return this._client.removeDocument('nfts', nftId)
  }

  indexCollections = async (collections: CollectionEntity[]): Promise<boolean> => {
    const collectionsToIndex = await Promise.all(collections.map(async (collection) => {
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
        description: '',
        floor: 0.0,
        nftType: nft.type || '',
      }
    }))
    
    return this._client.insertDocuments('collections', collectionsToIndex)
  }

  deleteCollections = async (collections: CollectionEntity[]): Promise<void> => {
    await Promise.all(collections.map(async (collection) => {
      await this._client.removeDocument('collections', collection.id)
    }))
  }

}
