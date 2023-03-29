import { appError } from '@nftcom/error-types'
import { db, entity } from '@nftcom/shared'

import { profileService } from './profile.service'

interface AddCommentArgs {
  authorId: string
  content: string
  currentUserId: string
  entityId: string
  entityType: entity.SocialEntityType
}
interface CommentService {
  addComment(addCommentArgs: AddCommentArgs): Promise<entity.Comment>
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

  return {
    addComment,
  }
}
export const commentService = getCommentService()
