import { Job } from 'bull'
import { IsNull } from 'typeorm'

import { core } from '@nftcom/service'
import { _logger, db } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

// exported for tests
export const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

export const generateCompositeImages = async (job: Job): Promise<any> => {
  try {
    logger.debug('generate Composite Images', job.data)

    const MAX_PROFILE_COUNTS = 200
    const profiles = await repositories.profile.find({
      where: {
        photoURL: IsNull(),
      },
    })
    const slicedProfiles = profiles.slice(0, MAX_PROFILE_COUNTS)
    await Promise.allSettled(
      slicedProfiles.map(async profile => {
        const imageURL = await core.generateCompositeImage(profile.url, core.DEFAULT_NFT_IMAGE)
        await repositories.profile.updateOneById(profile.id, {
          photoURL: imageURL,
        })
        logger.debug(`Composite Image for Profile ${profile.url} was generated`)
      }),
    )
    logger.debug('generated composite images for profiles', { counts: MAX_PROFILE_COUNTS })
  } catch (err) {
    Sentry.captureMessage(`Error in generateCompositeImages Job: ${err}`)
  }
}
