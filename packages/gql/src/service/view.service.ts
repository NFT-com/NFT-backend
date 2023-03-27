import { appError } from '@nftcom/error-types'
import { db, entity } from '@nftcom/shared'

interface ViewService {
  handleView(viewArgs: {
    viewerId: string
    viewerType: entity.ViewerType
    viewedId: string
    viewedType: entity.ViewableType
  }): Promise<entity.View>
}

async function isViewerIdProfileHolder(repos: db.Repository, viewerId: string): Promise<boolean> {
  return !!(await repos.profile.findOne({
    where: {
      ownerUserId: viewerId,
    },
  }))
}

async function isViewerIdUser(repos: db.Repository, viewerId: string): Promise<boolean> {
  return !!(await repos.user.findById(viewerId))
}

export function getViewService(repos: db.Repository = db.newRepositories()): ViewService {
  async function handleView(
    viewArgs: {
      viewerId: string
      viewerType: entity.ViewerType
      viewedId: string
      viewedType: entity.ViewableType
    },
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
    if (viewerType === entity.ViewerType.ProfileHolder
      && !(await isViewerIdProfileHolder(repos, viewerId))) {
      throw appError.buildInvalid(`Wrong type for viewerId: ${viewerId}, viewerType: ${viewerType}`, 'VIEW_INVALID')
    } else if (viewerType === entity.ViewerType.User
      && !(await isViewerIdUser(repos, viewerId))) {
      throw appError.buildInvalid(`Wrong type for viewerId: ${viewerId}, viewerType: ${viewerType}`, 'VIEW_INVALID')
    }
    return repos.view.save(viewArgs)
  }

  return {
    handleView,
  }
}
export const viewService = getViewService()