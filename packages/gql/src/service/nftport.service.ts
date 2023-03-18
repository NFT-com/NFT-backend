import { BigNumber, ethers } from 'ethers'
import qs from 'qs'
import { IsNull } from 'typeorm'

import { cache } from '@nftcom/cache'
import { chainFromId } from '@nftcom/gql/helper/utils'
import { fetchData, getNFTPortInterceptor } from '@nftcom/nftport-client'
import { _logger, db, defs } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const NFTPORT_API_BASE_URL = 'https://api.nftport.xyz/v0'
const NFTPORT_TIME_OUT = 30 * 1000
const NFTPORT_SAVE_AMOUNT_LIMIT = 10000

const logger = _logger.Factory(_logger.Context.NFTPort)
const repositories = db.newRepositories()

export interface NFTPortRarityAttributes {
  trait_type: string
  value: string
  statistics: {
    total_count: number
    prevalence: number
  }
}

interface Trait {
  trait_type?: string
  value?: string
  trait_value?: string
}

export interface NFTPortNFT {
  nft?: {
    chain?: string
    contract_address?: string
    token_id?: string
    metadata_url?: string
    metadata?: {
      attributes?: Array<Trait>
      name?: string
      description?: string
      image?: string
      image_url?: string
    }
    file_information?: {
      height?: number
      width?: number
      file_size?: number
    }
    file_url?: string
    animation_url?: string
    cached_file_url?: string
    cached_animation_url?: string
    creator_address?: string
    mint_date?: string
    rarity?: {
      strategy?: string
      score?: number
      rank?: number
      max_rank?: number
      updated_date?: string
    }
    attributes?: NFTPortRarityAttributes[]
  }
  owner?: string
  contract?: {
    name?: string
    symbol?: string
    type?: string // ERC721, ERC1155, CRYPTO_PUNKS
    metadata?: {
      description?: string
      cached_thumbnail_url?: string
      cached_banner_url?: string
    }
  }
  status?: string
  status_message?: string
}

export const retrieveNFTDetailsNFTPort = async (
  contract: string,
  tokenId: string,
  chainId: string,
  refreshMetadata = false,
): Promise<NFTPortNFT | undefined> => {
  try {
    logger.debug(`starting retrieveNFTDetailsNFTPort: ${contract} ${tokenId} ${chainId}`)
    const key = `NFTPORT_NFT_DETAIL_${chainId}_${contract}_${tokenId}`
    const cachedData = await cache.get(key)
    if (cachedData)
      return JSON.parse(cachedData)
    const chain = chainFromId(chainId)
    if (!chain) return
    const nftInterceptor = getNFTPortInterceptor(NFTPORT_API_BASE_URL)
    const tokenIdInteger = ethers.BigNumber.from(tokenId).toString()
    const url = `/nfts/${contract}/${tokenIdInteger}`
    const res = await nftInterceptor.get(url, {
      params: {
        chain: chain,
        refresh_metadata: refreshMetadata || undefined,
        include: ['attributes'],
      },
      paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
    })
    if (res && res?.data) {
      await cache.set(key, JSON.stringify(res.data), 'EX', 60 * 10)
      return res.data as NFTPortNFT
    } else {
      return undefined
    }
  } catch (err) {
    logger.error(JSON.stringify(err))
    logger.error(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    Sentry.captureMessage(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    return undefined
  }
}

export const retrieveContractNFTs = async (
  contract: string,
  chainId: string,
  refreshMetadata = false,
): Promise<any> => {
  try {
    logger.debug(`starting retrieveContractNFTs: ${contract} ${chainId}`)
    const key = `NFTPORT_CONTRACT_NFTS_${chainId}_${contract}`
    const cachedData = await cache.get(key)
    if (cachedData)
      return JSON.parse(cachedData)
    const chain = chainFromId(chainId)
    if (!chain) return
    const nftInterceptor = getNFTPortInterceptor(NFTPORT_API_BASE_URL)
    const url = `/nfts/${contract}`
    const res = await nftInterceptor.get(url, {
      params: {
        chain: chain,
        refresh_metadata: refreshMetadata || undefined,
      },
    })
    if (res && res?.data) {
      await cache.set(key, JSON.stringify(res.data), 'EX', 60 * 10)
      return res.data
    } else {
      return undefined
    }
  } catch (err) {
    logger.error(`Error in retrieveContractNFTs: ${err}`)
    Sentry.captureMessage(`Error in retrieveContractNFTs: ${err}`)
    return undefined
  }
}

const marketplaceString = (
  marketplace: string | null,
): defs.NFTPortMarketplace | null => {
  if (!marketplace) return null
  switch(marketplace) {
  case 'opensea': return defs.NFTPortMarketplace.OpenSea
  case 'rarible': return defs.NFTPortMarketplace.Rarible
  case 'cryptopunks': return defs.NFTPortMarketplace.Cryptopunks
  case 'looksrare': return defs.NFTPortMarketplace.LooksRare
  case 'x2y2': return defs.NFTPortMarketplace.X2Y2
  default: return null
  }
}

/*
 * Keep NFTPort transactions to matching table
 */
export const saveTransactionsToEntity = async (
  transactions: any[],
  chainId: string,
): Promise<void> => {
  try {
    await Promise.allSettled(
      transactions.map(async (tx) => {
        try {
          if (tx.type.includes('transfer') || tx.type.includes('mint') || tx.type.includes('burn')) {
            const isExisting = await repositories.nftPortTransaction.findOne({
              where: {
                type: tx.type,
                contractAddress: ethers.utils.getAddress(tx.contract_address),
                tokenId: BigNumber.from(tx.token_id).toHexString(),
                transactionHash: tx.transaction_hash,
                blockNumber: tx.block_number,
                blockHash: tx.block_hash,
                chainId,
              },
            })
            if (!isExisting) {
              await repositories.nftPortTransaction.save({
                type: tx.type,
                ownerAddress: tx.owner_address ? ethers.utils.getAddress(tx.owner_address) : null,
                transferFrom: tx.transfer_from ? ethers.utils.getAddress(tx.transfer_from) : null,
                transferTo: tx.transfer_to ? ethers.utils.getAddress(tx.transfer_to) : null,
                contractAddress: ethers.utils.getAddress(tx.contract_address),
                tokenId: BigNumber.from(tx.token_id).toHexString(),
                quantity: Number(tx.quantity),
                transactionHash: tx.transaction_hash,
                blockNumber: tx.block_number,
                blockHash: tx.block_hash,
                transactionDate: new Date(tx.transaction_date),
                chainId,
              })
            }
          } else if (tx.type.includes('sale')) {
            const whereQuery = {
              type: tx.type,
              buyerAddress: ethers.utils.getAddress(tx.buyer_address),
              sellerAddress: ethers.utils.getAddress(tx.seller_address),
              transactionHash: tx.transaction_hash,
              blockNumber: tx.block_number,
              blockHash: tx.block_hash,
              marketplace: marketplaceString(tx.marketplace) ?? IsNull(),
              chainId,
            }
            const txs = await repositories.nftPortTransaction.findSaleListingBidsByNFT(
              tx.nft.contract_address,
              tx.nft.token_id,
              whereQuery,
            )
            if (!txs.length) {
              await repositories.nftPortTransaction.save({
                type: tx.type,
                buyerAddress: tx.buyer_address ? ethers.utils.getAddress(tx.buyer_address) : null,
                sellerAddress: tx.seller_address ? ethers.utils.getAddress(tx.seller_address) : null,
                nft: {
                  contractType: tx.nft.contract_type,
                  contractAddress: ethers.utils.getAddress(tx.nft.contract_address),
                  tokenId: BigNumber.from(tx.nft.token_id).toHexString(),
                },
                quantity: Number(tx.quantity),
                priceDetails: {
                  assetType: tx.price_details.asset_type,
                  contractAddress: tx.price_details.contract_address ?
                    ethers.utils.getAddress(tx.price_details.contract_address) : null,
                  price: tx.price_details.price ? tx.price_details.price.toString() : null,
                  priceUSD: tx.price_details.price_usd ? tx.price_details.price_usd.toString() : null,
                },
                transactionHash: tx.transaction_hash,
                blockNumber: tx.block_number,
                blockHash: tx.block_hash,
                transactionDate: new Date(tx.transaction_date),
                marketplace: marketplaceString(tx.marketplace),
                chainId,
              })
            }
          } else if (tx.type.includes('list')) {
            const whereQuery = {
              type: tx.type,
              listerAddress: ethers.utils.getAddress(tx.lister_address),
              transactionDate: new Date(tx.transaction_date),
              marketplace: marketplaceString(tx.marketplace) ?? IsNull(),
              chainId,
            }
            const txs = await repositories.nftPortTransaction.findSaleListingBidsByNFT(
              tx.nft.contract_address,
              tx.nft.token_id,
              whereQuery,
            )
            if (!txs.length) {
              await repositories.nftPortTransaction.save({
                type: tx.type,
                listerAddress: tx.lister_address ? ethers.utils.getAddress(tx.lister_address) : null,
                nft: {
                  contractType: tx.nft.contract_type,
                  contractAddress: ethers.utils.getAddress(tx.nft.contract_address),
                  tokenId: BigNumber.from(tx.nft.token_id).toHexString(),
                },
                quantity: Number(tx.quantity),
                priceDetails: {
                  assetType: tx.price_details.asset_type,
                  contractAddress: tx.price_details.contract_address ?
                    ethers.utils.getAddress(tx.price_details.contract_address) : null,
                  price: tx.price_details.price ? tx.price_details.price.toString() : null,
                  priceUSD: tx.price_details.price_usd ? tx.price_details.price_usd.toString() : null,
                },
                transactionHash: tx.transaction_hash ?? null,
                blockNumber: tx.block_number ?? null,
                blockHash: tx.block_hash ?? null,
                transactionDate: new Date(tx.transaction_date),
                marketplace: marketplaceString(tx.marketplace),
                chainId,
              })
            }
          } else if (tx.type.includes('bid')) {
            const whereQuery = {
              type: tx.type,
              bidderAddress: ethers.utils.getAddress(tx.bidder_address),
              transactionDate: new Date(tx.transaction_date),
              marketplace: marketplaceString(tx.marketplace) ?? IsNull(),
              chainId,
            }
            const txs = await repositories.nftPortTransaction.findSaleListingBidsByNFT(
              tx.nft.contract_address,
              tx.nft.token_id,
              whereQuery,
            )
            if (!txs.length) {
              await repositories.nftPortTransaction.save({
                type: tx.type,
                bidderAddress: tx.bidder_address ? ethers.utils.getAddress(tx.bidder_address) : null,
                nft: {
                  contractType: tx.nft.contract_type,
                  contractAddress: ethers.utils.getAddress(tx.nft.contract_address),
                  tokenId: BigNumber.from(tx.nft.token_id).toHexString(),
                },
                quantity: Number(tx.quantity),
                priceDetails: {
                  assetType: tx.price_details.asset_type,
                  contractAddress: tx.price_details.contract_address ?
                    ethers.utils.getAddress(tx.price_details.contract_address) : null,
                  price: tx.price_details.price ? tx.price_details.price.toString() : null,
                  priceUSD: tx.price_details.price_usd ? tx.price_details.price_usd.toString() : null,
                },
                transactionHash: tx.transaction_hash ?? null,
                blockNumber: tx.block_number ?? null,
                blockHash: tx.block_hash ?? null,
                transactionDate: new Date(tx.transaction_date),
                marketplace: marketplaceString(tx.marketplace),
                chainId,
              })
            }
          }
        } catch (err) {
          logger.error(`err in saveTransactionsToEntity: ${err}`)
        }
      }),
    )
  } catch (err) {
    logger.error(`err in saveTransactionsToEntity: ${err}`)
  }
}

const toSaveTxsBeStopped = (
  txs : any[],
  transactionDate: Date,
): boolean => {
  const tx = txs.find((tx) => new Date(tx.transaction_date) < transactionDate)
  return !!tx
}

export const fetchTxsFromNFTPort = async (
  endpoint: string,
  chain: string,
  type: string[],
  contractAddress: string,
  tokenId?: string,
): Promise<void> => {
  try {
    const availableTypes = ['transfer', 'burn', 'mint', 'sale', 'list', 'all']
    const filteredType = type.filter((t) => availableTypes.indexOf(t) !== -1)
    let args
    if (tokenId) {
      args = [contractAddress, BigNumber.from(tokenId).toString()]
    } else {
      args = [contractAddress]
    }
    if (chain === 'goerli') return
    const chainId = '1'
    // pull latest tx for collection ofr NFT from table
    const latestTx = await repositories.nftPortTransaction.getLatestTxForCollectionOrNFT(
      chainId,
      contractAddress,
      tokenId,
    )
    // fetch txs from NFTPort client we built
    let res = await fetchData(endpoint, args, {
      queryParams: {
        chain,
        type: filteredType,
        page_size: 50,
        cacheSeconds: 60 * 10,
      },
    })
    let stopSavingTxs = false
    let exit = false
    if (res?.transactions) {
      if (latestTx) {
        stopSavingTxs = toSaveTxsBeStopped(res.transactions, latestTx.transactionDate)
      }
      await saveTransactionsToEntity(res.transactions, chainId)
      const savedCount = await repositories.nftPortTransaction.countForCollectionOrNFT(
        chainId,
        contractAddress,
        tokenId,
      )
      // We should prevent calling API for already saved data
      if (res?.continuation && !stopSavingTxs && savedCount < NFTPORT_SAVE_AMOUNT_LIMIT) {
        let continuation = res?.continuation
        while (!exit) {
          try {
            const call = async (): Promise<any> => {
              res = await fetchData(endpoint, args, {
                queryParams: {
                  chain,
                  type: filteredType,
                  continuation,
                  page_size: 50,
                  cacheSeconds: 60 * 10,
                },
              })
              if (res?.transactions) {
                if (latestTx) {
                  stopSavingTxs = toSaveTxsBeStopped(res.transactions, latestTx.transactionDate)
                }
                await saveTransactionsToEntity(res.transactions, chainId)
                const savedCount = await repositories.nftPortTransaction.countForCollectionOrNFT(
                  chainId,
                  contractAddress,
                  tokenId,
                )
                // We prevent saving more than 10K transactions
                if (savedCount >= NFTPORT_SAVE_AMOUNT_LIMIT) {
                  exit = true
                }
                // We should prevent calling API for already saved data
                if (stopSavingTxs) {
                  exit = true
                } else if (res?.continuation) {
                  continuation = res?.continuation
                } else {
                  exit = true
                }
              } else {
                exit = true
              }
            }
            const timer = async (): Promise<any> => {
              await new Promise((resolve) => {
                setTimeout(resolve, NFTPORT_TIME_OUT)
              })
              if (tokenId)
                throw Error(`Timeout reached in fetchTxsFromNFTPort: contract ${contractAddress}, tokenId ${BigNumber.from(tokenId).toString()}`)
              else
                throw Error(`Timeout reached in fetchTxsFromNFTPort: contract ${contractAddress}`)
            }
            return await Promise.race([call(), timer()])
          } catch (err) {
            logger.error(`Error in fetchTxsFromNFTPort: ${err}`)
            Sentry.captureMessage(`Error in fetchTxsFromNFTPort: ${err}`)
            exit = true
          }
        }
      }
    } else {
      return
    }
  } catch (err) {
    logger.error(`Error in fetchTxsFromNFTPort: ${err}`)
    Sentry.captureMessage(`Error in fetchTxsFromNFTPort: ${err}`)
    return
  }
}
