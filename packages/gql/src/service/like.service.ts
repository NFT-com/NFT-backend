import { In } from 'typeorm'

import { appError } from '@nftcom/error-types'
import { db, entity } from '@nftcom/shared'

import { profileService } from './profile.service'

type CommonLikeArgs = { likedById: string; likedId: string; likedType: entity.LikeableType }
interface LikeService {
  getLikeCount(likedId: string): Promise<number>
  isLikedByUser(likedId: string, userId: string): Promise<boolean>
  setLike({ likedById, likedId, likedType }: CommonLikeArgs, likedByUserId: string): Promise<entity.Like>
  unsetLike({ likedById, likedId, likedType }: CommonLikeArgs, likedByUserId: string): Promise<boolean>
}
export function getLikeService(repos: db.Repository = db.newRepositories()): LikeService {
  async function getLikeCount(likedId: string): Promise<number> {
    if (!likedId) {
      throw appError.buildInvalid('Cannot get count without likedId', 'LIKE_COUNT_INVALID')
    }
    return repos.like.count({ likedId })
  }

  async function isLikedByUser(likedId, userId): Promise<boolean> {
    const profiles = await repos.profile.find({ where: { ownerUserId: userId } })
    const like = await repos.like.findOne({ where: { likedId, likedById: In(profiles.map(p => p.id)) } })
    return !!like
  }

  async function setLike(
    { likedById, likedId, likedType }: CommonLikeArgs,
    likedByUserId: string,
  ): Promise<entity.Like> {
    const setLikeArgs = { likedById, likedId, likedType }
    if (!likedById || !likedId || !likedType) {
      throw new Error(`Missing property or property undefined in ${JSON.stringify(setLikeArgs)}`)
    }
    if (!Object.values(entity.LikeableType).includes(likedType)) {
      throw appError.buildInvalid(`${likedType} cannot be liked`, 'LIKE_INVALID')
    }
    if (!(await profileService.isProfileOwnedByUser({ profileId: likedById, userId: likedByUserId }))) {
      throw appError.buildForbidden('User cannot set like', 'LIKE_FORBIDDEN')
    }
    if ((await repos.like.find({ where: setLikeArgs })).length) {
      throw appError.buildExists(`${likedType} already liked`, 'LIKE_ALREADY_EXISTS')
    }
    return repos.like.save(setLikeArgs)
  }

  async function unsetLike({ likedById, likedId, likedType }: CommonLikeArgs, likedByUserId: string): Promise<boolean> {
    if (!likedByUserId) {
      throw appError.buildInvalid('unsetLike requires likedByUserId', 'UNSET_LIKE_INVALID')
    }
    const like = await repos.like.findOne({ where: { likedById, likedId, likedType } })
    if (!like) {
      throw appError.buildNotFound('Like not found', 'UNSET_LIKE_NOT_FOUND')
    } else if (!(await profileService.isProfileOwnedByUser({ profileId: like.likedById, userId: likedByUserId }))) {
      throw appError.buildForbidden('User cannot unset like', 'UNSET_LIKE_FORBIDDEN')
    }
    return repos.like.hardDeleteByIds([like.id])
  }

  return {
    getLikeCount,
    isLikedByUser,
    setLike,
    unsetLike,
  }
}
export const likeService = getLikeService()
