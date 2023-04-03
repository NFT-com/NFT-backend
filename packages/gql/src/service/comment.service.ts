import { appError } from '@nftcom/error-types'
import { db, entity, helper } from '@nftcom/shared'

import { Pageable } from '../defs'
import { pagination } from '../helper'
import { safeInput } from '../helper/pagination'
import { paginatedEntitiesBy } from './core.service'
import { profileService } from './profile.service'

interface AddCommentArgs {
  authorId: string
  content: string
  currentUserId: string
  entityId: string
  entityType: entity.SocialEntityType
}

interface GetCommentsArgs {
  entityId: string
  pageInput?: any
}
interface CommentService {
  addComment(addCommentArgs: AddCommentArgs): Promise<entity.Comment>
  getComments(getCommentsArgs: GetCommentsArgs): Promise<Pageable<entity.Comment>>
}
export function getCommentService(repos: db.Repository = db.newRepositories()): CommentService {
  async function addComment(addCommentArgs: AddCommentArgs): Promise<entity.Comment> {
    const { authorId, content, entityId, entityType, currentUserId } = addCommentArgs
    if (!authorId || !content || !entityId || !entityType) {
      throw new Error(`Missing property or property undefined in ${JSON.stringify(addCommentArgs)}`)
    }
    if (!Object.values(entity.SocialEntityType).includes(entityType)) {
      throw appError.buildInvalid(`${entityType} cannot be the subject of a comment`, 'COMMENT_INVALID')
    }
    if (!(await profileService.isProfileOwnedByUser({ profileId: authorId, userId: currentUserId }))) {
      throw appError.buildForbidden(`User cannot comment with profile: ${authorId}`, 'COMMENT_FORBIDDEN')
    }
    return repos.comment.save(addCommentArgs)
  }

  async function getComments(getCommentsArgs: GetCommentsArgs): Promise<Pageable<entity.Comment>> {
    const { entityId, pageInput } = getCommentsArgs
    if (!entityId) {
      throw new Error('entityId is required to get comments')
    }
    const safePageInput = safeInput(pageInput, { beforeCursor: helper.toDateIsoString() })
    const pagableComments = await paginatedEntitiesBy<entity.Comment>(
      repos.comment,
      safePageInput,
      [
        {
          entityId,
        },
      ],
      [],
    )
    return pagination.toPageable(safePageInput)(pagableComments)
  }

  return {
    addComment,
    getComments,
  }
}
export const commentService = getCommentService()
