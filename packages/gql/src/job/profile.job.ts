import { Job } from 'bull'
import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'
import { _logger, contracts, db, entity, provider } from '@nftcom/shared'
import { typechain } from '@nftcom/shared/helper'

const redis = new Redis({
  port: redisConfig.port,
  host: redisConfig.host,
})

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

export const syncProfileNFTs = async (job: Job): Promise<any> => {
  try {
    const profiles = await repositories.profile.findAll()

    const nftProfileContract = typechain.NftProfile__factory.connect(
      contracts.nftProfileAddress(job.data.chainId.split(':')?.[1]),
      provider.provider(Number(job.data.chainId.split(':')?.[1])),
    )

    profiles.forEach(async (profile: entity.Profile) => {
      try {
        let tokenId: any = await redis.get(profile.url)
        const cachedProfile = tokenId !== null
    
        if (cachedProfile) {
          try {
            tokenId = await nftProfileContract.getTokenId(profile.url)
            await redis.set(profile.url, Number(tokenId), 'ex', 60)
          } catch (_) {
            // catch if profile doesn't exist
            tokenId = -1
            await redis.set(profile.url, -1, 'ex', 60)
          }
        }
    
        const address: string = tokenId !== null && Number(tokenId) >= 0 ? await nftProfileContract.ownerOf(tokenId) : '0x'
    
        const foundWallet: entity.Wallet = await repositories.wallet.findByChainAddress(job.data.chainId.split(':')?.[1], address)
                
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
      } catch (err) {
        logger.error('error while syncing profiles')
      }
    })
  } catch (err) {
    console.log('error: ', err)
  }
}
