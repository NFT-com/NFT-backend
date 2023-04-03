import { Column, Entity, Index } from 'typeorm'

import { CurationItem } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['userId'])
export class Curation extends BaseEntity {
  @Column('json', {
    nullable: false,
    default: [],
  })
  items: CurationItem[]

  @Column({ nullable: false })
  userId: string
}
