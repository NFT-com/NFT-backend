import { appError } from '@nftcom/error-types'
import { Pageable, pagination } from '@nftcom/misc'
import { core } from '@nftcom/service'
import { db, entity, helper } from '@nftcom/shared'

import { profileService } from './profile.service'

interface AddCommentArgs {
  authorId: string
  content: string
  currentUserId: string
  entityId: string
  entityType: entity.SocialEntityType
}

interface DeleteCommentArgs {
  commentId: string
  currentUserId: string
}

interface GetCommentsArgs {
  entityId: string
  pageInput?: any
}
interface CommentService {
  addComment(addCommentArgs: AddCommentArgs): Promise<entity.Comment>
  deleteComment(deleteCommentArgs: DeleteCommentArgs): Promise<boolean>
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

  async function deleteComment(deleteCommentArgs: DeleteCommentArgs): Promise<boolean> {
    const { commentId, currentUserId } = deleteCommentArgs
    if (!commentId || !currentUserId) {
      throw appError.buildInvalid(
        `Missing property or property undefined in ${JSON.stringify(deleteCommentArgs)}`,
        'DELETE_COMMENT_INVALID',
      )
    }
    const comment = await repos.comment.findById(commentId)
    if (!comment) {
      return Promise.resolve(false)
    }
    if (!(await profileService.isProfileOwnedByUser({ profileId: comment.authorId, userId: currentUserId }))) {
      throw appError.buildForbidden(
        `User cannot delete comment with profile: ${comment.authorId}`,
        'DELETE_COMMENT_FORBIDDEN',
      )
    }
    return repos.comment.deleteById(commentId)
  }

  async function getComments(getCommentsArgs: GetCommentsArgs): Promise<Pageable<entity.Comment>> {
    const { entityId, pageInput } = getCommentsArgs
    if (!entityId) {
      throw new Error('entityId is required to get comments')
    }

    const safePageInput = pagination.safeInput(pageInput, { afterCursor: helper.toDateIsoString() })
    const pagableComments = await core.paginatedEntitiesBy<entity.Comment>(
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
    deleteComment,
    getComments,
  }
}
export const commentService = getCommentService()
