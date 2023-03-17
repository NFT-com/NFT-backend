import { db, entity } from '@nftcom/shared'

export function getLikeService(repos: db.Repository = db.newRepositories()): { [key: string]: any } {
  async function setLike({ likedById, likedId, likedType }): Promise<entity.Like> {
    if (await repos.like.find({ where: { likedById, likedId, likedType } })) {
      throw new Error(`${likedType} already liked`)
    }
    return repos.like.save({ likedById, likedId, likedType })
  }

  return {
    setLike,
  }
}