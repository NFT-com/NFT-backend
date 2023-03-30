import { gql } from '@nftcom/gql/defs'
import { recordView } from '@nftcom/gql/resolver/view.resolver'
import { View, ViewableType } from '@nftcom/shared/db/entity'

import { viewService } from '../../service/view.service'

describe('view resolver', () => {
  beforeEach(() => {
    jest
      .spyOn(viewService, 'handleView')
      .mockImplementation(jest.fn(handleViewArgs => Promise.resolve(handleViewArgs as View)))
  })
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('recordView', () => {
    it('should create a view of an NFT', async () => {
      jest.spyOn(viewService, 'handleView').mockResolvedValue({ id: '1' } as View)
      const recordViewInput = {
        viewerId: '1',
        viewerType: 'ProfileHolder' as gql.ViewerType,
        viewedId: '2',
        viewedType: ViewableType.NFT,
      }
      const response = await recordView(
        undefined,
        {
          input: recordViewInput,
        },
        undefined,
      )

      expect(response).toEqual(true)
    })

    it('should reject requests without viewerId', async () => {
      await expect(
        recordView(
          undefined,
          {
            input: {
              viewerId: undefined,
              viewerType: 'User' as gql.ViewerType,
              viewedId: '2',
              viewedType: ViewableType.NFT,
            },
          },
          undefined,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without viewerType', async () => {
      await expect(
        recordView(
          undefined,
          {
            input: { viewerId: '1', viewerType: undefined, viewedId: '2', viewedType: ViewableType.NFT },
          },
          undefined,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests without viewedId', async () => {
      await expect(
        recordView(
          undefined,
          {
            input: {
              viewerId: '1',
              viewerType: 'Visitor' as gql.ViewerType,
              viewedId: undefined,
              viewedType: ViewableType.NFT,
            },
          },
          undefined,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })

    it('should reject requests with invalid viewedType', async () => {
      await expect(
        recordView(
          undefined,
          {
            input: {
              viewerId: '1',
              viewerType: 'ProfileHolder' as gql.ViewerType,
              viewedId: '2',
              viewedType: undefined,
            },
          },
          undefined,
        ),
      ).rejects.toThrow(/^Invalid schema provided: .*$/)
    })
  })
})
