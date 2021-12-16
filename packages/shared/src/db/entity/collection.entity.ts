import { Column, Entity, Index } from 'typeorm'

import { defs } from '@nftcom/shared'

import { BaseEntity } from './base.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['userId'])
export class Collection extends BaseEntity {

  @Column({ nullable: false })
  items: defs.CollectionItem[]

  @Column({ nullable: false })
  userId: string

}
