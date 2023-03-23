import { entity } from '@nftcom/shared'

import { getViewService } from '../../service/view.service'

describe('view service', () => {
  let repos, viewsMap: Map<string, any>, nextId, lastId, viewService
  const firstEthDate = 1438269973000
  describe('handleView', () => {
    beforeEach(() => {
      viewsMap = new Map()
      nextId = 1
      repos = {
        view: {
          save: (like: any) => {
            lastId = nextId++
            viewsMap.set(lastId, {
              id: lastId, createdAt: new Date(firstEthDate), updatedAt: new Date(firstEthDate), ...like,
            })
            return Promise.resolve(viewsMap.get(lastId))
          },
        },
      }
      viewService = getViewService(repos)
    })
    it('sets a view for an NFT', async () => {
      const viewInputs = {
        viewerId: '1',
        viewerType: entity.ViewerType.ProfileHolder,
        viewedId: '2',
        viewedType: entity.ViewableType.NFT,
      }
      expect(await viewService.handleView(viewInputs)).toEqual({
        id: lastId,
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
        ...viewInputs,
      })
    })

    it('sets a view for a Collection', async () => {
      const viewInputs = {
        viewerId: '3',
        viewerType: entity.ViewerType.User,
        viewedId: '4',
        viewedType: entity.ViewableType.Collection,
      }
      expect(await viewService.handleView(viewInputs)).toEqual({
        id: lastId,
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
        ...viewInputs,
      })
    })

    it('sets a view for a Profile', async () => {
      const viewInputs = {
        viewerId: 'visitor1',
        viewerType: entity.ViewerType.Visitor,
        viewedId: '6',
        viewedType: entity.ViewableType.Profile,
      }
      expect(await viewService.handleView(viewInputs)).toEqual({
        id: lastId,
        createdAt: new Date('2015-07-30T15:26:13.000Z'),
        updatedAt: new Date('2015-07-30T15:26:13.000Z'),
        ...viewInputs,
      })
    })

    it('does not set view for invalid viewer type', async () => {
      const viewInputs = {
        viewerId: 'visitor1',
        viewerType: 'Giraffe' as entity.ViewerType,
        viewedId: '6',
        viewedType: entity.ViewableType.NFT,
      }
      await expect(viewService.handleView(viewInputs))
        .rejects.toThrow('Unknown viewer type: Giraffe')
    })

    it('does not set view for invalid viewed type', async () => {
      const viewInputs = {
        viewerId: 'visitor1',
        viewerType: entity.ViewerType.Visitor,
        viewedId: '6',
        viewedType: 'Peanut' as entity.ViewableType,
      }
      await expect(viewService.handleView(viewInputs))
        .rejects.toThrow('Cannot view Peanut')
    })

    it('requires viewerId', async () => {
      await expect(viewService.handleView({
        viewerType: entity.ViewerType.Visitor,
        viewedId: '6',
        viewedType: entity.ViewableType.Collection,
      }))
        .rejects
        .toThrow('Missing property or property undefined in {"viewerType":"Visitor","viewedId":"6","viewedType":"Collection"}')
    })

    it('requires viewerType', async () => {
      await expect(viewService.handleView({
        viewerId: '1',
        viewedId: '6',
        viewedType: entity.ViewableType.NFT,
      }))
        .rejects
        .toThrow('Missing property or property undefined in {"viewerId":"1","viewedId":"6","viewedType":"NFT"}')
    })

    it('requires viewedId', async () => {
      await expect(viewService.handleView({
        viewerId: '1',
        viewerType: entity.ViewerType.User,
        viewedType: entity.ViewableType.Profile,
      }))
        .rejects
        .toThrow('Missing property or property undefined in {"viewerId":"1","viewerType":"User","viewedType":"Profile"}')
    })

    it('requires viewedType', async () => {
      await expect(viewService.handleView({
        viewerId: '1',
        viewerType: entity.ViewerType.ProfileHolder,
        viewedId: '6',
      }))
        .rejects
        .toThrow('Missing property or property undefined in {"viewerId":"1","viewerType":"Profile Holder","viewedId":"6"}')
    })
  })
})