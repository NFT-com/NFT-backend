import { Job } from 'bull'
import { ethers, utils } from 'ethers'

import { provider } from '@nftcom/gql/helper'
import { getPastLogs } from '@nftcom/gql/job/marketplace.job'
import { cache } from '@nftcom/gql/service/cache.service'
import { _logger, contracts, db, defs, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { core } from '../service'
import HederaConsensusService from '../service/hedera.service'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

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

const getCachedBlock = async (chainId: number, key: string): Promise<number> => {
  const startBlock = chainId == 4 ? 10540040 :
    chainId == 5 ? 7128515 :
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

const chainIdToCacheKeyProfile = (chainId: number): string => {
  return `minted_profile_cached_block_${chainId}`
}

const chainIdToCacheKeyResolverAssociate = (chainId: number): string => {
  return `resolver_associate_cached_block_${chainId}`
}

const getResolverEvents = async (
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

const getMintedProfileEvents = async (
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

    logger.debug(`nft resolver outgoing associate events chainId=${chainId}`, { log2: log2.logs.length })
    log2.logs.map(async (unparsedEvent) => {
      let evt
      try {
        evt = nftResolverInterface.parseLog(unparsedEvent)
        logger.info(`Found event ${evt.name} with chainId: ${chainId}, ${JSON.stringify(evt.args, null, 2)}`)

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
          logger.error('error parsing resolver: ', err)
        }
      }
    })

    log.logs.map(async (unparsedEvent) => {
      try {
        const evt = profileAuctionInterface.parseLog(unparsedEvent)
        logger.info(`Found event MintedProfile with chainId: ${chainId}, ${evt.args}`)
        const [owner,profileUrl,tokenId,,] = evt.args

        if (evt.name === 'MintedProfile') {
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
                true,
              )

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
        logger.debug('saved all minted profiles and their events', { counts: log.logs.length })
      } catch (err) {
        logger.error('error parsing minted profiles: ', err)
      }
    })
  } catch (err) {
    Sentry.captureMessage(`Error in getEthereumEvents Job: ${err}`)
  }
}
