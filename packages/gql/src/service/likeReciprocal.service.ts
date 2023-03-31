import { BigNumber } from 'ethers'
import { EventEmitter } from 'stream'

import { _logger, contracts, db } from '@nftcom/shared'

import { CommonLikeArgs } from './like.service'

const PROFILE_ADDRESS = contracts.nftProfileAddress(process.env.CHAIN_ID)
const logger = _logger.Factory('likeReciprocal.service', _logger.Context.GraphQL)

interface LikeReciprocalService {
  reciprocalLike: EventEmitter
}
export function getLikeReciprocalService(repos: db.Repository = db.newRepositories()): LikeReciprocalService {
  const reciprocalLike = new EventEmitter()

  reciprocalLike.on('profile', async (setLikeArgs: CommonLikeArgs) => {
    try {
      const { likedId } = setLikeArgs
      // get nft Id and save like
      const profile = await repos.profile.findById(likedId)
      const nft = await repos.nft.findOne({
        where: {
          contract: PROFILE_ADDRESS,
          tokenId: BigNumber.from(profile.tokenId).toHexString(),
        },
      })
      await repos.like.save({ ...setLikeArgs, likedId: nft.id })
    } catch (err) {
      logger.error(err, `Unable to set like reciprocally for profile: ${setLikeArgs.likedId}`)
    }
  })

  reciprocalLike.on('nft', async (setLikeArgs: CommonLikeArgs) => {
    try {
      const { likedId } = setLikeArgs
      // get nft Id and save like
      const nft = await repos.nft.findById(likedId)
      if (nft.contract === PROFILE_ADDRESS) {
        const profile = await repos.profile.findOne({
          where: {
            url: nft.metadata.name,
          },
        })
        await repos.like.save({ ...setLikeArgs, likedId: profile.id })
      }
    } catch (err) {
      logger.error(err, `Unable to set like reciprocally for nft: ${setLikeArgs.likedId}`)
    }
  })

  return {
    reciprocalLike,
  }
}
export const reciprocalLike = getLikeReciprocalService().reciprocalLike
