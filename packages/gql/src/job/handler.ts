import { Job } from 'bull'
import { getAddressesBalances } from 'eth-balance-checker/lib/ethers'
import { Contract, ethers, Wallet } from 'ethers'

import { _logger, contracts, db, defs, entity, fp, provider } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

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
      .then(profiles => profiles.map((profile: entity.Profile) => profile.id)),
  ]).then(([bids, availableProfilesIds]: [entity.Bid[], string[]]) => {
    return bids.filter(  // second promise filters all remaining valid bids
      (bid: entity.Bid) =>
        (bid.nftType == defs.NFTType.Profile &&
        availableProfilesIds.indexOf(bid.profileId) >= 0 &&
        bid.status != defs.BidStatus.Executed) ||
        (bid.nftType == defs.NFTType.GenesisKey &&
        bid.status != defs.BidStatus.Executed),
    ) // filter only non-executed bids for available handles and genesis keys
  })
}

// size of each array for balances for NFT and WETH
const perChunk = 450

// validates live balances for all the filtered bids
const validateLiveBalances = (bids: entity.Bid[], chainId: number): Promise<boolean> => {
  try {
    return Promise.all([
      bids.filter((bid: entity.Bid) => bid.nftType == defs.NFTType.Profile),
      bids.filter((bid: entity.Bid) => bid.nftType == defs.NFTType.GenesisKey),
      bids
        .map(bid => bid.walletId)
        .filter(onlyUnique).map((bidId: string) => { return { id: bidId }}),
    ]).then(
      ([profileBids, genesisKeyBids, uniqueWalletIds]: [entity.Bid[], entity.Bid[], any[]]) => {
        return Promise.all([
          profileBids,
          genesisKeyBids,
          repositories.wallet.find({ where: uniqueWalletIds }).then((wallets: entity.Wallet[]) =>  {
            // create mapping of walletId => address
            return wallets.reduce((map, walletEntity) =>
              (map[walletEntity.id] = walletEntity.address, map), {})
          }),
        ])
      }).then(
      ([
        profileBids,
        genesisKeyBids,
        walletIdAddressMapping,
      ]: [entity.Bid[], entity.Bid[], any]) => {
        return Promise.all([
          Promise.resolve(profileBids),
          Promise.resolve(genesisKeyBids),
          Promise.resolve(walletIdAddressMapping),
          Object.values(walletIdAddressMapping).reduce((resultArray, item, index) => {
            const chunkIndex = Math.floor(index/perChunk)
          
            if (!resultArray[chunkIndex]) {
              resultArray[chunkIndex] = [] // start a new chunk
            }
          
            resultArray[chunkIndex].push(item)
          
            return resultArray
          }, []),
        ]).then(
          ([
            profileBids,
            genesisKeyBids,
            walletIdAddressMapping,
            splitAddressArrays,
          ]: [entity.Bid[], entity.Bid[], any, any]) => {
            return Promise.all([
              Promise.resolve(profileBids),
              Promise.resolve(genesisKeyBids),
              Promise.resolve(walletIdAddressMapping),
              Promise.all(splitAddressArrays.map(
                splitArray => getAddressesBalances( // returns balances in object, need Object.assign to combine into one single object
                  provider.provider(Number(chainId)),
                  splitArray,
                  [contracts.nftTokenAddress(chainId), contracts.wethAddress(chainId)],
                  contracts.multiBalance(chainId),
                ),
              )),
            ])
          },
        ).then(
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
              genesisKeyBids.map((bid: entity.Bid) => {
                const balanceObj =  addressBalanceMapping[0][walletIdAddressMapping[bid.walletId]]
                const wethBalance = Number(balanceObj[contracts.wethAddress(chainId)]) ?? 0
                
                if (wethBalance < Number(bid.price)) {
                  logger.debug('softDeleteGenesisBid', { type: bid.nftType, bidAmount: Number(bid.price), wethBalance })
                  repositories.bid.deleteById(bid.id)
                }
              }),
            ])
          },
        )
      }).then(() => true)
  } catch (err) {
    console.log('error while validateLiveBalances: ', err)
  }
}

export const getEthereumEvents = (job: Job): Promise<any> => {
  try {
    const { chainId } = job.data
    const contract = getContract(chainId)

    // go through all bids and determine which ones are valid
    // valid bids:
    //  * have enough NFT tokens under address if for profile
    //  * have enough WETH tokens under address for genesis key
    //  * are bids for an available profile (search profiles for urls for status)

    const filter = { address: contract.address }
    
    return repositories.bid.find({ where: {} }).then((bids: entity.Bid[]) => Promise.all([
      filterLiveBids(bids),
      contract.queryFilter(filter),
    ])).then(([filteredBids, events]: [entity.Bid[], any[]]) => {
      logger.debug('filterLiveBids', { filteredBids })

      return Promise.all([
        validateLiveBalances(filteredBids, chainId),
        events.map((evt) => {
        // console.log(`Found event ${evt.event} with chainId: ${chainId}`)
          const [owner,, profileUrl,,] = evt.args

          switch (evt.event) {
          case 'NewClaimableProfile':
            return repositories.event.exists({
              chainId,
              txHash: evt.transactionHash,
            }).then(existsBool => {
              if (!existsBool) {
                console.log('no event profile: ', profileUrl)
                // find and mark profile status as minted
                return repositories.profile.findByURL(profileUrl)
                  .then(fp.thruIfNotEmpty((profile) => {
                    profile.status = defs.ProfileStatus.Owned
                    repositories.profile.save(profile)
      
                    return repositories.event.save(
                      {
                        chainId,
                        contract: contract.address,
                        eventName: evt.event,
                        txHash: evt.transactionHash,
                        ownerAddress: owner,
                        profileUrl: profileUrl,
                      },
                    )
                  },
                  ))
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