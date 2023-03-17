import { db, entity } from '@nftcom/shared'

export function getLikeService(repos: db.Repository = db.newRepositories()): { [key: string]: any } {
  async function setLike({ likedById, likedId, likedType }): Promise<entity.Like> {
    const setLikeOptions = { likedById, likedId, likedType }
    if (!likedById || !likedId || !likedType) {
      throw new Error(`Missing property or property undefined in ${setLikeOptions}`)
    }
    if (!Object.values(entity.LikeableType).includes(likedType)) {
      throw new Error(`${likedType} cannot be liked`)
    }
    if (await repos.like.find({ where: setLikeOptions })) {
      throw new Error(`${likedType} already liked`)
    }
    return repos.like.save(setLikeOptions)
  }

  return {
    setLike,
  }
}