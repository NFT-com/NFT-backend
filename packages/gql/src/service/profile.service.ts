import { _logger, db } from '@nftcom/shared'

export type isProfileOwnedByUserArgs = { profileId: string; userId: string }

export function getProfileService(repos: db.Repository = db.newRepositories()): { [key: string]: any } {
  async function isProfileOwnedByUser({ profileId, userId }: isProfileOwnedByUserArgs): Promise<boolean> {
    if (!profileId || !userId) {
      return false
    }
    return !!(await repos.profile.find({
      where: {
        id: profileId,
        ownerUserId: userId,
      },
    }))
  }

  return {
    isProfileOwnedByUser,
  }
}