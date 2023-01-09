import { BigNumber, utils } from 'ethers'

import { getDecimalsForContract, getSymbolForContract } from '@nftcom/contract-data'
import { core } from '@nftcom/gql/service'
import { db, defs, entity, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { SearchEngineClient } from '../adapter'

type TxActivityDAO = entity.TxActivity & { order: entity.TxOrder }

const TYPESENSE_HOST = process.env.TYPESENSE_HOST
const PROFILE_CONTRACT = TYPESENSE_HOST.startsWith('dev') ?
  '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' : '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D'

const GK_CONTRACT = TYPESENSE_HOST.startsWith('dev') ?
  '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55' : '0x8fB5a7894AB461a59ACdfab8918335768e411414'

const getListingPrice = (listing: TxActivityDAO): BigNumber => {
  switch(listing?.order?.protocol) {
  case (defs.ProtocolType.LooksRare):
  case (defs.ProtocolType.X2Y2): {
    const order = listing?.order?.protocolData
    return BigNumber.from(order?.price || 0)
  }
  case (defs.ProtocolType.Seaport): {
    const order = listing?.order?.protocolData
    return order?.parameters?.consideration
      ?.reduce((total, consideration) => total.add(BigNumber.from(consideration?.startAmount || 0)), BigNumber.from(0))
  }
  }
}

const getListingCurrencyAddress = (listing: TxActivityDAO): string => {
  switch(listing?.order?.protocol) {
  case (defs.ProtocolType.LooksRare):
  case (defs.ProtocolType.X2Y2): {
    const order = listing?.order?.protocolData
    return order?.currencyAddress ?? order?.['currency']
  }
  case (defs.ProtocolType.Seaport): {
    const order = listing?.order?.protocolData
    return order?.parameters?.consideration?.[0]?.token
  }
  }
}

export const SearchEngineService = (client = SearchEngineClient.create(), repos: any = db.newRepositories()): any => {
  const _calculateNFTScore = (collection: entity.Collection, hasListings: boolean): number => {
    const curatedVal = collection?.isCurated ? 1 : 0
    const officialVal = collection?.isOfficial ? 1 : 0
    const listingsVal = hasListings ? 1 : 0
    return curatedVal + officialVal + listingsVal
  }
  const indexNFTs = async (nfts: entity.NFT[]): Promise<boolean> => {
    if (!nfts.length) return true
    try {
      const listingMap: { [k:string]: TxActivityDAO[] } = (await repos.txActivity
        .findActivitiesForNFTs(nfts, defs.ActivityType.Listing, true))
        .reduce((map, txActivity: TxActivityDAO) => {
          if (helper.isNotEmpty(txActivity.order.protocolData)) {
            const nftIdParts = txActivity.nftId[0].split('/')
            const k = `${nftIdParts[1]}-${nftIdParts[2]}`
            if (map[k]?.length) {
              map[k].push(txActivity)
            } else {
              map[k] = [txActivity]
            }
          }
          return map
        }, {})
      const nftsToIndex = await Promise.all(nfts.map(async (nft) => {
        const ctx = {
          chain: null,
          network: null,
          repositories: repos, // Only repositories is required for this query
          user: null,
          wallet: null,
        }

        const collection = await core.resolveEntityById<entity.NFT, entity.Collection>(
          'contract',
          defs.EntityType.NFT,
          defs.EntityType.Collection,
        )(nft, null, ctx)

        const wallet = await core.resolveEntityById<entity.NFT, entity.Wallet>(
          'walletId',
          defs.EntityType.NFT,
          defs.EntityType.Wallet,
        )(nft, null, ctx)

        const tokenId = nft.tokenId ? BigNumber.from(nft.tokenId).toString() : 'Unknown'
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
        const txActivityListings = listingMap[`${nft.contract}-${nft.tokenId}`]
        const ownerAddr = wallet?.address || ''
        const listings = []
        if (txActivityListings) {
          if (!ownerAddr) {
            const marketplaces = [...new Set(txActivityListings.map((l) => l.order?.exchange))]
              .filter((x) => !!x)
            txActivityListings.sort((a, b) => {
              return b.updatedAt.getTime() - a.updatedAt.getTime()
            })
            const txActivities = marketplaces.map((m) => txActivityListings.find((l) => l.order?.exchange === m))
            for (const txActivity of txActivities) {
              const contractAddress = getListingCurrencyAddress(txActivity)
              listings.push({
                marketplace: txActivity.order?.exchange,
                price: +utils.formatUnits(
                  getListingPrice(txActivity),
                  await getDecimalsForContract(contractAddress),
                ),
                type: undefined,
                currency: await getSymbolForContract(contractAddress),
              })
            }
          } else {
            for (const txActivity of txActivityListings) {
              if (txActivity.walletAddress === ownerAddr &&
                helper.isNotEmpty(txActivity.order.protocolData)) {
                const contractAddress = getListingCurrencyAddress(txActivity)
                listings.push({
                  marketplace: txActivity.order?.exchange,
                  price: +utils.formatUnits(
                    getListingPrice(txActivity),
                    await getDecimalsForContract(contractAddress),
                  ),
                  type: undefined,
                  currency: await getSymbolForContract(contractAddress),
                })
              }
            }
          }
        }
        
        return {
          id: nft.id,
          nftName: nft.metadata?.name || `#${tokenId}`,
          nftType: nft.type,
          tokenId,
          traits,
          listings,
          imageURL: nft.metadata?.imageURL,
          ownerAddr,
          chain: wallet?.chainName || '',
          contractName: collection?.name || '',
          contractAddr: nft.contract || '',
          status: '', //  HasOffers, BuyNow, New, OnAuction
          rarity: parseFloat(nft.rarity) || 0.0,
          isProfile: nft.contract === PROFILE_CONTRACT,
          issuance: collection?.issuanceDate?.getTime() || 0,
          hasListings: listings.length ? 1 : 0,
          listedFloor: 0.0,
          score: _calculateNFTScore(collection, !!listings.length) || 0,
        }
      }))

      return client.insertDocuments('nfts', nftsToIndex)
    } catch (err) {
      Sentry.captureMessage(`Error in indexNFTs: ${err}`)
      throw err
    }
  }

  const deleteNFT = (nftId: string): Promise<boolean> => {
    return client.removeDocument('nfts', nftId)
  }

  const _calculateCollectionScore = (collection: entity.Collection): number => {
    const officialVal = collection.isOfficial ? 1 : 0
    const curatedVal = collection.isCurated ? 1 : 0
    const nftcomVal = [PROFILE_CONTRACT, GK_CONTRACT].includes(collection.contract) ? 1000000 : 0
    return officialVal + curatedVal + nftcomVal
  }
  const indexCollections = async (collections: entity.Collection[]): Promise<boolean> => {
    try {
      const collectionsToIndex = await Promise.all(
        collections
          .filter((collection) => !collection.isSpam)
          .map(async (collection) => {
            const nft = await repos.nft.findOne({
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
              score: _calculateCollectionScore(collection),
            }
          }),
      )

      return client.insertDocuments('collections', collectionsToIndex)
    } catch (err) {
      Sentry.captureMessage(`Error in indexCollections: ${err}`)
      throw err
    }
  }

  const deleteCollections = async (collections: entity.Collection[]): Promise<void> => {
    try {
      await Promise.all(collections.map(async (collection) => {
        await client.removeDocument('collections', collection.id)
      }))
    } catch (err) {
      Sentry.captureMessage(`Error in deleteCollections: ${err}`)
      throw err
    }
  }

  return {
    deleteCollections,
    deleteNFT,
    indexCollections,
    indexNFTs,
  }
}
