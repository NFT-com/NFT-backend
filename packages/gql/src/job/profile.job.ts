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

    await Promise.all(
      profiles.map((profile: entity.Profile) => {
        return async () => {
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
        }
      }),
    )

    profiles = newTokenId ? await repositories.profile.findAll() : profiles

    await Promise.all(profiles.map((profile: entity.Profile) => {
      return async () => {
        const tokenId = profile.tokenId
        const address: string = tokenId !== null && Number(tokenId) >= 0 ? await nftProfileContract.ownerOf(tokenId) : '0x'
        const foundWallet: entity.Wallet = await repositories.wallet.findByChainAddress(
          job.data.chainId,
          address,
        )
        logger.debug(`address: ${address}, profile: ${profile.url}, tokenId: ${tokenId}`)

        // wallet exists, so update user accordingly
        if (foundWallet && foundWallet.id !== profile.id) {
          logger.debug('saved existing profile user wallet')
          repositories.profile.save({
            ...profile,
            ownerUserId: foundWallet.userId,
            ownerWalletId: foundWallet.id,
          })
        } else if (!foundWallet) {
          logger.debug('non user wallet for profile')
          repositories.profile.save({
            ...profile,
            ownerUserId: null,
            ownerWalletId: null,
          })
        }
      }
    }))
  } catch (err) {
    console.log('error: ', err)
  }
}
