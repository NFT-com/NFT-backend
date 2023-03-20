import { FindManyOptions } from 'typeorm'

import { entity } from '@nftcom/shared'

import { getLikeService } from '../../service/like.service'

describe('like service', () => {
  let repos, likesMap: Map<string, any>, nextId, lastId
  const firstEthDate = 1438269973000
  beforeEach(() => {
    likesMap = new Map()
    nextId = 1
    repos = {
      like: {
        count: (findByOpts: any) => {
          return Promise.resolve(Array.from(likesMap.values()).filter((l) => {
            for (const prop of Object.getOwnPropertyNames(findByOpts)) {
              if (l[prop] !== findByOpts[prop]) {
                return false
              }
            }
            return true
          }).length)
        },
        save: (like: any) => {
          lastId = nextId++
          likesMap.set(lastId, {
            id: lastId, createdAt: new Date(firstEthDate), updatedAt: new Date(firstEthDate), ...like,
          })
          return Promise.resolve(likesMap.get(lastId))
        },
        find: (opts: FindManyOptions<entity.Like>) => {
          for(const like of likesMap.values()) {
            if (opts.where['likedById'] === like.likedById
            && opts.where['likedId'] === like.likedId
            && opts.where['likedType'] === like.likedType) {
              return Promise.resolve(like)
            }
          }
          return Promise.resolve(undefined)
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
    }
  })

  describe('getLikeCount', () => {
    it('gets a count of likes', async () => {
      const likeService = getLikeService(repos)
      await Promise.all([
        likeService.setLike({ likedById: '1', likedId: '2', likedType: 'NFT' }),
        likeService.setLike({ likedById: '2', likedId: '2', likedType: 'NFT' }),
        likeService.setLike({ likedById: '3', likedId: '2', likedType: 'NFT' }),
      ])
      const result = await likeService.getLikeCount('2')
      expect(result).toBe(3)
    })

    it('gets a zero count of likes when there are none', async () => {
      const likeService = getLikeService(repos)
      await Promise.all([
        likeService.setLike({ likedById: '1', likedId: '2', likedType: 'NFT' }),
        likeService.setLike({ likedById: '2', likedId: '2', likedType: 'NFT' }),
        likeService.setLike({ likedById: '3', likedId: '2', likedType: 'NFT' }),
      ])
      const result = await likeService.getLikeCount('1')
      expect(result).toBe(0)
    })

    it('throws invalid when likedId is missing', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.getLikeCount()).rejects.toThrow('Cannot get count without likedId')
    })
  })
  
  describe('setLike', () => {
    it('sets a like for an NFT', async () => {
      const likeService = getLikeService(repos)
      const result = await likeService.setLike({ likedById: '1', likedId: '2', likedType: 'NFT' })

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
      const likeService = getLikeService(repos)
      await likeService.setLike({
        likedById: 'nftLikeSetAlreadyLikedBy',
        likedId: 'nftLikeSetAlreadyLiked',
        likedType: 'NFT',
      })
      await expect(likeService.setLike({
        likedById: 'nftLikeSetAlreadyLikedBy',
        likedId: 'nftLikeSetAlreadyLiked',
        likedType: 'NFT',
      })).rejects.toThrow('NFT already liked')
    })

    it('sets a like for a Collection', async () => {
      const likeService = getLikeService(repos)
      const result = await likeService.setLike({ likedById: '1', likedId: '2', likedType: 'Collection' })

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
      const likeService = getLikeService(repos)
      await likeService.setLike({
        likedById: 'collectionLikeSetAlreadyLikedBy',
        likedId: 'collectionLikeSetAlreadyLiked',
        likedType: 'Collection',
      })
      await expect(likeService.setLike({
        likedById: 'collectionLikeSetAlreadyLikedBy',
        likedId: 'collectionLikeSetAlreadyLiked',
        likedType: 'Collection',
      })).rejects.toThrow('Collection already liked')
    })

    it('sets a like for a Profile', async () => {
      const likeService = getLikeService(repos)
      const result = await likeService.setLike({ likedById: '1', likedId: '2', likedType: 'Profile' })

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
      const likeService = getLikeService(repos)
      await likeService.setLike({
        likedById: 'profileLikeSetAlreadyLikedBy',
        likedId: 'profileLikeSetAlreadyLiked',
        likedType: 'Profile',
      })
      await expect(likeService.setLike({
        likedById: 'profileLikeSetAlreadyLikedBy',
        likedId: 'profileLikeSetAlreadyLiked',
        likedType: 'Profile',
      })).rejects.toThrow('Profile already liked')
    })

    it('does not set like for invalid type', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.setLike({
        likedById: '1',
        likedId: '2',
        likedType: 'Walnut',
      })).rejects.toThrow('Walnut cannot be liked')
    })

    it('requires likedById', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.setLike({
        likedById: undefined,
        likedId: '2',
        likedType: 'NFT',
      })).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires likedId', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.setLike({
        likedById: '1',
        likedId: undefined,
        likedType: 'NFT',
      })).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('required likedType', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.setLike({
        likedById: '1',
        likedId: '2',
        likedType: undefined,
      })).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })
  })

  describe('unsetLike', () => {
    it('should unset a like', async () => {
      const likeService = getLikeService(repos)
      const like = await likeService.setLike({
        likedById: 'likedById',
        likedId: '1',
        likedType: 'NFT',
      })
      const result = await likeService.unsetLike(like.id, 'likedById')
      expect(result).toBe(true)
    })
    it('should throw invalid when no preferred profile', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.unsetLike('1', undefined))
        .rejects.toThrow('Wallet has no preferred profile')
    })

    it('should throw not found when no like found', async () => {
      const likeService = getLikeService(repos)
      await expect(likeService.unsetLike('-1', 'testLikedById'))
        .rejects.toThrow('Like not found')
    })

    it('should throw forbidden when likedById does not match', async () => {
      const likeService = getLikeService(repos)
      const like = await likeService.setLike({
        likedById: 'differentId',
        likedId: '1',
        likedType: 'NFT',
      })
      await expect(likeService.unsetLike(like.id, 'testLikedById'))
        .rejects.toThrow('Wallet cannot unset like')
    })
  })
})