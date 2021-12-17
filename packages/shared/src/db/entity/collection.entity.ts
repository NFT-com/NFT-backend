import { Column, Entity, Index } from 'typeorm'

import { CollectionItem } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['userId'])
export class Collection extends BaseEntity {

  @Column('json', {
    nullable: false,
    default: [],
  })
  items: CollectionItem[]

  @Column({ nullable: false })
  userId: string

}
