import { FindManyOptions, FindOperator } from 'typeorm'

import { LikeableType } from '@nftcom/misc/gql'
import { entity } from '@nftcom/shared'

import { getLikeService } from '../../service/like.service'
import { profileService } from '../../service/profile.service'

describe('like service', () => {
  let repos, likesMap: Map<string, any>, nextId, lastId
  const firstEthDate = 1438269973000
  beforeEach(() => {
    likesMap = new Map()
    nextId = 1
    repos = {
      like: {
        count: (findByOpts: any) => {
          return Promise.resolve(
            Array.from(likesMap.values()).filter(l => {
              for (const prop of Object.getOwnPropertyNames(findByOpts)) {
                if (l[prop] !== findByOpts[prop]) {
                  return false
                }
              }
              return true
            }).length,
          )
        },
        save: (like: any) => {
          lastId = nextId++
          likesMap.set(lastId, {
            id: lastId,
            createdAt: new Date(firstEthDate),
            updatedAt: new Date(firstEthDate),
            ...like,
          })
          return Promise.resolve(likesMap.get(lastId))
        },
        find: (opts: FindManyOptions<entity.Like>) => {
          return Promise.resolve(
            Array.from(likesMap.values()).filter(l => {
              for (const prop of Object.getOwnPropertyNames(opts.where)) {
                if (l[prop] !== opts.where[prop]) {
                  return false
                }
              }
              return true
            }),
          )
        },
        findOne: (opts: FindManyOptions<entity.Like>) => {
          return Promise.resolve(
            Array.from(likesMap.values()).filter(l => {
              for (const prop of Object.getOwnPropertyNames(opts.where)) {
                if (opts.where[prop] instanceof FindOperator && opts.where[prop]._type === 'in') {
                  if (!opts.where[prop]._value.some(v => v === l[prop])) {
                    return false
                  }
                } else {
                  if (l[prop] !== opts.where[prop]) {
                    return false
                  }
                }
              }
              return true
            })[0],
          )
        },
        findById: (id: string) => {
          return Promise.resolve(likesMap.get(id))
        },
        hardDeleteByIds: (ids: string[]) => {
          const results: boolean[] = []
          for (const id of ids) {
            results.push(likesMap.delete(id))
          }
          return results.some(e => e)
        },
      },
      profile: {
        find: (opts: FindManyOptions<entity.Profile>) => {
          if (opts.where['ownerUserId'] === 'true') {
            return Promise.resolve([{ id: 'trueProfile' } as entity.Profile])
          }
          return Promise.resolve([])
        },
      },
    }
  })

  describe('getLikeCount', () => {
    it('gets a count of likes', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await Promise.all([
        likeService.setLike({ likedById: '1', likedId: '2', likedType: LikeableType.NFT }, 'userId'),
        likeService.setLike({ likedById: '2', likedId: '2', likedType: LikeableType.NFT }, 'userId'),
        likeService.setLike({ likedById: '3', likedId: '2', likedType: LikeableType.NFT }, 'userId'),
      ])
      const result = await likeService.getLikeCount('2')
      expect(result).toBe(3)
    })

    it('gets a zero count of likes when there are none', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await Promise.all([
        likeService.setLike({ likedById: '1', likedId: '2', likedType: LikeableType.NFT }, 'userId'),
        likeService.setLike({ likedById: '2', likedId: '2', likedType: LikeableType.NFT }, 'userId'),
        likeService.setLike({ likedById: '3', likedId: '2', likedType: LikeableType.NFT }, 'userId'),
      ])
      const result = await likeService.getLikeCount('1')
      expect(result).toBe(0)
    })

    it('throws invalid when likedId is missing', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.getLikeCount(undefined)).rejects.toThrow('Cannot get count without likedId')
    })
  })

  describe('isLikedByUser', () => {
    it('should be true if the user likes the entity', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await likeService.setLike({ likedById: 'trueProfile', likedId: '2', likedType: LikeableType.NFT }, 'userId')
      const result = await likeService.isLikedByUser('2', 'true')
      expect(result).toBe(true)
    })

    it('should be false if the user does not like the entity', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await likeService.setLike({ likedById: '1', likedId: '2', likedType: LikeableType.Collection }, 'userId')
      const result = await likeService.isLikedByUser('2', 'testUser')
      expect(result).toBe(false)
    })

    it('should be false if there are no likes for the entity', async () => {
      const likeService = getLikeService(repos)
      const result = await likeService.isLikedByUser('2', 'testUser')
      expect(result).toBe(false)
    })
  })

  describe('setLike', () => {
    it('sets a like for an NFT', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      const result = await likeService.setLike({ likedById: '1', likedId: '2', likedType: LikeableType.NFT }, 'userId')

      expect(result).toEqual({
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        id: lastId,
        likedById: '1',
        likedId: '2',
        likedType: 'NFT',
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
      })
    })

    it('does not set like for an NFT that is already set', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await likeService.setLike(
        {
          likedById: 'nftLikeSetAlreadyLikedBy',
          likedId: 'nftLikeSetAlreadyLiked',
          likedType: LikeableType.NFT,
        },
        'userId',
      )
      await expect(
        likeService.setLike(
          {
            likedById: 'nftLikeSetAlreadyLikedBy',
            likedId: 'nftLikeSetAlreadyLiked',
            likedType: LikeableType.NFT,
          },
          'userId',
        ),
      ).rejects.toThrow('NFT already liked')
    })

    it('sets a like for a Collection', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      const result = await likeService.setLike(
        { likedById: '1', likedId: '2', likedType: LikeableType.Collection },
        'userId',
      )

      expect(result).toEqual({
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        id: lastId,
        likedById: '1',
        likedId: '2',
        likedType: 'Collection',
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
      })
    })

    it('does not set like for a Collection that is already set', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await likeService.setLike(
        {
          likedById: 'collectionLikeSetAlreadyLikedBy',
          likedId: 'collectionLikeSetAlreadyLiked',
          likedType: LikeableType.Collection,
        },
        'userId',
      )
      await expect(
        likeService.setLike(
          {
            likedById: 'collectionLikeSetAlreadyLikedBy',
            likedId: 'collectionLikeSetAlreadyLiked',
            likedType: LikeableType.Collection,
          },
          'userId',
        ),
      ).rejects.toThrow('Collection already liked')
    })

    it('sets a like for a Profile', async () => {
      const likeService = getLikeService(repos)
      const result = await likeService.setLike(
        { likedById: '1', likedId: '2', likedType: LikeableType.Profile },
        'userId',
      )

      expect(result).toEqual({
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        id: lastId,
        likedById: '1',
        likedId: '2',
        likedType: 'Profile',
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
      })
    })

    it('does not set like for a Profile that is already set', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await likeService.setLike(
        {
          likedById: 'profileLikeSetAlreadyLikedBy',
          likedId: 'profileLikeSetAlreadyLiked',
          likedType: LikeableType.Profile,
        },
        'userId',
      )
      await expect(
        likeService.setLike(
          {
            likedById: 'profileLikeSetAlreadyLikedBy',
            likedId: 'profileLikeSetAlreadyLiked',
            likedType: LikeableType.Profile,
          },
          'userId',
        ),
      ).rejects.toThrow('Profile already liked')
    })

    it('does not set like for invalid type', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      await expect(
        likeService.setLike(
          {
            likedById: '1',
            likedId: '2',
            likedType: 'Walnut' as LikeableType,
          },
          'userId',
        ),
      ).rejects.toThrow('Walnut cannot be liked')
    })

    it('requires likedById', async () => {
      const likeService = getLikeService(repos)
      await expect(
        likeService.setLike(
          {
            likedById: undefined,
            likedId: '2',
            likedType: LikeableType.NFT,
          },
          'userId',
        ),
      ).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires likedId', async () => {
      const likeService = getLikeService(repos)
      await expect(
        likeService.setLike(
          {
            likedById: '1',
            likedId: undefined,
            likedType: LikeableType.NFT,
          },
          'userId',
        ),
      ).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires likedType', async () => {
      const likeService = getLikeService(repos)
      await expect(
        likeService.setLike(
          {
            likedById: '1',
            likedId: '2',
            likedType: undefined,
          },
          'userId',
        ),
      ).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires user to own profile likedBy', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(false)
      const likeService = getLikeService(repos)
      await expect(
        likeService.setLike(
          {
            likedById: '1',
            likedId: '2',
            likedType: LikeableType.Profile,
          },
          'userId',
        ),
      ).rejects.toThrow('User cannot set like')
    })
  })

  describe('unsetLike', () => {
    it('should unset a like', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const likeService = getLikeService(repos)
      const like = await likeService.setLike(
        {
          likedById: 'likedById',
          likedId: '1',
          likedType: LikeableType.NFT,
        },
        'userId',
      )
      const result = await likeService.unsetLike(
        {
          likedById: like.likedById,
          likedId: like.likedId,
          likedType: like.likedType,
        },
        'userId',
      )
      expect(result).toBe(true)
    })
    it('should throw invalid when no user id', async () => {
      const likeService = getLikeService(repos)
      await expect(
        likeService.unsetLike({ likedById: '1', likedId: '2', likedType: LikeableType.NFT }, undefined),
      ).rejects.toThrow('unsetLike requires likedByUserId')
    })

    it('should throw not found when no like found', async () => {
      const likeService = getLikeService(repos)
      await expect(
        likeService.unsetLike(
          {
            likedById: '0',
            likedId: '-1',
            likedType: LikeableType.NFT,
          },
          'testLikedById',
        ),
      ).rejects.toThrow('Like not found')
    })

    it('should throw forbidden when likedByUserId does not own the profile likedBY', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValueOnce(true).mockResolvedValue(false)
      const likeService = getLikeService(repos)
      const like = await likeService.setLike(
        {
          likedById: 'differentId',
          likedId: '1',
          likedType: LikeableType.NFT,
        },
        'userId',
      )
      await expect(
        likeService.unsetLike(
          {
            likedById: like.likedById,
            likedId: like.likedId,
            likedType: like.likedType,
          },
          'testLikedById',
        ),
      ).rejects.toThrow('User cannot unset like')
    })
  })
})
