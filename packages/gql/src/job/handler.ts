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
      [contracts.nftTokenAddress(chainId), contracts.wethAddress(chainId)],
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
      ).then(() => true)
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