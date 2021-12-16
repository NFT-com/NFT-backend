import { Column, Entity, Index } from 'typeorm'

import { defs } from '@nftcom/shared'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['userId'])
export class Collection extends BaseEntity {

  @Column('json', {
    nullable: false,
    array: true,
    default: [],
  })
  items: defs.CollectionItem[]

  @Column({ nullable: false })
  userId: string

}
