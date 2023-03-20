import { db, entity } from '@nftcom/shared'

function getLikeService(repos: db.Repository = db.newRepositories()): { [key: string]: any } {
  type SetLikeArgs = { likedById: string; likedId: string; likedType: entity.LikeableType }
  async function setLike({ likedById, likedId, likedType }: SetLikeArgs): Promise<entity.Like> {
    const setLikeArgs = { likedById, likedId, likedType }
    if (!likedById || !likedId || !likedType) {
      throw new Error(`Missing property or property undefined in ${setLikeArgs}`)
    }
    if (!Object.values(entity.LikeableType).includes(likedType)) {
      throw new Error(`${likedType} cannot be liked`)
    }
    if (await repos.like.find({ where: setLikeArgs })) {
      throw new Error(`${likedType} already liked`)
    }
    return repos.like.save(setLikeArgs)
  }

  return {
    setLike,
  }
}
export const likeService = getLikeService()