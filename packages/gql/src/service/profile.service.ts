import { _logger, db, entity } from '@nftcom/shared'

type isProfileOwnedByUserArgs = { profileId: string; userId: string }
interface ProfileService {
  getProfile(profileId: string): Promise<entity.Profile>
  isProfileOwnedByUser({ profileId, userId }: isProfileOwnedByUserArgs): Promise<boolean>
}
function getProfileService(repos: db.Repository = db.newRepositories()): ProfileService {
  async function getProfile(profileId: string): Promise<entity.Profile> {
    return repos.profile.findById(profileId)
  }

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
    getProfile,
    isProfileOwnedByUser,
  }
}
export const profileService = getProfileService()
