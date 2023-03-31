import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from './base.entity'

export enum SocialEntityType {
  Collection = 'Collection',
  NFT = 'NFT',
  Profile = 'Profile',
}

export enum CommentStatus {
  Deleted = 'Deleted',
  Explicit = 'Explicit',
  Flagged = 'Flagged',
  Hidden = 'Hidden',
  PendingReview = 'Pending Review',
  Published = 'Published',
  Sensitive = 'Sensitive',
}

@Entity()
@Index(['authorId', 'entityId', 'entityType'])
export class Comment extends BaseEntity {

  @Column()
  authorId: string

  @Column()
  entityId: string

  @Column({ type: 'enum', enum: SocialEntityType })
  entityType: SocialEntityType

  @Column()
  content: string

  @Column({ type: 'enum', enum: CommentStatus, default: CommentStatus.Published })
  status: CommentStatus

}
