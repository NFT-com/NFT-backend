import { Job } from 'bull'
import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'
import { _logger, contracts, db, entity, provider, typechain } from '@nftcom/shared'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const redis = new Redis({
  port: redisConfig.port,
  host: redisConfig.host,
})

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

export const syncProfileNFTs = async (job: Job): Promise<any> => {
  try {
    logger.debug('syncing profile nfts', job.data)

    const profiles = await repositories.profile.findAll()

    const nftProfileContract = typechain.NftProfile__factory.connect(
      contracts.nftProfileAddress(job.data.chainId),
      provider.provider(Number(job.data.chainId)),
    )

    profiles.forEach(async (profile: entity.Profile) => {
      let tokenId

      try {
        tokenId = await nftProfileContract.getTokenId(profile.url)
        logger.debug(`getTokenId ${profile.url} => ${tokenId}`)
      } catch (getTokenIdErr) {
        // catch if profile doesn't exist yet
        tokenId = -1
      }

      const address: string = tokenId !== null && Number(tokenId) >= 0 ? await nftProfileContract.ownerOf(tokenId) : '0x'
  
      const foundWallet: entity.Wallet = await repositories.wallet.findByChainAddress(
        job.data.chainId,
        address,
      )

      logger.debug(`address: ${address}, profile: ${profile.url}, tokenId: ${tokenId}`)
              
      // wallet exists, so update user accordingly
      if (foundWallet) {
        repositories.profile.save({
          ...profile,
          ownerUserId: foundWallet.userId,
          ownerWalletId: foundWallet.id,
        })
      } else {
        repositories.profile.save({
          ...profile,
          ownerUserId: null,
          ownerWalletId: null,
        })
      }
    })
  } catch (err) {
    console.log('error: ', err)
  }
}
