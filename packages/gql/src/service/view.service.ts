import { appError } from '@nftcom/error-types'
import { db, entity } from '@nftcom/shared'

type CommonViewArgs = {
  viewerId: string
  viewerType: entity.ViewerType
  viewedId: string
  viewedType: entity.ViewableType
}
interface ViewService {
  handleView({ viewerId, viewerType, viewedId, viewedType }: CommonViewArgs): Promise<entity.View>
}
export function getViewService(repos: db.Repository = db.newRepositories()): ViewService {
  async function handleView(
    viewArgs: CommonViewArgs,
  ): Promise<entity.View> {
    const { viewerId, viewerType, viewedId, viewedType } = viewArgs
    if (!viewerId || !viewerType || !viewedId || !viewedType) {
      throw new Error(`Missing property or property undefined in ${JSON.stringify(viewArgs)}`)
    }
    if (!Object.values(entity.ViewerType).includes(viewerType)) {
      throw appError.buildInvalid(`Unknown viewer type: ${viewerType}`, 'VIEW_INVALID')
    }
    if (!Object.values(entity.ViewableType).includes(viewedType)) {
      throw appError.buildInvalid(`Cannot view ${viewedType}`, 'VIEW_INVALID')
    }
    return repos.view.save(viewArgs)
  }

  return {
    handleView,
  }
}
export const viewService = getViewService()