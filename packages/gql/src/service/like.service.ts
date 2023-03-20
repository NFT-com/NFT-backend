import { appError } from '@nftcom/error-types'
import { db, entity } from '@nftcom/shared'

export function getLikeService(repos: db.Repository = db.newRepositories()): { [key: string]: any } {
  async function getLikeCount(likedId: string): Promise<number> {
    if (!likedId) {
      throw appError.buildInvalid('Cannot get count without likedId', 'LIKE_COUNT_INVALID')
    }
    return repos.like.count({ likedId })
  }

  type SetLikeArgs = { likedById: string; likedId: string; likedType: entity.LikeableType }
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

  async function unsetLike(id: string, likedById: string): Promise<boolean> {
    if (!likedById) {
      throw appError.buildInvalid('Wallet has no preferred profile', 'UNSET_LIKE_INVALID')
    }
    const like = await repos.like.findById(id)
    if (!like) {
      throw appError.buildNotFound('Like not found', 'UNSET_LIKE_NOT_FOUND')
    } else if (like.likedById !== likedById) {
      throw appError.buildForbidden('Wallet cannot unset like', 'UNSET_LIKE_FORBIDDEN')
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