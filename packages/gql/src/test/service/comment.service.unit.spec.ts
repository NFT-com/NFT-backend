import { FindManyOptions, FindOperator } from 'typeorm'

import { entity } from '@nftcom/shared'
import { SocialEntityType } from '@nftcom/shared/db/entity'

import { getCommentService } from '../../service/comment.service'
import { profileService } from '../../service/profile.service'

describe('comment service', () => {
  let repos, likesMap: Map<string, any>, nextId, lastId
  const firstEthDate = 1438269973000
  beforeEach(() => {
    likesMap = new Map()
    nextId = 1
    repos = {
      comment: {
        save: (comment: any) => {
          lastId = nextId++
          likesMap.set(lastId, {
            id: lastId,
            createdAt: new Date(firstEthDate),
            updatedAt: new Date(firstEthDate),
            ...comment,
          })
          return Promise.resolve(likesMap.get(lastId))
        },
        find: (opts: FindManyOptions<entity.Comment>) => {
          return Promise.resolve(
            Array.from(likesMap.values()).filter(l => {
              for (const prop of Object.keys(opts.where)) {
                if (l[prop] !== opts.where[prop]) {
                  return false
                }
              }
              return true
            }),
          )
        },
        findOne: (opts: FindManyOptions<entity.Comment>) => {
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

  describe('addComment', () => {
    it('adds a comment for an NFT', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const commentService = getCommentService(repos)
      const testArgs = {
        authorId: '1',
        content: 'This NFT is awesome!',
        currentUserId: 'userId',
        entityId: '2',
        entityType: SocialEntityType.NFT,
      }
      const result = await commentService.addComment(testArgs)

      expect(result).toEqual({
        ...testArgs,
        id: lastId,
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
      })
    })

    it('sets a comment for a Collection', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const commentService = getCommentService(repos)
      const testArgs = {
        authorId: '1',
        content: 'This Collection is fine...',
        currentUserId: 'userId',
        entityId: '2',
        entityType: SocialEntityType.Collection,
      }
      const result = await commentService.addComment(testArgs)

      expect(result).toEqual({
        ...testArgs,
        id: lastId,
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
      })
    })

    it('sets a comment for a Profile', async () => {
      const commentService = getCommentService(repos)
      const testArgs = {
        authorId: '1',
        content: 'This Profile is lit!!!',
        currentUserId: 'userId',
        entityId: '2',
        entityType: SocialEntityType.Profile,
      }
      const result = await commentService.addComment(testArgs)

      expect(result).toEqual({
        ...testArgs,
        id: lastId,
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
      })
    })

    it('does not set comment for invalid type', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const commentService = getCommentService(repos)
      await expect(
        commentService.addComment(
          {
            authorId: '1',
            content: 'Joker is da 💣💥',
            currentUserId: 'userId',
            entityId: '2',
            entityType: 'Joker' as SocialEntityType,
          },
        ),
      ).rejects.toThrow('Joker cannot be the subject of a comment')
    })

    it('requires authorId', async () => {
      const commentService = getCommentService(repos)
      await expect(
        commentService.addComment({
          authorId: undefined,
          content: 'This Profile is lit!!!',
          currentUserId: 'userId',
          entityId: '2',
          entityType: SocialEntityType.Profile,
        }),
      ).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires content', async () => {
      const commentService = getCommentService(repos)
      await expect(
        commentService.addComment({
          authorId: '1',
          content: undefined,
          currentUserId: 'userId',
          entityId: '2',
          entityType: SocialEntityType.Profile,
        }),
      ).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires entityId', async () => {
      const commentService = getCommentService(repos)
      await expect(
        commentService.addComment({
          authorId: '1',
          content: 'This Profile is lit!!!',
          currentUserId: 'userId',
          entityId: undefined,
          entityType: SocialEntityType.Profile,
        }),
      ).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires entityType', async () => {
      const commentService = getCommentService(repos)
      await expect(
        commentService.addComment({
          authorId: '1',
          content: 'This Profile is lit!!!',
          currentUserId: 'userId',
          entityId: '2',
          entityType: undefined,
        }),
      ).rejects.toThrow(/^Missing property or property undefined in .*$/)
    })

    it('requires user to own profile likedBy', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(false)
      const commentService = getCommentService(repos)
      await expect(
        commentService.addComment({
          authorId: '1',
          content: 'This Profile is lit!!!',
          currentUserId: 'userId',
          entityId: '2',
          entityType: SocialEntityType.Profile,
        }),
      ).rejects.toThrow('User cannot comment with profile: 1')
    })
  })
})
