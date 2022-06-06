import { Job } from 'bull'
import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'
import {
  DEFAULT_NFT_IMAGE,
  generateCompositeImage,
} from '@nftcom/gql/service/core.service'
import { _logger, contracts, db, entity, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

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
        if (foundWallet && foundWallet.id !== profile.ownerWalletId) {
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
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in syncProfileNFTs Job: ${err}`)
  }
}

export const generateCompositeImages = async (job: Job): Promise<any> => {
  try {
    logger.debug('generate Composite Images', job.data)

    const MAX_PROFILE_COUNTS = 200
    const profiles = await repositories.profile.find({
      where: {
        photoURL: null,
      },
    })
    const slicedProfiles = profiles.slice(0, MAX_PROFILE_COUNTS)
    await Promise.allSettled(
      slicedProfiles.map(async (profile) => {
        const imageURL = await generateCompositeImage(profile.url, DEFAULT_NFT_IMAGE)
        await repositories.profile.updateOneById(profile.id, {
          photoURL: imageURL,
        })
        logger.debug(`Composite Image for Profile ${ profile.url } was generated`)
      }),
    )
    logger.debug('generated composite images for profiles', { counts: MAX_PROFILE_COUNTS })
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in generateCompositeImages Job: ${err}`)
  }
}
