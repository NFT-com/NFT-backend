import { Job } from 'bull'
import cryptoRandomString from 'crypto-random-string'
import { getAddressesBalances } from 'eth-balance-checker/lib/ethers'
import { Contract, ethers, Wallet } from 'ethers'

import { auth } from '@nftcom/gql/helper'
import { _logger, contracts, db, defs, entity, fp, provider } from '@nftcom/shared'

import HederaConsensusService from '../service/hedera.service'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

// TODO: migrate to Typechain
const getContract = (chainId: number): Contract => {
  const signer = Wallet.fromMnemonic(contracts.getProfileAuctionMnemonic(chainId))
    .connect(provider.provider(Number(chainId)))

  return new ethers.Contract(
    contracts.profileAuctionAddress(chainId),
    contracts.profileAuctionABI(),
    signer,
  )
}

const onlyUnique = (value, index, self: any[]): boolean => {
  return self.indexOf(value) === index
}

// includes bids for profiles and genesis keys
const filterLiveBids = (bids: entity.Bid[]): Promise<entity.Bid[]> => {
  return Promise.all([
    bids,
    repositories.profile.find({ where: { status: defs.ProfileStatus.Available } })
      .then(profiles => profiles.map((profile: entity.Profile) => profile.id)
        .reduce(function(map, item) {
          map[item] = true
          return map
        }, {})), // returns mapping for constant lookup
  ]).then(([bids, availableProfilesIds]: [entity.Bid[], string[]]) => {
    return bids.filter(  // second promise filters all remaining valid bids
      (bid: entity.Bid) =>
        (bid.nftType == defs.NFTType.Profile && availableProfilesIds[bid.profileId]) ||
        bid.nftType == defs.NFTType.GenesisKey,
    ) // filter only non-executed bids for available handles and genesis keys
  })
}

// size of each array for balances for NFT and WETH
// 450 is chosen as 450 x 2 (balance query for NFT and WETH) = 900
// 900 balanceOf queries maxes sits comfortably below the 1000 maximum size limit on Ethereum
// the size limit is mostly due to gas limits per ethereum call.
// 
// Even though balanceOf is a view function, it has to conform to size limits on calls via the
// ethereum nodes
const perChunk = 450

const getAddressBalanceMapping = (bids: entity.Bid[], walletIdAddressMapping: any, chainId: number):
[entity.Bid[], entity.Bid[], any, any] => {
  const splitAddressArrays: any = Object.values(walletIdAddressMapping)
    .reduce((resultArray, item, index) => {
      const chunkIndex = Math.floor(index/perChunk)
  
      if (!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = [] // start a new chunk
      }
  
      resultArray[chunkIndex].push(item)
  
      return resultArray
    }, [])

  const profileBids = bids.filter((bid: entity.Bid) => bid.nftType == defs.NFTType.Profile)
  const genesisKeyBids = bids.filter((bid: entity.Bid) => bid.nftType == defs.NFTType.GenesisKey)
  const addressBalanceMapping = splitAddressArrays.map(
    splitArray => getAddressesBalances( // returns balances in object, need Object.assign to combine into one single object
      provider.provider(Number(chainId)),
      splitArray,
      ['0x0000000000000000000000000000000000000000', contracts.nftTokenAddress(chainId)],
      contracts.multiBalance(chainId),
    ),
  )

  return [profileBids, genesisKeyBids, walletIdAddressMapping, addressBalanceMapping]
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
          profileBids,
          genesisKeyBids,
          walletIdAddressMapping,
          addressBalanceMapping,
        ]: [entity.Bid[], entity.Bid[], any, any]) => {
          return Promise.all([
            profileBids.map((bid: entity.Bid) => {
              const balanceObj =  addressBalanceMapping[0][walletIdAddressMapping[bid.walletId]]
              const nftBalance = Number(balanceObj[contracts.nftTokenAddress(chainId)]) ?? 0
                
              if (nftBalance < Number(bid.price)) {
                logger.debug('softDeleteProfileBid', { type: bid.nftType, bidAmount: Number(bid.price), nftBalance })
                repositories.bid.deleteById(bid.id)
              }
            }),
            genesisKeyBids.map(async (bid: entity.Bid) => {
              try {
                const balanceObj = (await addressBalanceMapping[0])[
                  walletIdAddressMapping[bid.walletId]]
                const ethBalance = Number(balanceObj['0x0000000000000000000000000000000000000000']) ?? 0
                  
                if (ethBalance < Number(bid.price)) {
                  logger.debug('softDeleteGenesisBid', { type: bid.nftType, bidAmount: Number(bid.price), ethBalance })
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

export const getEthereumEvents = (job: Job): Promise<any> => {
  try {
    const { chainId } = job.data
    const contract = getContract(chainId)

    logger.debug('getting Ethereum Events')

    // go through all bids and determine which ones are valid
    // valid bids:
    //  * have enough NFT tokens under address if for profile
    //  * have enough ETH tokens under address for genesis key
    //  * are bids for an available profile (search profiles for urls for status)

    const filter = { address: contract.address }

    return repositories.bid.find({
      where: [{
        nftType: defs.NFTType.GenesisKey,
        status: defs.BidStatus.Submitted,
      },
      {
        nftType: defs.NFTType.Profile,
        status: defs.BidStatus.Submitted,
      }],
    }).then((bids: entity.Bid[]) => Promise.all([
      filterLiveBids(bids),
      contract.queryFilter(filter),
    ])).then(([filteredBids, events]: [entity.Bid[], any[]]) => {
      logger.debug('filterLiveBids', { filteredBids: filteredBids.map(i => i.id) })

      return Promise.all([
        validateLiveBalances(filteredBids, chainId),
        events.map((evt) => {
          console.log(`Found event ${evt.event} with chainId: ${chainId}, ${evt.args}`)
          const [owner,profileUrl] = evt.args

          switch (evt.event) {
          case 'MintedProfile':
            return repositories.event.exists({
              chainId,
              ownerAddress: owner,
              profileUrl: profileUrl,
              txHash: evt.transactionHash,
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
                            .then((user: entity.User) => repositories.wallet.save({
                              address: ethers.utils.getAddress(owner),
                              network: 'ethereum',
                              chainId: chainId,
                              chainName: chain.name,
                              userId: user.id,
                            }))
                        }))
                        .then((wallet: entity.Wallet) => {
                          repositories.profile.save({
                            status: defs.ProfileStatus.Owned,
                            url: profileUrl,
                            ownerWalletId: wallet.id,
                            ownerUserId: wallet.userId,
                          })
                        })
                    }))
                    .then(fp.thruIfNotEmpty((profile) => {
                      profile.status = defs.ProfileStatus.Owned
                      repositories.profile.save(profile)
                    })),
                  repositories.event.save(
                    {
                      chainId,
                      contract: contract.address,
                      eventName: evt.event,
                      txHash: evt.transactionHash,
                      ownerAddress: owner,
                      profileUrl: profileUrl,
                    },
                  ),
                  HederaConsensusService.submitMessage(
                    `Profile ${ profileUrl } was minted by address ${ owner }`,
                  ),
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
