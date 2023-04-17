import { BigNumber, utils } from 'ethers'

import { getDecimalsForContract, getSymbolForContract } from '@nftcom/contract-data'
import { getNftName } from '@nftcom/gql/service/nft.service'
import { getListingCurrencyAddress, getListingPrice } from '@nftcom/gql/service/txActivity.service'
import { defs, helper } from '@nftcom/shared'

import { CollectionDao, NFTDao, TxActivityDAO } from './model'

const PROFILE_CONTRACT = '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D'
const GK_CONTRACT = '0x8fB5a7894AB461a59ACdfab8918335768e411414'

const LARGEST_COLLECTIONS = defs.LARGE_COLLECTIONS.slice(0, 3)

export const collectionNames = ['collections', 'nfts']

const getRandomFloat = (min, max, decimals): number => {
  const str = (Math.random() * (max - min) + min).toFixed(decimals)

  return parseFloat(str)
}

const calculateCollectionScore = (collection: CollectionDao): number => {
  const officialVal = collection.isOfficial ? 1 : 0
  const curatedVal = collection.isCurated ? 1 : 0
  const nftcomVal = [PROFILE_CONTRACT, GK_CONTRACT].includes(collection.contract) ? 1000000 : 0
  return officialVal + curatedVal + nftcomVal
}

const calculateNFTScore = (collection: CollectionDao, hasListings: boolean): number => {
  const curatedVal = collection?.isCurated ? 1 : 0
  const officialVal = collection?.isOfficial ? 1 : 0
  const listingsVal = hasListings ? 1 : 0
  const score = curatedVal + officialVal + listingsVal
  if (score === 3) {
    const multiplier = LARGEST_COLLECTIONS.includes(collection.contract) ? 9_000_000 : 10_000_000
    return score + Math.floor(Math.random() * multiplier)
  }
  return score
}

export const mapCollectionData = async (
  collectionName: string,
  data: any[],
  repos: any,
  listingMap?: { [k: string]: TxActivityDAO[] },
): Promise<any[]> => {
  const result = []
  switch (collectionName) {
    case 'collections':
      for (let i = 0; i < data.length; i++) {
        const collection = data[i] as CollectionDao
        if (collection.isSpam) continue
        result.push({
          id: collection.id,
          contractAddr: collection.contract,
          contractName: collection.name,
          chain: collection.chainId,
          description: collection.description || '',
          issuance: collection.issuanceDate?.getTime() || 0,
          sales: collection.totalSales || 0,
          volume: +collection.totalVolume || 0.0,
          floor: +collection.floorPrice || 0.0,
          nftType: collection.nft?.type || '',
          bannerUrl: collection.bannerUrl || collection.nft?.metadata?.imageURL,
          logoUrl: collection.logoUrl,
          isOfficial: collection.isOfficial || false,
          isCurated: collection.isCurated || false,
          score: calculateCollectionScore(collection),
        })
      }
      break
    case 'nfts':
      for (let i = 0; i < data.length; i++) {
        const nft = data[i] as NFTDao

        const tokenId = BigNumber.from(nft.tokenId).toString()
        const profile =
          nft.contract === PROFILE_CONTRACT
            ? await repos.profile.findOne({
                where: {
                  tokenId: BigNumber.from(nft.tokenId).toString(),
                },
              })
            : undefined
        let traits = []
        if (nft.metadata?.traits?.length < 100) {
          traits = nft.metadata.traits.map(trait => {
            return {
              type: trait.type,
              value: `${trait.value}`,
              rarity: parseFloat(trait.rarity) || 0.0,
            }
          })
        }
        const txActivityListings = listingMap[`${nft.contract}-${nft.tokenId}`]
        const ownerAddr = nft.owner || nft.wallet?.address || ''
        const listings = []
        if (txActivityListings) {
          if (!ownerAddr) {
            const marketplaces = [...new Set(txActivityListings.map(l => l.order?.exchange))].filter(x => !!x)
            txActivityListings.sort((a, b) => {
              return b.updatedAt.getTime() - a.updatedAt.getTime()
            })
            const txActivities = marketplaces.map(m => txActivityListings.find(l => l.order?.exchange === m))
            for (const txActivity of txActivities) {
              const contractAddress = getListingCurrencyAddress(txActivity)
              listings.push({
                marketplace: txActivity.order?.exchange,
                price: +utils.formatUnits(getListingPrice(txActivity), await getDecimalsForContract(contractAddress)),
                type: undefined,
                currency: await getSymbolForContract(contractAddress),
              })
            }
          } else {
            for (const txActivity of txActivityListings) {
              if (txActivity.walletAddress === ownerAddr && helper.isNotEmpty(txActivity.order.protocolData)) {
                const contractAddress = getListingCurrencyAddress(txActivity)
                listings.push({
                  marketplace: txActivity.order?.exchange,
                  price: +utils.formatUnits(getListingPrice(txActivity), await getDecimalsForContract(contractAddress)),
                  type: undefined,
                  currency: await getSymbolForContract(contractAddress),
                })
              }
            }
          }
        }
        const gkExpirationYear = 3021
        result.push({
          id: nft.id,
          nftName:
            nft.metadata?.name ||
            getNftName(nft.metadata, undefined, { name: nft.collection?.name }, tokenId) ||
            `#${tokenId}`,
          nftType: nft.type,
          tokenId,
          traits,
          listings,
          imageURL: nft.metadata?.imageURL,
          ownerAddr,
          chain: nft.wallet ? nft.wallet.chainName : '',
          contractName: nft.collection ? nft.collection.name : '',
          contractAddr: nft.contract || '',
          listedFloor: process.env.TYPESENSE_HOST.startsWith('prod') ? 0.0 : getRandomFloat(0.3, 2, 2),
          status: '', //  HasOffers, BuyNow, New, OnAuction
          rarity: parseFloat(nft.rarity) || 0.0,
          isProfile: nft.contract === PROFILE_CONTRACT,
          isProfileGKMinted: profile?.expireAt ? profile?.expireAt.getFullYear() >= gkExpirationYear : false,
          issuance: nft.collection?.issuanceDate ? new Date(nft.collection?.issuanceDate).getTime() : 0,
          hasListings: listings.length ? 1 : 0,
          score: calculateNFTScore(nft.collection, !!listings.length),
        })
      }
      break
    default:
      break
  }
  return result
}
