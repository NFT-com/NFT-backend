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

    let profiles = await repositories.profile.findAll()
    let newTokenId = false

    const nftProfileContract = typechain.NftProfile__factory.connect(
      contracts.nftProfileAddress(job.data.chainId),
      provider.provider(Number(job.data.chainId)),
    )

    // getTokenIds for everyone
    profiles.forEach(async (profile: entity.Profile) => {
      let tokenId

      try {
        tokenId = profile?.tokenId ?? await nftProfileContract.getTokenId(profile.url)
        if (!profile?.tokenId) {
          profile.tokenId = tokenId
          await repositories.profile.save({
            ...profile,
          })
          logger.debug('saved tokenId', tokenId)
          newTokenId = true
        }
        logger.debug(`existing tokenId ${profile.url} => ${tokenId}`)
      } catch (getTokenIdErr) {
        // catch if profile doesn't exist yet
        tokenId = -1
      }
    })

    profiles = newTokenId ? await repositories.profile.findAll() : profiles
    
    for (let i = 0; i < profiles.length; i++) {
      const { tokenId } = profiles[i]
      const address: string = tokenId !== null && Number(tokenId) >= 0 ? await nftProfileContract.ownerOf(tokenId) : '0x'
  
      const foundWallet: entity.Wallet = await repositories.wallet.findByChainAddress(
        job.data.chainId,
        address,
      )

      logger.debug(`address: ${address}, profile: ${profiles[i].url}, tokenId: ${tokenId}`)
              
      // wallet exists, so update user accordingly
      if (foundWallet) {
        logger.debug('saved existing profile user wallet')
        repositories.profile.save({
          ...profiles[i],
          ownerUserId: foundWallet.userId,
          ownerWalletId: foundWallet.id,
        })
      } else {
        logger.debug('non user wallet for profile')
        repositories.profile.save({
          ...profiles[i],
          ownerUserId: null,
          ownerWalletId: null,
        })
      }
    }
  } catch (err) {
    console.log('error: ', err)
  }
}
