import { addComment, MAX_COMMENT_LENGTH } from '@nftcom/gql/resolver/comment.resolver'
import { Comment, SocialEntityType } from '@nftcom/shared/db/entity'

import { Context } from '../../defs'
import { commentService } from '../../service/comment.service'
import { profileService } from '../../service/profile.service'

describe('like resolver', () => {
  beforeEach(() => {
    jest
      .spyOn(commentService, 'addComment')
      .mockImplementation(jest.fn(addCommentArgs => Promise.resolve(addCommentArgs as unknown as Comment)))
  })
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('addComment', () => {
    it('should like a Profile', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      const response = await addComment(
        undefined,
        {
          input: {
            authorId: '1',
            content: 'This Profile is lit!!!',
            entityId: '2',
            entityType: SocialEntityType.Profile,
          },
        },
        { user: {} } as Context,
      )

      expect(response).toEqual({
        authorId: '1',
        content: 'This Profile is lit!!!',
        entityId: '2',
        entityType: SocialEntityType.Profile,
      })
    })

    it('should reject requests without authorId', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(
        addComment(
          undefined,
          {
            input: {
              authorId: undefined,
              content: 'This Profile is lit!!!',
              entityId: '2',
              entityType: SocialEntityType.Profile,
            },
          },
          { user: {} } as Context,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without content', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(
        addComment(
          undefined,
          {
            input: {
              authorId: '1',
              content: undefined,
              entityId: '2',
              entityType: SocialEntityType.Profile,
            },
          },
          { user: {} } as Context,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests with content over max characters', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(
        addComment(
          undefined,
          {
            input: {
              authorId: '1',
              content: 'a'.repeat(MAX_COMMENT_LENGTH + 1),
              entityId: '2',
              entityType: SocialEntityType.Profile,
            },
          },
          { user: {} } as Context,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without entityId', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(
        addComment(
          undefined,
          {
            input: {
              authorId: '1',
              content: 'This Profile is lit!!!',
              entityId: undefined,
              entityType: SocialEntityType.Profile,
            },
          },
          { user: {} } as Context,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without entityType', async () => {
      jest.spyOn(profileService, 'isProfileOwnedByUser').mockImplementation(jest.fn(() => Promise.resolve(true)))
      await expect(
        addComment(
          undefined,
          {
            input: {
              authorId: '1',
              content: 'This Profile is lit!!!',
              entityId: '2',
              entityType: undefined,
            },
          },
          { user: {} } as Context,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests with invalid entityType', async () => {
      await expect(
        addComment(
          undefined,
          {
            input: {
              authorId: '1',
              content: 'This Profile is lit!!!',
              entityId: '2',
              entityType: 'Invalid' as unknown as SocialEntityType,
            },
          },
          { user: {} } as Context,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })
  })
})
