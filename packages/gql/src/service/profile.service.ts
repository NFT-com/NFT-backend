import { cache } from '@nftcom/gql/service/cache.service'
import { db } from '@nftcom/shared'

export const customizedProfiles = async (
  chainId: string,
  repositories: db.Repository,
): Promise<any> => {
  const profilesWithScore = await cache.zrevrangebyscore(`Visible_NFT_AMOUNT_${chainId}`, '+inf', '-inf', 'WITHSCORES')

  const leaderboard = []
  let index = 0
  for (let i = 0; i < profilesWithScore.length - 1; i+= 2) {
    const profileId = profilesWithScore[i]
    const itemsVisible = profilesWithScore[i + 1]
    const profile = await repositories.profile.findOne({ where: { id: profileId } })
    leaderboard.push({
      index: index,
      id: profileId,
      itemsVisible: itemsVisible,
      photoURL: profile.photoURL,
      url: profile.url,
    })
    index++
  }
}
