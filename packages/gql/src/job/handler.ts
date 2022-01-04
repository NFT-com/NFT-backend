import { Job } from 'bull'
import { Contract, ethers, Wallet } from 'ethers'

import { contracts, db, defs, fp, provider } from '@nftcom/shared'

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

export const getMintedProfiles = (job: Job): Promise<any> => {
  try {
    const { chainId } = job.data
    const contract = getContract(chainId)

    const filter = { address: contract.address }
    return contract.queryFilter(filter)
      .then(events => {
        return events.map((evt) => {
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
        })
      })
  } catch (err) {
    console.log('error: ', err)
  }
}