import { BigNumber, utils } from 'ethers'

import { getDecimalsForContract, getSymbolForContract } from '@nftcom/contract-data'
import { defs, helper } from '@nftcom/shared'

import { CollectionDao, NFTDao, TxActivityDAO } from './model'

const PROFILE_CONTRACT = process.env.TYPESENSE_HOST.startsWith('dev') ?
  '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' : '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D'

const GK_CONTRACT = process.env.TYPESENSE_HOST.startsWith('dev') ?
  '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55' : '0x8fB5a7894AB461a59ACdfab8918335768e411414'

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
  return (+collection.isCurated) + (+collection.isOfficial) + (+hasListings)
}

const getListingPrice = (listing: TxActivityDAO): BigNumber => {
  switch(listing?.order?.protocol) {
  case (defs.ProtocolType.LooksRare):
  case (defs.ProtocolType.X2Y2): {
    const order = listing?.order?.protocolData
    return BigNumber.from(order?.price ?? 0)
  }
  case (defs.ProtocolType.Seaport): {
    const order = listing?.order?.protocolData
    return order?.parameters?.consideration
      ?.reduce((total, consideration) => total.add(BigNumber.from(consideration?.startAmount ?? 0)), BigNumber.from(0))
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

export const mapCollectionData = async (
  collectionName: string,
  data: any[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _repos: any,
  listingMap?: any,
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
      let traits = []
      if (nft.metadata?.traits?.length < 100) {
        traits = nft.metadata.traits.map((trait) => {
          return {
            type: trait.type,
            value: `${trait.value}`,
            rarity: parseFloat(trait.rarity) || 0.0,
          }
        })
      }
      const txActivityListings = listingMap[`${nft.contract}-${nft.tokenId}`]
      const ownerAddr = nft.wallet?.address || ''
      const listings = []
      if (txActivityListings) {
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
      result.push({
        id: nft.id,
        nftName: nft.metadata?.name ? `${nft.metadata?.name}` : `#${tokenId}`,
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
