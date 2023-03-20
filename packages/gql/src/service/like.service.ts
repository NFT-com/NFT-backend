import { appError } from '@nftcom/error-types'
import { db, entity } from '@nftcom/shared'

import { profileService } from './profile.service'

type SetLikeArgs = { likedById: string; likedId: string; likedType: entity.LikeableType }
interface LikeService {
  getLikeCount(likedId: string): Promise<number>
  setLike({ likedById, likedId, likedType }: SetLikeArgs): Promise<entity.Like>
  unsetLike(id: string, likedByUserId: string): Promise<boolean>
}
export function getLikeService(repos: db.Repository = db.newRepositories()): LikeService {
  async function getLikeCount(likedId: string): Promise<number> {
    if (!likedId) {
      throw appError.buildInvalid('Cannot get count without likedId', 'LIKE_COUNT_INVALID')
    }
    return repos.like.count({ likedId })
  }

  async function setLike({ likedById, likedId, likedType }: SetLikeArgs): Promise<entity.Like> {
    const setLikeArgs = { likedById, likedId, likedType }
    if (!likedById || !likedId || !likedType) {
      throw new Error(`Missing property or property undefined in ${setLikeArgs}`)
    }
    if (!Object.values(entity.LikeableType).includes(likedType)) {
      throw appError.buildInvalid(`${likedType} cannot be liked`, 'LIKE_INVALID')
    }
    if (await repos.like.find({ where: setLikeArgs })) {
      throw appError.buildExists(`${likedType} already liked`, 'LIKE_ALREADY_EXISTS')
    }
    return repos.like.save(setLikeArgs)
  }

  async function unsetLike(id: string, likedByUserId: string): Promise<boolean> {
    if (!likedByUserId) {
      throw appError.buildInvalid('unsetLike requires likedByUserId', 'UNSET_LIKE_INVALID')
    }
    const like = await repos.like.findById(id)
    if (!like) {
      throw appError.buildNotFound('Like not found', 'UNSET_LIKE_NOT_FOUND')
    } else if (!(await profileService.isProfileOwnedByUser({ profileId: like.likedById, userId: likedByUserId }))) {
      throw appError.buildForbidden('User cannot unset like', 'UNSET_LIKE_FORBIDDEN')
    }
    return repos.like.hardDeleteByIds([id])
  }

  return {
    getLikeCount,
    setLike,
    unsetLike,
  }
}
export const likeService = getLikeService()