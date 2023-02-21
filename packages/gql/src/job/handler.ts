import { Job } from 'bull'
import { BigNumber, ethers, utils } from 'ethers'

import { cache } from '@nftcom/cache'
import { provider } from '@nftcom/gql/helper'
import { getPastLogs } from '@nftcom/gql/job/marketplace.job'
import { _logger, contracts, db, defs, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { core } from '../service'
import HederaConsensusService from '../service/hedera.service'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

export const repositories = db.newRepositories()

enum EventName {
  AssociateEvmUser = 'AssociateEvmUser',
  CancelledEvmAssociation = 'CancelledEvmAssociation',
  ClearAllAssociatedAddresses = 'ClearAllAssociatedAddresses',
  AssociateSelfWithUser = 'AssociateSelfWithUser',
  RemovedAssociateProfile = 'RemovedAssociateProfile',
  SetAssociatedContract = 'SetAssociatedContract',
}

type Log = {
  logs: ethers.providers.Log[]
  latestBlockNumber: number
}

const profileAuctionInterface = new utils.Interface(contracts.profileAuctionABI())
const nftResolverInterface = new utils.Interface(contracts.NftResolverABI())

export const getCachedBlock = async (chainId: number, key: string): Promise<number> => {
  const startBlock = chainId == 5 ? 7128515 :
    chainId == 1 ? 14675454 :
      14675454

  try {
    const cachedBlock = await cache.get(key)

    // get 1000 blocks before incase of some blocks not being handled correctly
    if (cachedBlock) return Number(cachedBlock) > 1000
      ? Number(cachedBlock) - 1000 : Number(cachedBlock)
    else return startBlock
  } catch (e) {
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in getCachedBlock: ${e}`)
    return startBlock
  }
}

export const chainIdToCacheKeyProfile = (chainId: number): string => {
  return `minted_profile_cached_block_${chainId}`
}

export const chainIdToCacheKeyResolverAssociate = (chainId: number): string => {
  return `resolver_associate_cached_block_${chainId}`
}

export const getResolverEvents = async (
  topics: any[],
  chainId: number,
  provider: ethers.providers.BaseProvider,
  address: string,
): Promise<Log> => {
  const latestBlock = await provider.getBlock('latest')
  try {
    const maxBlocks = process.env.MINTED_PROFILE_EVENTS_MAX_BLOCKS
    const key = chainIdToCacheKeyResolverAssociate(chainId)
    const cachedBlock = await getCachedBlock(chainId, key)
    const logs = await getPastLogs(
      provider,
      address,
      topics,
      cachedBlock,
      latestBlock.number,
      Number(maxBlocks),
    )
    return {
      logs: logs,
      latestBlockNumber: latestBlock.number,
    }
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in getResolverEvents: ${e}`)
    return {
      logs: [],
      latestBlockNumber: latestBlock.number,
    }
  }
}

export const getMintedProfileEvents = async (
  topics: any[],
  chainId: number,
  provider: ethers.providers.BaseProvider,
  address: string,
): Promise<Log> => {
  const latestBlock = await provider.getBlock('latest')
  try {
    const maxBlocks = process.env.MINTED_PROFILE_EVENTS_MAX_BLOCKS
    const key = chainIdToCacheKeyProfile(chainId)
    const cachedBlock = await getCachedBlock(chainId, key)
    const logs = await getPastLogs(
      provider,
      address,
      topics,
      cachedBlock,
      latestBlock.number,
      Number(maxBlocks),
    )
    return {
      logs: logs,
      latestBlockNumber: latestBlock.number,
    }
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in getMintedProfileEvents: ${e}`)
    return {
      logs: [],
      latestBlockNumber: latestBlock.number,
    }
  }
}

export const nftResolverParseLog = (log: any): any => {
  return nftResolverInterface.parseLog(log)
}

export const profileAuctionParseLog = (log: any): any => {
  return profileAuctionInterface.parseLog(log)
}

export const getEthereumEvents = async (job: Job): Promise<any> => {
  try {
    const { chainId } = job.data

    const topics = [
      helper.id('MintedProfile(address,string,uint256,uint256,uint256)'),
    ]

    const topics2 = [
      [
        helper.id('AssociateEvmUser(address,string,address)'),
        helper.id('CancelledEvmAssociation(address,string,address)'),
        helper.id('ClearAllAssociatedAddresses(address,string)'),
        helper.id('AssociateSelfWithUser(address,string,address)'),
        helper.id('RemovedAssociateProfile(address,string,address)'),
      ],
    ]

    const chainProvider = provider.provider(Number(chainId))
    const address = helper.checkSum(contracts.profileAuctionAddress(chainId))
    const nftResolverAddress = helper.checkSum(contracts.nftResolverAddress(chainId))

    logger.debug(`👾 getting Ethereum Events chainId=${chainId}`)

    const log = await getMintedProfileEvents(topics, Number(chainId), chainProvider, address)
    const log2 = await getResolverEvents(
      topics2,
      Number(chainId),
      chainProvider,
      nftResolverAddress,
    )

    logger.debug({ log2: log2.logs.length }, `nft resolver outgoing associate events chainId=${chainId}`)
    log2.logs.map(async (unparsedEvent) => {
      let evt
      try {
        evt = nftResolverParseLog(unparsedEvent)
        logger.info(evt.args, `Found event ${evt.name} with chainId: ${chainId}`)

        if (evt.name === EventName.AssociateEvmUser) {
          const [owner,profileUrl,destinationAddress] = evt.args
          const event = await repositories.event.findOne({
            where: {
              chainId,
              contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
              eventName: evt.name,
              txHash: unparsedEvent.transactionHash,
              ownerAddress: owner,
              blockNumber: Number(unparsedEvent.blockNumber),
              profileUrl: profileUrl,
              destinationAddress: helper.checkSum(destinationAddress),
            },
          })
          if (!event) {
            await repositories.event.save(
              {
                chainId,
                contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
                eventName: evt.name,
                txHash: unparsedEvent.transactionHash,
                ownerAddress: owner,
                blockNumber: Number(unparsedEvent.blockNumber),
                profileUrl: profileUrl,
                destinationAddress: helper.checkSum(destinationAddress),
              },
            )
            logger.debug(`New NFT Resolver AssociateEvmUser event found. ${ profileUrl } (owner = ${owner}) is associating ${ destinationAddress }. chainId=${chainId}`)
          }
        } else if (evt.name == EventName.CancelledEvmAssociation) {
          const [owner,profileUrl,destinationAddress] = evt.args
          const event = await repositories.event.findOne({
            where: {
              chainId,
              contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
              eventName: evt.name,
              txHash: unparsedEvent.transactionHash,
              ownerAddress: owner,
              blockNumber: Number(unparsedEvent.blockNumber),
              profileUrl: profileUrl,
              destinationAddress: helper.checkSum(destinationAddress),
            },
          })
          if (!event) {
            await repositories.event.save(
              {
                chainId,
                contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
                eventName: evt.name,
                txHash: unparsedEvent.transactionHash,
                ownerAddress: owner,
                blockNumber: Number(unparsedEvent.blockNumber),
                profileUrl: profileUrl,
                destinationAddress: helper.checkSum(destinationAddress),
              },
            )
            logger.debug(`New NFT Resolver ${evt.name} event found. ${ profileUrl } (owner = ${owner}) is cancelling ${ destinationAddress }. chainId=${chainId}`)
          }
        } else if (evt.name == EventName.ClearAllAssociatedAddresses) {
          const [owner,profileUrl] = evt.args
          const event = await repositories.event.findOne({
            where: {
              chainId,
              contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
              eventName: evt.name,
              txHash: unparsedEvent.transactionHash,
              ownerAddress: owner,
              blockNumber: Number(unparsedEvent.blockNumber),
              profileUrl: profileUrl,
            },
          })
          if (!event) {
            await repositories.event.save(
              {
                chainId,
                contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
                eventName: evt.name,
                txHash: unparsedEvent.transactionHash,
                ownerAddress: owner,
                blockNumber: Number(unparsedEvent.blockNumber),
                profileUrl: profileUrl,
              },
            )
            logger.debug(`New NFT Resolver ${evt.name} event found. ${ profileUrl } (owner = ${owner}) cancelled all associations. chainId=${chainId}`)
          }
        } else if (evt.name === EventName.AssociateSelfWithUser ||
          evt.name === EventName.RemovedAssociateProfile) {
          const [receiver, profileUrl, profileOwner] = evt.args
          const event = await repositories.event.findOne({
            where: {
              chainId,
              contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
              eventName: evt.name,
              txHash: unparsedEvent.transactionHash,
              ownerAddress: profileOwner,
              blockNumber: Number(unparsedEvent.blockNumber),
              profileUrl: profileUrl,
              destinationAddress: helper.checkSum(receiver),
            },
          })
          if (!event) {
            await repositories.event.save(
              {
                chainId,
                contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
                eventName: evt.name,
                txHash: unparsedEvent.transactionHash,
                ownerAddress: profileOwner,
                blockNumber: Number(unparsedEvent.blockNumber),
                profileUrl: profileUrl,
                destinationAddress: helper.checkSum(receiver),
              },
            )
            logger.debug(`New NFT Resolver ${evt.name} event found. profileUrl = ${profileUrl} (receiver = ${receiver}) profileOwner = ${[profileOwner]}. chainId=${chainId}`)
          }
        } else if (evt.name === EventName.SetAssociatedContract) {
          const [owner, profileUrl, associatedContract] = evt.args
          const event = await repositories.event.findOne({
            where: {
              chainId,
              contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
              eventName: evt.name,
              txHash: unparsedEvent.transactionHash,
              ownerAddress: owner,
              blockNumber: Number(unparsedEvent.blockNumber),
              profileUrl: profileUrl,
              destinationAddress: helper.checkSum(associatedContract),
            },
          })
          if (!event) {
            await repositories.event.save(
              {
                chainId,
                contract: helper.checkSum(contracts.nftResolverAddress(chainId)),
                eventName: evt.name,
                txHash: unparsedEvent.transactionHash,
                ownerAddress: owner,
                blockNumber: Number(unparsedEvent.blockNumber),
                profileUrl: profileUrl,
                destinationAddress: helper.checkSum(associatedContract),
              },
            )
            logger.debug(`New NFT Resolver ${evt.name} event found. profileUrl = ${profileUrl} (owner = ${owner}) associatedContract = ${associatedContract}. chainId=${chainId}`)
          }
          const profile = await repositories.profile.findOne({
            where: {
              url: profileUrl,
              chainId,
            },
          })
          if (profile) {
            await repositories.profile.updateOneById(profile.id, { associatedContract })
          }
        }
      } catch (err) {
        if (err.code != 'BUFFER_OVERRUN' && err.code != 'INVALID_ARGUMENT') { // error parsing old event on goerli, and chainId mismatch
          logger.error(err, 'error parsing resolver')
        }
      }
    })

    log.logs.map(async (unparsedEvent) => {
      try {
        const evt = profileAuctionParseLog(unparsedEvent)
        logger.info(evt.args, `Found event MintedProfile with chainId: ${chainId}`)
        const [owner,profileUrl,tokenId,,] = evt.args

        if (evt.name === 'MintedProfile') {
          const tx = await chainProvider.getTransaction(unparsedEvent.transactionHash)
          const claimFace = new ethers.utils.Interface(['function genesisKeyClaimProfile(string,uint256,address,bytes32,bytes)'])
          const batchClaimFace = new ethers.utils.Interface(['function genesisKeyBatchClaimProfile((string,uint256,address,bytes32,bytes)[])'])
          let gkTokenId
          try {
            const res = claimFace.decodeFunctionData('genesisKeyClaimProfile', tx.data)
            gkTokenId = res[1]
          } catch (err) {
            const res = batchClaimFace.decodeFunctionData('genesisKeyBatchClaimProfile', tx.data)
            if (Array.isArray(res[0])) {
              for (const r of res[0]) {
                if (r[0] === profileUrl) {
                  gkTokenId = r[1]
                  break
                }
              }
            }
          }
          const existsBool = await repositories.event.exists({
            chainId,
            contract: helper.checkSum(contracts.profileAuctionAddress(chainId)),
            eventName: evt.name,
            txHash: unparsedEvent.transactionHash,
            ownerAddress: owner,
            profileUrl: profileUrl,
          })
          if (!existsBool) {
            await repositories.event.save(
              {
                chainId,
                contract: helper.checkSum(contracts.profileAuctionAddress(chainId)),
                eventName: evt.name,
                txHash: unparsedEvent.transactionHash,
                ownerAddress: owner,
                profileUrl: profileUrl,
                tokenId: gkTokenId ? BigNumber.from(gkTokenId).toHexString() : null,
              },
            )
            // find and mark profile status as minted
            const profile = await repositories.profile.findOne({
              where: {
                tokenId: tokenId.toString(),
                url: profileUrl,
                chainId,
              },
            })
            if (!profile) {
              await core.createProfileFromEvent(
                chainId,
                owner,
                tokenId,
                repositories,
                profileUrl,
              )
              await core.sendSlackMessage('sub-nftdotcom-analytics', `😀 New profile created: ${profileUrl} by ${owner} (https://www.etherscan.io/tx/${unparsedEvent.transactionHash})`)

              logger.debug(`Profile ${ profileUrl } was minted by address ${ owner }`)
              await HederaConsensusService.submitMessage(
                `Profile ${ profileUrl } was minted by address ${ owner }`,
              )
            } else {
              if (profile.status !== defs.ProfileStatus.Owned) {
                await repositories.profile.updateOneById(profile.id, {
                  status: defs.ProfileStatus.Owned,
                })
              }
            }
          }
        }
        await cache.set(chainIdToCacheKeyProfile(chainId), log.latestBlockNumber)
        logger.debug({ counts: log.logs.length }, 'saved all minted profiles and their events')
      } catch (err) {
        logger.error(err, 'error parsing minted profiles: ')
      }
    })
  } catch (err) {
    Sentry.captureMessage(`Error in getEthereumEvents Job: ${err}`)
  }
}
