import { FindManyOptions, FindOperator } from 'typeorm'

import { entity } from '@nftcom/shared'
import { SocialEntityType } from '@nftcom/shared/db/entity'

import { getCommentService } from '../../service/comment.service'
import { profileService } from '../../service/profile.service'

describe('comment service', () => {
  let repos, commentsMap: Map<string, any>, nextId, lastId, incrementCreatedAt, createdAtDate
  const firstEthDate = 1438269973000
  beforeAll(() => {
    createdAtDate = firstEthDate
    incrementCreatedAt = false
  })
  beforeEach(() => {
    commentsMap = new Map()
    nextId = 1
    repos = {
      comment: {
        save: (comment: any) => {
          lastId = nextId++
          commentsMap.set(lastId, {
            id: lastId,
            createdAt: new Date(createdAtDate),
            updatedAt: new Date(createdAtDate),
            ...comment,
          })
          if (incrementCreatedAt) createdAtDate = createdAtDate + 1000
          return Promise.resolve(commentsMap.get(lastId))
        },
        find: (opts: FindManyOptions<entity.Comment>) => {
          return Promise.resolve(
            Array.from(commentsMap.values()).filter(l => {
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
            Array.from(commentsMap.values()).filter(l => {
              for (const prop of Object.keys(opts.where)) {
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
          return Promise.resolve(commentsMap.get(id))
        },
        findPageable: ({ where, skip, take }: FindManyOptions<Partial<entity.Comment>>): Promise<any> => {
          const defaultPageSkip = 0
          const defaultPageSize = 5000

          const found = Array.from(commentsMap.values()).filter(l => {
            for (const prop of Object.keys(where[0])) {
              if (['deletedAt', 'createdAt'].includes(prop)) {
                continue
              }
              if (l[prop] !== where[0][prop]) {
                return false
              }
            }
            return true
          })
          return Promise.resolve([found.slice(skip || defaultPageSkip, take || defaultPageSize), found.length])
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
        commentService.addComment({
          authorId: '1',
          content: 'Joker is da 💣💥',
          currentUserId: 'userId',
          entityId: '2',
          entityType: 'Joker' as SocialEntityType,
        }),
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

    it('requires user to own profile of authorId', async () => {
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

  describe('getComments', () => {
    beforeEach(() => {
      createdAtDate = firstEthDate
      incrementCreatedAt = true
    })
    it('gets comments less than first page', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const commentService = getCommentService(repos)
      await Promise.all(
        [1].map(i =>
          commentService.addComment({
            authorId: '1',
            content: `Comment ${i}`,
            currentUserId: 'userId',
            entityId: '2',
            entityType: SocialEntityType.Profile,
          }),
        ),
      )

      const result = await commentService.getComments({ entityId: '2' })
      expect(result.items).toEqual([
        {
          authorId: '1',
          content: `Comment 1`,
          currentUserId: 'userId',
          entityId: '2',
          entityType: SocialEntityType.Profile,
          id: lastId,
          createdAt: new Date('2015-07-30T15:26:13.000Z'),
          updatedAt: new Date('2015-07-30T15:26:13.000Z'),
        },
      ])
    })

    it('gets comments for first page', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const commentService = getCommentService(repos)
      await Promise.all(
        [...Array(40).keys()].map(i =>
          commentService.addComment({
            authorId: '1',
            content: `Comment ${i}`,
            currentUserId: 'userId',
            entityId: '3',
            entityType: SocialEntityType.Profile,
          }),
        ),
      )

      const result = await commentService.getComments({ entityId: '3' })
      expect(result.items.length).toBe(20)
      expect(result.totalItems).toBe(40)
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            createdAt: new Date('2015-07-30T15:26:13.000Z'),
          }),
          expect.objectContaining({
            createdAt: new Date('2015-07-30T15:26:32.000Z'),
          }),
          expect.not.objectContaining({
            createdAt: new Date('2015-07-30T15:26:33.000Z'),
          }),
        ]),
      )
    })

    it('does not get comments for other entity', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockResolvedValue(true)
      const commentService = getCommentService(repos)
      await Promise.all(
        [...Array(40).keys()].map(i =>
          commentService.addComment({
            authorId: '1',
            content: `Comment ${i}`,
            currentUserId: 'userId',
            entityId: '4',
            entityType: SocialEntityType.Profile,
          }),
        ),
      )
      await Promise.all(
        [...Array(10).keys()].map(i =>
          commentService.addComment({
            authorId: '1',
            content: `Comment ${i}`,
            currentUserId: 'userId',
            entityId: '5',
            entityType: SocialEntityType.Profile,
          }),
        ),
      )

      const result = await commentService.getComments({ entityId: '5' })
      expect(result.items.length).toBe(10)
      expect(result.totalItems).toBe(10)
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.not.objectContaining({
            entityId: '4',
          }),
        ]),
      )
    })
  })
})
