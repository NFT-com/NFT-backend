import { Job } from 'bull'
import { Contract, ethers, Wallet } from 'ethers'

import { contracts, db, provider } from '@nftcom/shared'

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
  const { chainId } = job.data
  const contract = getContract(chainId)

  const filter = { address: contract.address }
  return contract.queryFilter(filter)
    .then(events => {
      return events.map((evt) => {
        console.log(`Found event ${evt.event} with chainId: ${chainId} with args: ${JSON.stringify(evt.args)}`)
        const [owner,, profileUrl,,] = evt.args

        switch (evt.event) {
        case 'NewClaimableProfile':
          if (!repositories.event.exists({
            chainId,
            txHash: evt.transactionHash,
          })) {
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
          }
          return
        default:
          return
        }
      })
    })
}