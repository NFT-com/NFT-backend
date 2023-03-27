import { setLike, unsetLike } from '@nftcom/gql/resolver/like.resolver'
import { Like, LikeableType, User } from '@nftcom/shared/db/entity'

import { Context } from '../../defs'
import { likeService } from '../../service/like.service'
import { profileService } from '../../service/profile.service'

describe('like resolver', () => {
  beforeEach(() => {
    jest.spyOn(likeService, 'setLike').mockImplementation(jest.fn((setLikeArgs) => Promise.resolve(setLikeArgs as Like)))
  })
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('setLike', () => {
    it('should like a Collection', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      const response = await setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: LikeableType.Collection },
      }, { user: {} } as Context)

      expect(response).toEqual({ likedById: '1', likedId: '2', likedType: LikeableType.Collection })
    })

    it('should reject requests without likedById', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(setLike(undefined, {
        input: { likedById: undefined, likedId: '2', likedType: LikeableType.Collection },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without likedId', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: undefined, likedType: LikeableType.Collection },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without likedType', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: undefined },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests with invalid likedType', async () => {
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: 'Invalid' as unknown as LikeableType },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without user', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: 'Invalid' as unknown as LikeableType },
      }, undefined)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests with user but does not own profile', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(false)))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: 'Invalid' as unknown as LikeableType },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })
  })

  describe('unsetLike', () => {
    it('should remove a like by id', async () => {
      jest.spyOn(likeService, 'unsetLike').mockResolvedValueOnce(true)
      const response = await unsetLike(undefined, { input: { likedById: '1', likedId: '2', likedType: LikeableType.Collection } }, { user: { id: 'testProfileId' } as User } as Context)
      expect(response).toBe(true)
    })
  })
})