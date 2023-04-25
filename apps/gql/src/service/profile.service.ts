import { _logger, db } from '@nftcom/shared'

type isProfileOwnedByUserArgs = { profileId: string; userId: string }
interface ProfileService {
  isProfileOwnedByUser({ profileId, userId }: isProfileOwnedByUserArgs): Promise<boolean>
}
function getProfileService(repos: db.Repository = db.newRepositories()): ProfileService {
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
export const profileService = getProfileService()
