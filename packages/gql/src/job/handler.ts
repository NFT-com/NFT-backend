import { Job } from 'bull'
import cryptoRandomString from 'crypto-random-string'
import { getAddressesBalances } from 'eth-balance-checker/lib/ethers'
import { ethers, utils } from 'ethers'
import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'
import { auth, provider } from '@nftcom/gql/helper'
import { getPastLogs } from '@nftcom/gql/job/marketplace.job'
import { _logger, contracts, db, defs, entity, helper } from '@nftcom/shared'

import { core } from '../service'
import HederaConsensusService from '../service/hedera.service'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

const redis = new Redis({
  port: redisConfig.port,
  host: redisConfig.host,
})

const onlyUnique = (value, index, self: any[]): boolean => {
  return self.indexOf(value) === index
}

// size of each array for balances for ETH
// 900 balanceOf queries maxes sits comfortably below the 1000 maximum size limit on Ethereum
// the size limit is mostly due to gas limits per ethereum call.
//
// Even though balanceOf is a view function, it has to conform to size limits on calls via the
// ethereum nodes
const perChunk = 900

const getAddressBalanceMapping =
  async (bids: entity.Bid[], walletIdAddressMapping: any, chainId: number):
  Promise<[entity.Bid[], any, any]> => {
    const splitAddressArrays: any = Object.values(walletIdAddressMapping)
      .reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index/perChunk)

        if (!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = [] // start a new chunk
        }

        resultArray[chunkIndex].push(item)

        return resultArray
      }, [])

    const genesisKeyBids = bids.filter((bid: entity.Bid) => bid.nftType == defs.NFTType.GenesisKey)
    const addressBalanceMapping = splitAddressArrays.map(
      splitArray => getAddressesBalances( // returns balances in object, need Object.assign to combine into one single object
        provider.provider(Number(chainId)),
        splitArray,
        ['0x0000000000000000000000000000000000000000'],
        contracts.multiBalance(chainId),
      ),
    )

    return [genesisKeyBids, walletIdAddressMapping, addressBalanceMapping]
  }

// validates live balances for all the filtered bids
const validateLiveBalances = (bids: entity.Bid[], chainId: number): Promise<boolean> => {
  try {
    return Promise.all([
      bids,
      bids
        .map(bid => bid.walletId)
        .filter(onlyUnique).map((walletId: string) => { return { id: walletId }}),
    ]).then(
      ([bids, uniqueWalletIds]:
      [entity.Bid[], Array<{ id: string }>]) => {
        return Promise.all([
          bids,
          repositories.wallet.find({ where: uniqueWalletIds }).then((wallets: entity.Wallet[]) =>  {
            // create mapping of walletId => address
            return wallets.reduce((map, walletEntity) =>
              (map[walletEntity.id] = walletEntity.address, map), {})
          }),
        ])
      }).then(
      ([
        bids,
        walletIdAddressMapping,
      ]: [entity.Bid[], any]) => getAddressBalanceMapping(bids, walletIdAddressMapping, chainId))
      .then(
        ([
          genesisKeyBids,
          walletIdAddressMapping,
          addressBalanceMapping,
        ]: [entity.Bid[], any, any]) => {
          return Promise.all([
            genesisKeyBids.map(async (bid: entity.Bid) => {
              try {
                const mergedBalance = [].concat(...await addressBalanceMapping)
                const balanceObj = (await mergedBalance[0])[
                  walletIdAddressMapping[bid.walletId]]
                const ethBalance = Number(balanceObj['0x0000000000000000000000000000000000000000']) ?? 0

                if (ethBalance < Number(bid.price) && new Date().getTime() < 1651186800000) {
                  logger.info('softDeleteGenesisBid', { type: bid.nftType, bidAmount: Number(bid.price), ethBalance, wallet: walletIdAddressMapping[bid.walletId], mergedBalance })
                  repositories.bid.deleteById(bid.id)
                }
              } catch (err) {
                logger.debug('gk balance: ', err)
              }
            }),
          ])
        },
      ).then(() => true)
  } catch (err) {
    console.log('error while validateLiveBalances: ', err)
  }
}

const profileAuctioninterface = new utils.Interface(contracts.profileAuctionABI())

const getCachedBlock = async (chainId: number, key: string): Promise<number> => {
  const startBlock = chainId == 4 ? 10540040 : 14675454
  try {
    const cachedBlock = await redis.get(key)

    // get 1000 blocks before incase of some blocks not being handled correctly
    if (cachedBlock) return Number(cachedBlock) > 1000
      ? Number(cachedBlock) - 1000 : Number(cachedBlock)
    else return startBlock
  } catch (e) {
    return startBlock
  }
}

const getMintedProfileEvents = async (
  topics: any[],
  chainId: number,
  provider: ethers.providers.BaseProvider,
  address: string,
): Promise<ethers.providers.Log[]> => {
  try {
    const maxBlocks = process.env.MINTED_PROFILE_EVENTS_MAX_BLOCKS
    const latestBlock = await provider.getBlock('latest')
    const key = `minted_profile_cached_block_${chainId}`
    const cachedBlock = await getCachedBlock(chainId, key)
    const logs = await getPastLogs(
      provider,
      address,
      topics,
      cachedBlock,
      latestBlock.number,
      Number(maxBlocks),
    )
    await redis.set(key, latestBlock.number)
    return logs
  } catch (e) {
    logger.debug(e)
    return []
  }
}

export const getEthereumEvents = async (job: Job): Promise<any> => {
  try {
    const { chainId } = job.data

    const topics = [
      helper.id('MintedProfile(address,string,uint256,uint256,uint256)'),
    ]

    const chainProvider = provider.provider(Number(chainId))
    const address = helper.checkSum(contracts.profileAuctionAddress(chainId))

    logger.debug('getting Ethereum Events')

    const bids = await repositories.bid.find({
      where: [{
        nftType: defs.NFTType.GenesisKey,
        status: defs.BidStatus.Submitted,
      }],
    })
    const filteredBids = bids.filter((bid: entity.Bid) => bid.nftType == defs.NFTType.GenesisKey)
    const events = await getMintedProfileEvents(topics, Number(chainId), chainProvider, address)

    logger.debug('filterLiveBids', { filteredBids: filteredBids.map(i => i.id) })

    const validation = await validateLiveBalances(filteredBids, chainId)
    if (validation) {
      await Promise.allSettled(
        events.map(async (unparsedEvent) => {
          const evt = profileAuctioninterface.parseLog(unparsedEvent)
          console.log(`Found event MintedProfile with chainId: ${chainId}, ${evt.args}`)
          const [owner,profileUrl,tokenId,,] = evt.args

          if (evt.name === 'MintedProfile') {
            const existsBool = await repositories.event.exists({
              chainId,
              ownerAddress: owner,
              profileUrl: profileUrl,
              txHash: unparsedEvent.transactionHash,
            })
            if (!existsBool) {
              // find and mark profile status as minted
              const profile = await repositories.profile.findByURL(profileUrl)
              if (!profile) {
                let wallet = await repositories.wallet.findByChainAddress(chainId, owner)
                if (!wallet) {
                  const chain = auth.verifyAndGetNetworkChain('ethereum', chainId)
                  let user = await repositories.user.findOne({
                    where: {
                      // defaults
                      username: 'ethereum-' + ethers.utils.getAddress(owner),
                      referralId: cryptoRandomString({ length: 10, type: 'url-safe' }),
                    },
                  })
                  if (!user) {
                    user = await repositories.user.save({
                      // defaults
                      username: 'ethereum-' + ethers.utils.getAddress(owner),
                      referralId: cryptoRandomString({ length: 10, type: 'url-safe' }),
                    })
                  }
                  wallet = await repositories.wallet.save({
                    address: ethers.utils.getAddress(owner),
                    network: 'ethereum',
                    chainId: chainId,
                    chainName: chain.name,
                    userId: user.id,
                  })
                }
                const ctx = {
                  chain: {
                    id: wallet.chainId,
                    name: wallet.chainName,
                  },
                  network: 'Ethereum',
                  repositories: repositories,
                  user: null,
                  wallet,
                }
                await core.createProfile(ctx, {
                  status: defs.ProfileStatus.Owned,
                  url: profileUrl,
                  tokenId: tokenId.toString(),
                  ownerWalletId: wallet.id,
                  ownerUserId: wallet.userId,
                })
                const event = await repositories.event.findOne({
                  where: {
                    chainId,
                    contract: helper.checkSum(contracts.profileAuctionAddress(chainId)),
                    eventName: evt.name,
                    txHash: unparsedEvent.transactionHash,
                    ownerAddress: owner,
                    profileUrl: profileUrl,
                  },
                })
                if (!event) {
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
                  await HederaConsensusService.submitMessage(
                    `Profile ${ profileUrl } was minted by address ${ owner }`,
                  )
                }
              } else {
                if (profile.status !== defs.ProfileStatus.Owned) {
                  await repositories.profile.updateOneById(profile.id, {
                    status: defs.ProfileStatus.Owned,
                  })
                }
              }
            }
          }
        }),
      )
    }
  } catch (err) {
    console.log('error: ', err)
  }
}
