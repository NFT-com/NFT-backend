import { Job } from 'bull'
import cryptoRandomString from 'crypto-random-string'
import { getAddressesBalances } from 'eth-balance-checker/lib/ethers'
import { ethers, utils } from 'ethers'

import { auth } from '@nftcom/gql/helper'
import { _logger, contracts, db, defs, entity, fp, helper, provider } from '@nftcom/shared'

import { core } from '../service'
import HederaConsensusService from '../service/hedera.service'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

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

export const getEthereumEvents = (job: Job): Promise<any> => {
  try {
    const { chainId } = job.data

    const topics = [
      helper.id('MintedProfile(address,string,uint256,uint256,uint256)'),
    ]

    const chainProvider = provider.provider(Number(chainId))

    const filter = {
      address: helper.checkSum(contracts.profileAuctionAddress(chainId)),
      topics: topics,
      fromBlock: chainId == 4 ? 10540040 : 14675454, // mainnet
    }

    logger.debug('getting Ethereum Events')

    return repositories.bid.find({
      where: [{
        nftType: defs.NFTType.GenesisKey,
        status: defs.BidStatus.Submitted,
      }],
    }).then((bids: entity.Bid[]) => {
      return Promise.all([
        bids.filter((bid: entity.Bid) => bid.nftType == defs.NFTType.GenesisKey),
        chainProvider.getLogs(filter),
      ])}).then(([filteredBids, events]: [entity.Bid[], any[]]) => {
      logger.debug('filterLiveBids', { filteredBids: filteredBids.map(i => i.id) })

      return Promise.all([
        validateLiveBalances(filteredBids, chainId),
        events.map((unparsedEvent) => {
          const evt = profileAuctioninterface.parseLog(unparsedEvent)
          console.log(`Found event MintedProfile with chainId: ${chainId}, ${evt.args}`)
          const [owner,profileUrl,tokenId,,] = evt.args

          switch (evt.name) {
          case 'MintedProfile':
            return repositories.event.exists({
              chainId,
              ownerAddress: owner,
              profileUrl: profileUrl,
              txHash: unparsedEvent.transactionHash,
            }).then(existsBool => {
              if (!existsBool) {
                // find and mark profile status as minted
                return Promise.all([
                  repositories.profile.findByURL(profileUrl)
                    .then(fp.thruIfEmpty(() => {
                      repositories.wallet.findByChainAddress(chainId, owner)
                        .then(fp.thruIfEmpty(() => {
                          const chain = auth.verifyAndGetNetworkChain('ethereum', chainId)
                          return repositories.user.save({
                            // defaults
                            username: 'ethereum-' + ethers.utils.getAddress(owner),
                            referralId: cryptoRandomString({ length: 10, type: 'url-safe' }),
                          })
                            .then((user: entity.User) =>
                              repositories.wallet.save({
                                address: ethers.utils.getAddress(owner),
                                network: 'ethereum',
                                chainId: chainId,
                                chainName: chain.name,
                                userId: user.id,
                              }))
                        }))
                        .then((wallet: entity.Wallet) => {
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
                          return core.createProfile(ctx, {
                            status: defs.ProfileStatus.Owned,
                            url: profileUrl,
                            tokenId: tokenId.toString(),
                            ownerWalletId: wallet.id,
                            ownerUserId: wallet.userId,
                          }).then(() => repositories.event.save(
                            {
                              chainId,
                              contract: helper.checkSum(contracts.profileAuctionAddress(chainId)),
                              eventName: evt.name,
                              txHash: unparsedEvent.transactionHash,
                              ownerAddress: owner,
                              profileUrl: profileUrl,
                            },
                          )).then(() => HederaConsensusService.submitMessage(
                            `Profile ${ profileUrl } was minted by address ${ owner }`,
                          ))
                        })
                    }))
                    .then(fp.thruIfNotEmpty((profile) => {
                      if (profile.status !== defs.ProfileStatus.Owned) {
                        profile.status = defs.ProfileStatus.Owned
                        repositories.profile.save(profile)
                      }
                    })),
                ])
              }
            })
          default:
            return
          }
        }),
      ])
    })
  } catch (err) {
    console.log('error: ', err)
  }
}
