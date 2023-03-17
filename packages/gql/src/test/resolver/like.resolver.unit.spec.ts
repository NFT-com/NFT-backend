import { setLike } from '@nftcom/gql/resolver/like.resolver'
import { LikeableType } from '@nftcom/shared/db/entity'

import { Context } from '../../defs'
import * as likeService from '../../service/like.service'
jest.mock('../../service/like.service')
const mockedLikeService = likeService as jest.Mocked<typeof likeService>

import * as profileService from '../../service/profile.service'
jest.mock('../../service/profile.service')
const mockedProfileService = profileService as jest.Mocked<typeof profileService>

describe('like resolver', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('setLike', () => {
    it('should like a Collection', async () => {
      mockedLikeService.getLikeService.mockImplementation(() => ({
        setLike: jest.fn((setLikeArgs) => setLikeArgs),
      }))
      mockedProfileService.getProfileService.mockImplementation(() => ({
        isProfileOwnedByUser: jest.fn(() => true),
      }))
      const response = await setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: LikeableType.Collection },
      }, { user: {} } as Context)

      expect(response).toEqual({ likedById: '1', likedId: '2', likedType: LikeableType.Collection })
    })

    it('should reject requests without likedById', async () => {
      mockedLikeService.getLikeService.mockImplementation(() => ({
        setLike: jest.fn((setLikeArgs) => setLikeArgs),
      }))
      mockedProfileService.getProfileService.mockImplementation(() => ({
        isProfileOwnedByUser: jest.fn(() => true),
      }))
      await expect(setLike(undefined, {
        input: { likedById: undefined, likedId: '2', likedType: LikeableType.Collection },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without likedId', async () => {
      mockedLikeService.getLikeService.mockImplementation(() => ({
        setLike: jest.fn((setLikeArgs) => setLikeArgs),
      }))
      mockedProfileService.getProfileService.mockImplementation(() => ({
        isProfileOwnedByUser: jest.fn(() => true),
      }))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: undefined, likedType: LikeableType.Collection },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without likedType', async () => {
      mockedLikeService.getLikeService.mockImplementation(() => ({
        setLike: jest.fn((setLikeArgs) => setLikeArgs),
      }))
      mockedProfileService.getProfileService.mockImplementation(() => ({
        isProfileOwnedByUser: jest.fn(() => true),
      }))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: undefined },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests with invalid likedType', async () => {
      mockedLikeService.getLikeService.mockImplementation(() => ({
        setLike: jest.fn((setLikeArgs) => setLikeArgs),
      }))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: 'Invalid' as unknown as LikeableType },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without user', async () => {
      mockedLikeService.getLikeService.mockImplementation(() => ({
        setLike: jest.fn((setLikeArgs) => setLikeArgs),
      }))
      mockedProfileService.getProfileService.mockImplementation(() => ({
        isProfileOwnedByUser: jest.fn(() => true),
      }))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: 'Invalid' as unknown as LikeableType },
      }, undefined)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests with user but does not own profile', async () => {
      mockedLikeService.getLikeService.mockImplementation(() => ({
        setLike: jest.fn((setLikeArgs) => setLikeArgs),
      }))
      mockedProfileService.getProfileService.mockImplementation(() => ({
        isProfileOwnedByUser: jest.fn(() => false),
      }))
      await expect(setLike(undefined, {
        input: { likedById: '1', likedId: '2', likedType: 'Invalid' as unknown as LikeableType },
      }, { user: {} } as Context)).rejects.toThrow(/^Invalid schema provided: .*$/)
    })
  })
})